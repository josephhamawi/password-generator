import {
  GenerateRequest, GenerateResult, Glyph, EntropyFactor, Wordlist,
  classify, randomBelow, pick, pools, DIGIT, LOWER, UPPER
} from './password-engine';

/**
 * Word-based generation.
 *
 * The user supplies 5-10 private words (letters, digits, symbols -- anything).
 * A password is a random selection of them, joined by a random separator, with
 * random digits and an optional symbol tail.
 *
 * Unlike profile data, these are not public, so they carry real entropy. But
 * they are reused across every password the list produces, which makes the list
 * key material: if it ever leaks, every password it generated collapses to
 * "which words, in what order". Both figures are reported.
 */

const log2 = (n: number) => Math.log(n) / Math.LN2;

export const MIN_WORDS = 5;
export const MAX_WORDS = 10;

export const WORD_SEPARATORS = ['', '.', '-', '_', '!', '@', '#', '*', '+'];
export const WORD_TAIL_SYMBOLS = '-_@!?';

/** Digits appended after the words. */
export const WORD_DIGITS = 4;

/**
 * Effective vocabulary a human actually draws from when asked to "pick a word".
 *
 * This is not the size of a dictionary. People do not sample uniformly from
 * 100,000 words: choices concentrate hard on common, concrete, memorable nouns,
 * and an attacker orders their wordlist by frequency. 2^11 sits at the
 * conservative end of published estimates for human-chosen passphrase words.
 * Diceware reaches 12.9 bits per word only because the dice do the choosing.
 */
export const HUMAN_VOCAB = 2048;

/** Leet substitutions a rule-based cracker reverses for free. */
const LEET_REVERSE: { [k: string]: string } = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't',
  '$': 's', '@': 'a', '!': 'i', '+': 't'
};

/** Capitalisation patterns a cracker tries: lower, Title, UPPER, and oddities. */
const CASE_PATTERNS = 4;

/** Most leet-mangled words use one scheme, so the credit is capped. */
const MAX_LEET_BITS = 4;

function deleet(word: string): string {
  let out = '';
  for (let i = 0; i < word.length; i++) {
    const c = word.charAt(i);
    out += LEET_REVERSE[c] ? LEET_REVERSE[c] : c;
  }
  return out;
}

function countLeet(word: string): number {
  let n = 0;
  for (let i = 0; i < word.length; i++) {
    if (LEET_REVERSE[word.charAt(i)]) { n++; }
  }
  return n;
}

/**
 * Fraction of the word the core must cover before it counts as a mangled
 * dictionary word. Without it, a random string containing an incidental three
 * letter run gets mistaken for one.
 *
 * The threshold is deliberately lenient. Mistaking noise for a word under-states
 * its strength, which is safe; mistaking a real mangled word for noise hands it
 * full charset credit and tells the user it is stronger than it is, which is
 * not. When the heuristic has to be wrong, it should be wrong this way.
 */
const CORE_COVERAGE = 0.5;

/**
 * The longest alphabetic run once leet substitutions are undone.
 *
 * Trailing punctuation is stripped before de-leeting: a "!" at the end of a
 * word is a suffix, not a leet "i", and treating it as one swallowed the
 * suffix into the core and undercharged for it.
 */
export function dictionaryCore(word: string): string {
  const trailing = /[^A-Za-z]*$/.exec(word);
  const body = trailing ? word.slice(0, word.length - trailing[0].length) : word;
  const plain = deleet(body);
  let best = '';
  let run = '';
  for (let i = 0; i < plain.length; i++) {
    if (/[A-Za-z]/.test(plain.charAt(i))) {
      run += plain.charAt(i);
      if (run.length > best.length) { best = run; }
    } else {
      run = '';
    }
  }
  return best;
}

export function charsetBits(text: string): number {
  if (!text) { return 0; }
  let pool = 0;
  if (/[a-z]/.test(text)) { pool += 26; }
  if (/[A-Z]/.test(text)) { pool += 26; }
  if (/[0-9]/.test(text)) { pool += 10; }
  if (/[^A-Za-z0-9]/.test(text)) { pool += 27; }
  return text.length * log2(pool || 1);
}

/**
 * What one word is worth to an attacker who does NOT have the list.
 *
 * Modelled the way a rule-based cracker actually works: take a frequency
 * ordered wordlist, then apply mangling rules. Capitalise, leet-substitute,
 * append digits and symbols. So a mangled dictionary word is priced as
 *
 *     word choice + capitalisation + leet scheme + whatever was bolted on
 *
 * rather than on its raw character count. "Lantern#9" is a common word with a
 * two character suffix, not nine random characters.
 *
 * A string with no dictionary core left in it is priced on its characters,
 * which is why genuinely random entries keep their full value. The result can
 * never exceed plain charset entropy.
 */
