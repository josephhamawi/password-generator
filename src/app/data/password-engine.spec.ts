import {
  generateRandom, requestForSpec, validateAgainstSpec,
  personalLeaks, profileTokens, birthNumbers, randomBelow, classify,
  GenerateRequest
} from './password-engine';
import { Profile } from './db.service';
import { PLATFORM_SPECS, PlatformSpec } from './platform-specs';

const req = (over: any = {}): GenerateRequest => ({
  length: 16, useLower: true, useUpper: true, useDigit: true, useSymbol: true,
  avoidAmbiguous: false, requireEachSet: true, allowedSymbols: '', maxRepeat: 0,
  ...over
});

const PROFILE: Profile = {
  firstName: 'Rami', lastName: 'Zoohbi', birthDate: '1990-03-15',
  country: 'Lebanon', city: 'Beirut', school: 'AUB', field: 'Engineering'
};

describe('randomBelow', () => {
  it('stays inside the requested range', () => {
    for (let i = 0; i < 500; i++) {
      const v = randomBelow(7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
  });

  it('covers the whole range rather than clustering', () => {
    const seen: { [k: number]: boolean } = {};
    for (let i = 0; i < 400; i++) { seen[randomBelow(10)] = true; }
    expect(Object.keys(seen).length).toBe(10);
  });
});

describe('generateRandom', () => {
  it('produces the requested length', () => {
    const r = generateRandom(req({ length: 24 }));
    expect(r.glyphs.length).toBe(24);
  });

  it('includes every selected set', () => {
    for (let i = 0; i < 30; i++) {
      const pw = generateRandom(req({ length: 12 })).glyphs.map(g => g.ch).join('');
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).toMatch(/[^a-zA-Z0-9]/);
    }
  });

  it('never repeats a password', () => {
    const seen: { [k: string]: boolean } = {};
    for (let i = 0; i < 50; i++) {
      const pw = generateRandom(req({ length: 32 })).glyphs.map(g => g.ch).join('');
      expect(seen[pw]).toBeUndefined();
      seen[pw] = true;
    }
  });

  it('honours a maxRepeat constraint', () => {
    for (let i = 0; i < 30; i++) {
      const pw = generateRandom(req({ length: 20, maxRepeat: 2 })).glyphs.map(g => g.ch).join('');
      expect(pw).not.toMatch(/(.)\1\1/);
    }
  });

  it('restricts symbols when a platform limits them', () => {
    const r = generateRandom(req({ length: 20, allowedSymbols: '!@#' }));
    const pw = r.glyphs.map(g => g.ch).join('');
    for (let i = 0; i < pw.length; i++) {
      const c = pw.charAt(i);
      if (!/[A-Za-z0-9]/.test(c)) { expect('!@#'.indexOf(c)).toBeGreaterThan(-1); }
    }
  });

  it('marks nothing as personal', () => {
    generateRandom(req()).glyphs.forEach(g => expect(g.personal).toBe(false));
  });

  it('reports nominal and effective entropy as equal', () => {
    const e = generateRandom(req({ length: 16 })).entropy;
    expect(e.nominalBits).toBe(e.effectiveBits);
    expect(e.usesPersonalData).toBe(false);
  });
});

describe('profile extraction', () => {
  it('pulls every usable word', () => {
    const labels = profileTokens(PROFILE).map(t => t.label);
    expect(labels).toContain('first name');
    expect(labels).toContain('city');
    expect(labels).toContain('school');
  });

  it('derives the numbers an attacker would try', () => {
    expect(birthNumbers(PROFILE)).toEqual(['1990', '90', '1503']);
  });

  it('ignores fields that are blank or too short', () => {
    const sparse: Profile = { ...PROFILE, city: '', school: 'A' };
    const labels = profileTokens(sparse).map(t => t.label);
    expect(labels).not.toContain('city');
    expect(labels).not.toContain('school');
  });
});

describe('platform specs', () => {
  it('every built-in spec generates a password it would itself accept', () => {
    PLATFORM_SPECS.filter(s => !s.passwordless).forEach(spec => {
      const r = generateRandom(requestForSpec(spec, req({ length: 16 })));
      const pw = r.glyphs.map(g => g.ch).join('');
      expect(validateAgainstSpec(pw, spec)).toEqual([]);
    });
  });

  it('clamps length into the platform range', () => {
    const paypal = PLATFORM_SPECS.filter(s => s.id === 'paypal')[0];
    expect(requestForSpec(paypal, req({ length: 64 })).length).toBe(20);
    const github = PLATFORM_SPECS.filter(s => s.id === 'github')[0];
    expect(requestForSpec(github, req({ length: 8 })).length).toBe(15);
  });

  it('catches a password that breaks the rules', () => {
    const apple = PLATFORM_SPECS.filter(s => s.id === 'apple')[0];
    expect(validateAgainstSpec('short', apple).length).toBeGreaterThan(0);
    expect(validateAgainstSpec('alllowercase1', apple)).toContain('Needs an uppercase letter.');
    expect(validateAgainstSpec('Aaaa1bbbbbbbb', apple).join(' ')).toContain('identical characters');
  });

  // Regression: TikTok's notes said a symbol was required while its
  // requireSymbol flag was false, so nothing added one and nothing complained.
  it('keeps the requirement flags consistent with the notes', () => {
    PLATFORM_SPECS.forEach(spec => {
      const notes = spec.notes.toLowerCase();
      if (notes.indexOf('and a symbol') !== -1) {
        expect(spec.requireSymbol).toBe(true, `${spec.name} notes promise a symbol`);
      }
      if (notes.indexOf('no more than') !== -1 && notes.indexOf('row') !== -1) {
        expect(spec.maxRepeat).toBeGreaterThan(0);
      }
    });
  });

  it('has no duplicate ids', () => {
    const ids = PLATFORM_SPECS.map(s => s.id);
    expect(ids.length).toBe(ids.filter((v, i) => ids.indexOf(v) === i).length);
  });

  it('has a sane length range everywhere', () => {
    PLATFORM_SPECS.forEach(s => {
      expect(s.minLength).toBeGreaterThan(0);
      expect(s.maxLength).toBeGreaterThanOrEqual(s.minLength);
    });
  });
});

describe('personalLeaks', () => {
  it('spots profile words hiding in a password', () => {
    expect(personalLeaks('xxBeirutxx99', PROFILE)).toContain('city');
    expect(personalLeaks('hello1990world', PROFILE)).toContain('date of birth');
  });

  it('stays quiet on a clean random password', () => {
    expect(personalLeaks('qZ7!vK-2pXw9', PROFILE)).toEqual([]);
  });
});

describe('classify', () => {
  it('sorts characters into the four classes', () => {
    expect(classify('a')).toBe('lower');
    expect(classify('Z')).toBe('upper');
    expect(classify('7')).toBe('digit');
    expect(classify('!')).toBe('symbol');
  });
});
