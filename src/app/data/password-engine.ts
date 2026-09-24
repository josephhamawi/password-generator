import { Profile } from './db.service';
import { PlatformSpec, DEFAULT_SYMBOLS } from './platform-specs';

export type CharClass = 'lower' | 'upper' | 'digit' | 'symbol';

export const LOWER = 'abcdefghijklmnopqrstuvwxyz';
export const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const DIGIT = '0123456789';
export const AMBIGUOUS = 'il1ILoO0|`\'"';

export interface Glyph {
  ch: string;
  cls: CharClass;
  /** True when this character came from the user's profile rather than the CSPRNG. */
  personal: boolean;
}

export interface EntropyFactor {
  label: string;
  choices: number;
  bits: number;
}

export interface EntropyReport {
  /** Charset math: what a naive strength meter reports. */
  nominalBits: number;
  /** What it costs an attacker who does not hold the secret. */
  effectiveBits: number;
  usesPersonalData: boolean;
  factors: EntropyFactor[];
  /** What remains once the word list itself is compromised. */
  leakedBits?: number;
  leakedFactors?: EntropyFactor[];
}

/** The user's private words. Key material: encrypted at rest. */
export type Wordlist = string[];

export interface GenerateRequest {
  length: number;
  useLower: boolean;
  useUpper: boolean;
  useDigit: boolean;
  useSymbol: boolean;
  avoidAmbiguous: boolean;
  requireEachSet: boolean;
  /** Restricts the symbol pool; empty means the full default set. */
  allowedSymbols: string;
  /** Longest run of one character, 0 for unlimited. */
  maxRepeat: number;
}

export interface GenerateResult {
  glyphs: Glyph[];
  entropy: EntropyReport;
  /** Constraints that could not be met, e.g. a length cap below the required classes. */
  warnings: string[];
}

const log2 = (n: number) => Math.log(n) / Math.LN2;

// --------------------------------------------------------------------- randomness

/**
 * Uniform integer in [0, bound) from the platform CSPRNG.
 * `value % bound` alone is biased, so the final partial block is rejected.
 */
export function randomBelow(bound: number): number {
  if (bound <= 1) { return 0; }
  const limit = Math.floor(4294967296 / bound) * bound;
  const buf = new Uint32Array(1);
  let value: number;
  do {
    window.crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);
  return value % bound;
}

export function pick(source: string): string {
  return source.charAt(randomBelow(source.length));
}

export function shuffle<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1);
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
}

export function classify(ch: string): CharClass {
  if (ch >= 'a' && ch <= 'z') { return 'lower'; }
  if (ch >= 'A' && ch <= 'Z') { return 'upper'; }
  if (ch >= '0' && ch <= '9') { return 'digit'; }
  return 'symbol';
}

function strip(alphabet: string, remove: string): string {
  let out = '';
  for (let i = 0; i < alphabet.length; i++) {
    if (remove.indexOf(alphabet.charAt(i)) === -1) { out += alphabet.charAt(i); }
  }
  return out;
}

// ------------------------------------------------------------------ random mode

export function pools(req: GenerateRequest): string[] {
  const symbols = req.allowedSymbols ? req.allowedSymbols : DEFAULT_SYMBOLS;
  const raw = [
    req.useLower ? LOWER : '',
    req.useUpper ? UPPER : '',
    req.useDigit ? DIGIT : '',
    req.useSymbol ? symbols : ''
  ];
  const out: string[] = [];
  raw.forEach(a => {
    const cleaned = req.avoidAmbiguous ? strip(a, AMBIGUOUS) : a;
    if (cleaned.length) { out.push(cleaned); }
  });
  return out;
}

/** Rejects a candidate that breaks a platform's repeated-character rule. */
function violatesRepeat(chars: string[], maxRepeat: number): boolean {
  if (!maxRepeat) { return false; }
  let run = 1;
  for (let i = 1; i < chars.length; i++) {
    run = chars[i] === chars[i - 1] ? run + 1 : 1;
    if (run > maxRepeat) { return true; }
  }
  return false;
}

export function generateRandom(req: GenerateRequest): GenerateResult {
  const warnings: string[] = [];
  const sets = pools(req);

  if (!sets.length) {
    return {
      glyphs: [],
      entropy: { nominalBits: 0, effectiveBits: 0, usesPersonalData: false, factors: [] },
      warnings: ['Select at least one character set.']
    };
  }

  const combined = sets.join('');
  let chars: string[] = [];

  // maxRepeat is enforced by resampling; a handful of attempts is plenty since
  // violations are rare, and giving up leaves the password valid but unpadded.
  for (let attempt = 0; attempt < 24; attempt++) {
    chars = [];
    if (req.requireEachSet && req.length >= sets.length) {
      sets.forEach(s => chars.push(pick(s)));
    }
    while (chars.length < req.length) { chars.push(pick(combined)); }
    shuffle(chars);
    if (!violatesRepeat(chars, req.maxRepeat)) { break; }
  }

  if (req.requireEachSet && req.length < sets.length) {
    warnings.push(`Length ${req.length} is too short to include all ${sets.length} selected sets.`);
  }

  const bits = req.length * log2(combined.length);
  return {
    glyphs: chars.map(ch => ({ ch, cls: classify(ch), personal: false })),
    entropy: {
      nominalBits: bits,
      effectiveBits: bits,
      usesPersonalData: false,
      factors: [
        { label: `${req.length} characters from a pool of ${combined.length}`,
          choices: combined.length, bits }
      ]
    },
    warnings
  };
}