export function wordEntropyBits(word: string): number {
  if (!word) { return 0; }

  const ceiling = charsetBits(word);
  const core = dictionaryCore(word);

  // Too little alphabetic content, or a core too small a share of the whole,
  // to be a mangled word. Treat it as a string and charge full charset value.
  if (core.length < 3 || core.length / word.length < CORE_COVERAGE) { return ceiling; }

  const affixLength = word.length - core.length;
  const affix = affixLength > 0 ? word.slice(-affixLength) : '';

  const bits =
      log2(HUMAN_VOCAB)                          // which word
    + log2(CASE_PATTERNS)                        // how it was capitalised
    + Math.min(countLeet(word), MAX_LEET_BITS)   // which leet scheme
    + charsetBits(affix);                        // what was bolted on

  return Math.min(bits, ceiling);
}

/** Permutations: choosing k distinct words from n, order mattering. */
export function selectionBits(n: number, k: number): number {
  if (k <= 0 || n <= 0 || k > n) { return 0; }
  let bits = 0;
  for (let i = 0; i < k; i++) { bits += log2(n - i); }
  return bits;
}

export function symbolPoolFor(allowedSymbols: string): string {
  if (!allowedSymbols) { return WORD_TAIL_SYMBOLS; }
  let out = '';
  for (let i = 0; i < WORD_TAIL_SYMBOLS.length; i++) {
    const c = WORD_TAIL_SYMBOLS.charAt(i);
    if (allowedSymbols.indexOf(c) !== -1) { out += c; }
  }
  return out;
}

export interface WordGenerateOptions {
  /** How many words to draw from the list. */
  wordCount: number;
  /** Extra CSPRNG characters appended. */
  padding: number;
  /** Force a symbol even if the symbol set is switched off. */
  forceSymbol?: boolean;
  /** Pad up to this length if the platform demands more. */
  minLength?: number;
  /** Character classes the platform insists on. */
  requireUpper?: boolean;
  requireLower?: boolean;
  requireDigit?: boolean;
  /** Longest run of one character the platform tolerates. 0 = unlimited. */
  maxRepeat?: number;
}

function hasRun(chars: string[], maxRepeat: number): boolean {
  if (!maxRepeat) { return false; }
  let run = 1;
  for (let i = 1; i < chars.length; i++) {
    run = chars[i] === chars[i - 1] ? run + 1 : 1;
    if (run > maxRepeat) { return true; }
  }
  return false;
}

