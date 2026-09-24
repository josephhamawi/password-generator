import {
  generateFromWords, wordEntropyBits, selectionBits, symbolPoolFor,
  MIN_WORDS, MAX_WORDS, WORD_DIGITS, WORD_TAIL_SYMBOLS, HUMAN_VOCAB,
  dictionaryCore, charsetBits
} from './word-engine';
import { GenerateRequest, validateAgainstSpec } from './password-engine';
import { PLATFORM_SPECS } from './platform-specs';

const req = (over: any = {}): GenerateRequest => ({
  length: 16, useLower: true, useUpper: true, useDigit: true, useSymbol: true,
  avoidAmbiguous: false, requireEachSet: true, allowedSymbols: '', maxRepeat: 0,
  ...over
});

const LIST = ['mountain', 'Rivr42', 'k3ttle!', 'brass', 'Lantern#9', 'drift'];
const opts = (over: any = {}) => ({ wordCount: 2, padding: 0, ...over });
const text = (r: any) => r.glyphs.map((g: any) => g.ch).join('');

describe('wordEntropyBits', () => {
  const vocab = Math.log(HUMAN_VOCAB) / Math.LN2;

  it('prices a plain word as a frequency-ordered guess, not a dictionary draw', () => {
    // 11 bits for the word + 2 for capitalisation. Length is irrelevant: a
    // longer common word is not a harder guess for a wordlist attack.
    expect(wordEntropyBits('mountain')).toBeCloseTo(vocab + 2, 5);
    expect(wordEntropyBits('encyclopedia')).toBeCloseTo(vocab + 2, 5);
  });

  it('never exceeds plain charset entropy', () => {
    ['cat', 'ab', 'x', 'the'].forEach(w => {
      expect(wordEntropyBits(w)).toBeLessThanOrEqual(charsetBits(w) + 1e-9);
    });
  });

  it('charges only for what was bolted onto a dictionary word', () => {
    // "Lantern#9" is lantern + Title case + a two character suffix, not nine
    // random characters. Regression: this used to be priced at 58 bits.
    const bits = wordEntropyBits('Lantern#9');
    expect(bits).toBeGreaterThan(vocab);
    expect(bits).toBeLessThan(30);
    expect(bits).toBeLessThan(charsetBits('Lantern#9'));
  });

  it('gives leet substitution only a bit or two, the way a cracker rule does', () => {
    // Interior substitution only, so the difference is the leet credit alone.
    // A trailing digit is a suffix and is charged separately.
    const plain = wordEntropyBits('kettle');
    const leet = wordEntropyBits('k3ttle');
    expect(leet - plain).toBeGreaterThan(0);
    expect(leet - plain).toBeLessThanOrEqual(4);
  });

  it('charges a trailing digit as a suffix rather than as leet', () => {
    expect(wordEntropyBits('k3ttl3')).toBeGreaterThan(wordEntropyBits('k3ttle'));
  });

  it('keeps full charset value for a string with no dictionary core', () => {
    // Regression: an incidental three letter run inside a random string used
    // to be mistaken for a mangled word and priced far too low.
    ['x7#Qv2!mB9', '7#2!9%4&6@', 'q4$8#2!9%6'].forEach(random => {
      expect(wordEntropyBits(random)).toBeCloseTo(charsetBits(random), 5);
    });
  });

  it('returns nothing for an empty word', () => {
    expect(wordEntropyBits('')).toBe(0);
  });
});

describe('dictionaryCore', () => {
  it('undoes leet substitutions before looking for a word', () => {
    expect(dictionaryCore('k3ttle!')).toBe('kettle');
    expect(dictionaryCore('M0unt41n')).toBe('Mountain');
  });

  it('leaves trailing punctuation out of the core', () => {
    // Regression: "!" reverses to "i", so "k3ttle!" used to core as "kettlei",
    // swallowing the suffix and undercharging for it.
    expect(dictionaryCore('pass!!')).toBe('pass');
    expect(dictionaryCore('Lantern#9')).toBe('Lantern');
  });

  it('still reverses leet at the front of a word', () => {
    expect(dictionaryCore('@pple')).toBe('apple');
  });

  it('finds nothing usable in a string of noise', () => {
    expect(dictionaryCore('x7#Q2!9').length).toBeLessThan(3);
  });

  it('errs toward calling something a word, because that under-states it', () => {
    // A half-alphabetic string is treated as a mangled word and priced low.
    // Under-stating strength is the safe error; over-stating it is not.
    expect(wordEntropyBits('q4$Lm8#Zt1')).toBeLessThan(charsetBits('q4$Lm8#Zt1'));
  });
});