// ---------------------------------------------------------------- personal mode

/** Every word an attacker could scrape from the profile. */
export interface PersonalToken {
  label: string;
  value: string;
}

export function profileTokens(p: Profile): PersonalToken[] {
  const out: PersonalToken[] = [];
  const add = (label: string, value: string) => {
    const clean = (value || '').replace(/[^A-Za-z0-9]/g, '');
    if (clean.length >= 2) { out.push({ label, value: clean }); }
  };
  add('first name', p.firstName);
  add('last name', p.lastName);
  add('city', p.city);
  add('country', p.country);
  add('school', p.school);
  add('field', p.field);
  return out;
}

export function birthNumbers(p: Profile): string[] {
  const out: string[] = [];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.birthDate || '');
  if (m) {
    out.push(m[1]);
    out.push(m[1].slice(2));
    out.push(m[3] + m[2]);
  }
  return out;
}


// ------------------------------------------------------------------- spec fitting

/** Folds a platform's published rules into a generate request. */
export function requestForSpec(spec: PlatformSpec, base: GenerateRequest): GenerateRequest {
  const length = Math.max(spec.minLength, Math.min(spec.maxLength, base.length));
  return {
    length,
    useLower: base.useLower || spec.requireLower,
    useUpper: base.useUpper || spec.requireUpper,
    useDigit: base.useDigit || spec.requireDigit,
    useSymbol: (base.useSymbol || spec.requireSymbol) && spec.allowedSymbols !== 'none',
    avoidAmbiguous: base.avoidAmbiguous,
    requireEachSet: true,
    allowedSymbols: spec.allowedSymbols,
    maxRepeat: spec.maxRepeat
  };
}

/** Checks a finished password against a platform's rules. */
export function validateAgainstSpec(password: string, spec: PlatformSpec): string[] {
  const problems: string[] = [];
  if (password.length < spec.minLength) {
    problems.push(`Shorter than ${spec.name}'s ${spec.minLength}-character minimum.`);
  }
  if (password.length > spec.maxLength) {
    problems.push(`Longer than ${spec.name}'s ${spec.maxLength}-character maximum.`);
  }
  if (spec.requireUpper && !/[A-Z]/.test(password)) { problems.push('Needs an uppercase letter.'); }
  if (spec.requireLower && !/[a-z]/.test(password)) { problems.push('Needs a lowercase letter.'); }
  if (spec.requireDigit && !/[0-9]/.test(password)) { problems.push('Needs a digit.'); }
  if (spec.requireSymbol && !/[^A-Za-z0-9]/.test(password)) { problems.push('Needs a symbol.'); }
  if (spec.allowedSymbols) {
    for (let i = 0; i < password.length; i++) {
      const c = password.charAt(i);
      if (!/[A-Za-z0-9]/.test(c) && spec.allowedSymbols.indexOf(c) === -1) {
        problems.push(`${spec.name} may not accept "${c}".`);
        break;
      }
    }
  }
  if (spec.maxRepeat && violatesRepeat(password.split(''), spec.maxRepeat)) {
    problems.push(`More than ${spec.maxRepeat} identical characters in a row.`);
  }
  return problems;
}

/** Flags a password that contains anything lifted from the profile. */
export function personalLeaks(password: string, profile: Profile): string[] {
  const lower = password.toLowerCase();
  const hits: string[] = [];
  profileTokens(profile).forEach(t => {
    if (t.value.length >= 3 && lower.indexOf(t.value.toLowerCase()) !== -1) {
      hits.push(t.label);
    }
  });
  birthNumbers(profile).forEach(n => {
    if (n.length >= 4 && lower.indexOf(n) !== -1) { hits.push('date of birth'); }
  });
  return hits.filter((v, i, a) => a.indexOf(v) === i);
}

export function strengthLabel(bits: number): { label: string; note: string } {
  if (bits < 40) { return { label: 'Weak', note: 'Crackable offline in hours.' }; }
  if (bits < 60) { return { label: 'Fair', note: 'Fine for low-stakes accounts.' }; }
  if (bits < 80) { return { label: 'Strong', note: 'Beyond practical brute force.' }; }
  return { label: 'Excellent', note: 'Overkill, in the good way.' };
}