export function generateFromWords(
  list: Wordlist,
  req: GenerateRequest,
  opts: WordGenerateOptions
): GenerateResult {
  const words = list.filter(w => !!w && w.length > 0);
  const warnings: string[] = [];

  if (words.length < MIN_WORDS) {
    return {
      glyphs: [],
      entropy: { nominalBits: 0, effectiveBits: 0, usesPersonalData: false, factors: [] },
      warnings: [`Add at least ${MIN_WORDS} words. You have ${words.length}.`]
    };
  }

  const count = Math.max(1, Math.min(opts.wordCount, words.length));

  // Draw distinct words without replacement.
  const remaining = words.slice();
  const chosen: string[] = [];
  for (let i = 0; i < count; i++) {
    chosen.push(remaining.splice(randomBelow(remaining.length), 1)[0]);
  }

  const sep = WORD_SEPARATORS[randomBelow(WORD_SEPARATORS.length)];

  const glyphs: Glyph[] = [];
  const pushAll = (text: string, fromList: boolean) => {
    for (let i = 0; i < text.length; i++) {
      glyphs.push({ ch: text.charAt(i), cls: classify(text.charAt(i)), personal: fromList });
    }
  };

  chosen.forEach((w, i) => {
    if (i > 0 && sep) { pushAll(sep, false); }
    pushAll(w, true);
  });

  // Everything after the words is random, so the whole tail is re-rolled as a
  // unit until it satisfies the platform's repeated-character rule. Re-rolling
  // only the padding left a violation unfixable whenever padding was zero,
  // which intermittently produced passwords Apple would reject.
  const wordsEnd = glyphs.length;
  const symbolPool = symbolPoolFor(req.allowedSymbols);
  const tailIsSymbol = (req.useSymbol || !!opts.forceSymbol) && symbolPool.length > 0;
  const padPool = pools(req).join('') || 'abcdefghijklmnopqrstuvwxyz0123456789';

  let required: Array<{ pool: string; label: string }> = [];
  let padCount = 0;

  for (let attempt = 0; attempt < 40; attempt++) {
    glyphs.length = wordsEnd;

    if (sep) { pushAll(sep, false); }
    for (let i = 0; i < WORD_DIGITS; i++) {
      pushAll(DIGIT.charAt(randomBelow(10)), false);
    }

    pushAll(tailIsSymbol
      ? symbolPool.charAt(randomBelow(symbolPool.length))
      : DIGIT.charAt(randomBelow(10)), false);

    // Whatever character classes the platform insists on. A list of plain
    // lowercase words would otherwise fail Apple, PayPal or Zoom outright.
    const soFar = glyphs.map(g => g.ch).join('');
    required = [];
    if (opts.requireUpper && !/[A-Z]/.test(soFar)) {
      required.push({ pool: UPPER, label: 'uppercase letter required by the platform' });
    }
    if (opts.requireLower && !/[a-z]/.test(soFar)) {
      required.push({ pool: LOWER, label: 'lowercase letter required by the platform' });
    }
    if (opts.requireDigit && !/[0-9]/.test(soFar)) {
      required.push({ pool: DIGIT, label: 'digit required by the platform' });
    }
    required.forEach(r => pushAll(r.pool.charAt(randomBelow(r.pool.length)), false));

    // Explicit padding, plus whatever the platform's minimum still demands.
    padCount = Math.max(opts.padding, Math.max(0, (opts.minLength || 0) - glyphs.length));
    for (let i = 0; i < padCount; i++) { pushAll(pick(padPool), false); }

    if (!hasRun(glyphs.map(g => g.ch), opts.maxRepeat || 0)) { break; }
  }

  // A run inside a chosen word itself cannot be fixed by re-rolling.
  if (opts.maxRepeat && hasRun(glyphs.map(g => g.ch), opts.maxRepeat)) {
    warnings.push(
      `One of your words repeats a character more than ${opts.maxRepeat} times in a row, ` +
      'which this platform rejects.'
    );
  }

  // --- the two figures ------------------------------------------------------
  const chosenWordBits = chosen.reduce((sum, w) => sum + wordEntropyBits(w), 0);
  const sepBits = log2(WORD_SEPARATORS.length);
  const digitBits = WORD_DIGITS * log2(10);
  const tailBits = tailIsSymbol ? log2(symbolPool.length) : log2(10);
  const padBits = padCount * log2(padPool.length || 1);
  const requiredBits = required.reduce((sum, r) => sum + log2(r.pool.length), 0);

  const secretBits = chosenWordBits + sepBits + digitBits + tailBits + padBits + requiredBits;
  const leakedBits = selectionBits(words.length, count) + sepBits + digitBits
                   + tailBits + padBits + requiredBits;

  const nominalPool = padPool.length || 1;
  const nominalBits = glyphs.length * log2(nominalPool);

  const factors: EntropyFactor[] = [
    {
      label: `${count} word${count === 1 ? '' : 's'} an attacker has to guess`,
      choices: Math.round(Math.pow(2, chosenWordBits)),
      bits: chosenWordBits
    },
    { label: 'separator', choices: WORD_SEPARATORS.length, bits: sepBits },
    { label: `${WORD_DIGITS} random digits`, choices: Math.pow(10, WORD_DIGITS), bits: digitBits },
    tailIsSymbol
      ? { label: `final symbol from ${symbolPool}`, choices: symbolPool.length, bits: tailBits }
      : { label: 'final digit (this platform rejects symbols)', choices: 10, bits: tailBits }
  ];
  required.forEach(r => factors.push({
    label: r.label, choices: r.pool.length, bits: log2(r.pool.length)
  }));
  if (padCount > 0) {
    factors.push({
      label: `${padCount} extra random characters`,
      choices: nominalPool,
      bits: padBits
    });
  }

  if (chosen.some(w => /^[a-z]+$/.test(w) && w.length > 3)) {
    warnings.push(
      'Plain lowercase words are capped at dictionary strength however long they are. ' +
      'Mixing in digits or symbols raises what each one is worth.'
    );
  }

  return {
    glyphs,
    entropy: {
      nominalBits,
      effectiveBits: secretBits,
      usesPersonalData: false,
      factors,
      leakedBits,
      leakedFactors: [
        {
          label: `which ${count} of your ${words.length} words, in order`,
          choices: Math.round(Math.pow(2, selectionBits(words.length, count))),
          bits: selectionBits(words.length, count)
        },
        { label: 'separator', choices: WORD_SEPARATORS.length, bits: sepBits },
        { label: `${WORD_DIGITS} random digits`, choices: Math.pow(10, WORD_DIGITS), bits: digitBits },
        { label: 'tail', choices: tailIsSymbol ? symbolPool.length : 10, bits: tailBits }
      ]
    } as any,
    warnings
  };
}