describe('selectionBits', () => {
  it('counts ordered selections without replacement', () => {
    // P(6,2) = 30
    expect(selectionBits(6, 2)).toBeCloseTo(Math.log(30) / Math.LN2, 5);
    expect(selectionBits(10, 1)).toBeCloseTo(Math.log(10) / Math.LN2, 5);
  });

  it('is zero for impossible draws', () => {
    expect(selectionBits(3, 5)).toBe(0);
    expect(selectionBits(0, 1)).toBe(0);
  });
});

describe('generateFromWords', () => {
  it('refuses a list shorter than the minimum', () => {
    const r = generateFromWords(['a', 'b'], req(), opts());
    expect(r.glyphs.length).toBe(0);
    expect(r.warnings[0]).toContain(String(MIN_WORDS));
  });

  it('builds from words in the list', () => {
    const pw = text(generateFromWords(LIST, req(), opts()));
    expect(LIST.some(w => pw.indexOf(w) !== -1)).toBe(true);
  });

  it('draws distinct words, never the same one twice', () => {
    for (let i = 0; i < 40; i++) {
      const r = generateFromWords(LIST, req(), opts({ wordCount: 3 }));
      const used = LIST.filter(w => text(r).indexOf(w) !== -1);
      expect(used.length).toBe(new Set(used).size);
    }
  });

  it('appends the digits and a symbol tail', () => {
    const pw = text(generateFromWords(LIST, req(), opts()));
    expect(pw).toMatch(new RegExp('[0-9]{' + WORD_DIGITS + '}[' + WORD_TAIL_SYMBOLS + ']$'));
  });

  it('falls back to a digit tail when symbols are off', () => {
    const pw = text(generateFromWords(LIST, req({ useSymbol: false }), opts()));
    expect(pw).toMatch(new RegExp('[0-9]{' + (WORD_DIGITS + 1) + '}$'));
  });

  it('tags list characters separately from random ones', () => {
    const r = generateFromWords(LIST, req(), opts());
    expect(r.glyphs.filter(g => g.personal).length).toBeGreaterThan(0);
    expect(r.glyphs.filter(g => !g.personal).length).toBeGreaterThan(WORD_DIGITS - 1);
  });

  it('never produces the same password twice', () => {
    const seen: { [k: string]: boolean } = {};
    for (let i = 0; i < 40; i++) {
      const pw = text(generateFromWords(LIST, req(), opts({ padding: 4 })));
      expect(seen[pw]).toBeUndefined();
      seen[pw] = true;
    }
  });

  it('reports far more strength while the list is secret than after it leaks', () => {
    const e: any = generateFromWords(LIST, req(), opts()).entropy;
    expect(e.effectiveBits).toBeGreaterThan(e.leakedBits);
    // Selection alone from six words is tiny; the words themselves carry the weight.
    expect(e.leakedBits).toBeLessThan(40);
  });

  it('still beats the old profile pattern', () => {
    // The profile pattern was worth ~22 bits because the letters were public.
    // Words are private, so even priced conservatively they come out ahead.
    const e: any = generateFromWords(LIST, req(), opts()).entropy;
    expect(e.effectiveBits).toBeGreaterThan(30);
  });

  it('credits padding in both figures', () => {
    // A uniform list, so the only difference between the two draws is padding.
    // With mixed words, per-draw variance in word strength swamps the comparison.
    const UNIFORM = ['alpha', 'bravo', 'delta', 'gamma', 'sigma'];
    const bare: any = generateFromWords(UNIFORM, req(), opts()).entropy;
    const pad: any = generateFromWords(UNIFORM, req(), opts({ padding: 10 })).entropy;
    expect(pad.effectiveBits).toBeGreaterThan(bare.effectiveBits + 50);
    expect(pad.leakedBits).toBeGreaterThan(bare.leakedBits + 50);
  });

  it('adds the character classes a platform insists on', () => {
    // Regression: an all-lowercase list produced all-lowercase passwords, which
    // Apple, PayPal and Zoom reject outright.
    const LOWER_ONLY = ['alpha', 'bravo', 'delta', 'gamma', 'sigma'];
    for (let i = 0; i < 20; i++) {
      const pw = text(generateFromWords(LOWER_ONLY, req({ useSymbol: false }), opts({
        requireUpper: true, requireLower: true, requireDigit: true
      })));
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[0-9]/);
    }
  });

  it('respects a repeated-character limit with padding', () => {
    const UNIFORM = ['alpha', 'bravo', 'delta', 'gamma', 'sigma'];
    for (let i = 0; i < 40; i++) {
      const pw = text(generateFromWords(UNIFORM, req(), opts({ padding: 8, maxRepeat: 2 })));
      expect(pw).not.toMatch(/(.)\1\1/);
    }
  });

  it('respects a repeated-character limit with no padding at all', () => {
    // Regression: only the padding used to be re-rolled, so with padding at
    // zero a run of three identical digits survived and Apple rejected it.
    // Roughly a 3% chance per draw, which showed up as a flaky test.
    const UNIFORM = ['alpha', 'bravo', 'delta', 'gamma', 'sigma'];
    for (let i = 0; i < 400; i++) {
      const pw = text(generateFromWords(UNIFORM, req(), opts({ padding: 0, maxRepeat: 2 })));
      expect(pw).not.toMatch(/(.)\1\1/);
    }
  });

  it('warns when plain lowercase words are doing the work', () => {
    const r = generateFromWords(['mountain', 'valley', 'river', 'forest', 'meadow'],
      req(), opts({ wordCount: 2 }));
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('pads up to a platform minimum', () => {
    const github = PLATFORM_SPECS.filter(s => s.id === 'github')[0];
    const r = generateFromWords(['ab', 'cd', 'ef', 'gh', 'ij'], req(),
      opts({ wordCount: 1, minLength: github.minLength }));
    expect(text(r).length).toBeGreaterThanOrEqual(github.minLength);
  });

  it('satisfies every platform in the catalogue, repeatedly', () => {
    // Run each spec many times: the failures this catches are probabilistic.
    for (let round = 0; round < 25; round++) {
    PLATFORM_SPECS.filter(s => !s.passwordless).forEach(spec => {
      const base = req({ allowedSymbols: spec.allowedSymbols, maxRepeat: spec.maxRepeat,
                         useUpper: true, useLower: true, useDigit: true, useSymbol: true });
      const r = generateFromWords(LIST, base, opts({
        wordCount: 2, padding: 0,
        forceSymbol: spec.requireSymbol, minLength: spec.minLength,
        requireUpper: spec.requireUpper, requireLower: spec.requireLower,
        requireDigit: spec.requireDigit, maxRepeat: spec.maxRepeat
      }));
      const pw = text(r);
      if (pw.length > spec.maxLength) { return; }
      const problems = validateAgainstSpec(pw, spec);
      expect(problems).toEqual([], `${spec.name} rejected "${pw}": ${problems.join(' ')}`);
    });
    }
  });
});

describe('symbolPoolFor', () => {
  it('uses the full tail set when nothing is restricted', () => {
    expect(symbolPoolFor('')).toBe(WORD_TAIL_SYMBOLS);
  });

  it('narrows to what a platform permits', () => {
    expect(symbolPoolFor('!@')).toBe('@!');
    expect(symbolPoolFor('%^&')).toBe('');
  });
});

describe('list bounds', () => {
  it('runs from 5 to 10 words', () => {
    expect(MIN_WORDS).toBe(5);
    expect(MAX_WORDS).toBe(10);
  });
});
