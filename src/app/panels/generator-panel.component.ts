import { Component, OnInit } from '@angular/core';

import { DbService, Profile, EMPTY_PROFILE } from '../data/db.service';
import { VaultCryptoService } from '../data/vault-crypto.service';
import { WordsService } from '../data/words.service';
import {
  generateFromWords, symbolPoolFor, MIN_WORDS, WORD_DIGITS
} from '../data/word-engine';
import { PlatformSpec, isStale } from '../data/platform-specs';
import {
  GenerateRequest, GenerateResult, Glyph, generateRandom,
  requestForSpec, validateAgainstSpec, personalLeaks, strengthLabel
} from '../data/password-engine';

type Mode = 'random' | 'words';

const METER_SEGMENTS = 28;
const METER_MAX_BITS = 128;

@Component({
  selector: 'app-generator-panel',
  templateUrl: './generator-panel.component.html',
  styleUrls: ['./generator-panel.component.scss']
})
export class GeneratorPanelComponent implements OnInit {
  mode: Mode = 'random';

  platforms: PlatformSpec[] = [];
  spec: PlatformSpec = null;
  pickerOpen = false;

  profile: Profile = { ...EMPTY_PROFILE };

  length = 16;
  minLength = 8;
  maxLength = 64;
  useLower = true;
  useUpper = true;
  useDigit = true;
  useSymbol = true;
  avoidAmbiguous = false;
  requireEachSet = true;
  personalPadding = 0;
  readonly minWords = MIN_WORDS;
  readonly wordDigits = WORD_DIGITS;

  result: GenerateResult = null;
  specProblems: string[] = [];
  leaks: string[] = [];
  copied = false;
  saved = false;
  loading = true;

  readonly meterCells: number[] = [];
  private copyTimer: any = null;

  wordCount = 2;

  constructor(
    private db: DbService,
    private crypto: VaultCryptoService,
    private wordsSvc: WordsService
  ) {
    for (let i = 0; i < METER_SEGMENTS; i++) { this.meterCells.push(i); }
  }

  async ngOnInit(): Promise<void> {
    await this.db.init();
    this.refresh();
    this.loading = false;
    this.generate();
  }

  /**
   * Re-reads profile and specs from the database. The panel is no longer
   * destroyed on tab change, so edits made on the Profile or Specs tabs have
   * to be pulled in explicitly.
   */
  refresh(): void {
    this.platforms = this.db.platforms();
    this.profile = this.db.profile();
    if (!this.hasWords && this.mode === 'words') { this.mode = 'random'; }
    if (this.spec) {
      const fresh = this.db.platform(this.spec.id);
      if (fresh) { this.spec = fresh; }
    }
  }

  // ------------------------------------------------------------------ platform

  selectPlatform(spec: PlatformSpec): void {
    this.spec = spec;
    this.pickerOpen = false;
    if (spec) {
      this.minLength = spec.minLength;
      this.maxLength = spec.maxLength;
      this.length = Math.max(spec.minLength, Math.min(spec.maxLength, this.length));
    } else {
      this.minLength = 8;
      this.maxLength = 64;
    }
    this.generate();
  }

  clearPlatform(): void { this.selectPlatform(null); }

  isStaleSpec(spec: PlatformSpec): boolean {
    return spec ? isStale(spec, new Date()) : false;
  }

  // ---------------------------------------------------------------- generation

  baseRequest(): GenerateRequest {
    return {
      length: this.length,
      useLower: this.useLower,
      useUpper: this.useUpper,
      useDigit: this.useDigit,
      useSymbol: this.useSymbol,
      avoidAmbiguous: this.avoidAmbiguous,
      requireEachSet: this.requireEachSet,
      allowedSymbols: '',
      maxRepeat: 0
    };
  }

  generate(): void {
    let req = this.baseRequest();
    if (this.spec) { req = requestForSpec(this.spec, req); }

    this.result = this.mode === 'words'
      ? generateFromWords(this.wordsSvc.words, req, {
          wordCount: this.wordCount,
          padding: this.personalPadding,
          forceSymbol: !!this.spec && this.spec.requireSymbol,
          minLength: this.spec ? this.spec.minLength : 0,
          requireUpper: !!this.spec && this.spec.requireUpper,
          requireLower: !!this.spec && this.spec.requireLower,
          requireDigit: !!this.spec && this.spec.requireDigit,
          maxRepeat: this.spec ? this.spec.maxRepeat : 0
        })
      : generateRandom(req);

    const pw = this.password;
    this.specProblems = this.spec && pw ? validateAgainstSpec(pw, this.spec) : [];
    this.leaks = pw ? personalLeaks(pw, this.profile) : [];
    this.resetFlags();
  }

  setMode(mode: Mode): void {
    this.mode = mode;
    this.generate();
  }

  /** Word mode needs an unlocked vault and a saved list. */
  get hasWords(): boolean {
    return this.crypto.unlocked && this.wordsSvc.words.length >= MIN_WORDS;
  }

  get wordsHint(): string {
    if (!this.crypto.unlocked) { return 'Unlock the vault to use your words.'; }
    if (this.wordsSvc.words.length < MIN_WORDS) {
      return `Add at least ${MIN_WORDS} words on the Words tab.`;
    }
    return '';
  }

  get wordCountMax(): number {
    return Math.min(4, Math.max(1, this.wordsSvc.words.length));
  }

  onWordCountInput(event: any): void {
    this.wordCount = parseInt(event.target.value, 10);
    this.generate();
  }

  /** Whether the tail will be a symbol or a digit. */
  get tailIsSymbol(): boolean {
    const req = this.spec ? requestForSpec(this.spec, this.baseRequest()) : this.baseRequest();
    const force = !!this.spec && this.spec.requireSymbol;
    return (req.useSymbol || force) && symbolPoolFor(req.allowedSymbols).length > 0;
  }

  get tailPool(): string {
    const req = this.spec ? requestForSpec(this.spec, this.baseRequest()) : this.baseRequest();
    return symbolPoolFor(req.allowedSymbols);
  }

  // ------------------------------------------------------------------ readouts

  get glyphs(): Glyph[] { return this.result ? this.result.glyphs : []; }

  get password(): string {
    return this.glyphs.map(g => g.ch).join('');
  }

  get warnings(): string[] { return this.result ? this.result.warnings : []; }

  /** The number the meter trusts: effective bits whenever profile data is in play. */
  get realBits(): number {
    if (!this.result) { return 0; }
    return Math.round(this.result.entropy.effectiveBits);
  }

  get nominalBits(): number {
    return this.result ? Math.round(this.result.entropy.nominalBits) : 0;
  }

  get showsBothFigures(): boolean {
    return this.mode === 'words' && !!this.result && this.leakedBits > 0;
  }

  /** What survives if the word list itself is ever compromised. */
  get leakedBits(): number {
    const e: any = this.result ? this.result.entropy : null;
    return e && e.leakedBits ? Math.round(e.leakedBits) : 0;
  }

  get leakedFactors() {
    const e: any = this.result ? this.result.entropy : null;
    return e && e.leakedFactors ? e.leakedFactors : [];
  }

  get leakedStrength() { return strengthLabel(this.leakedBits); }

  /**
   * Choice counts run to 10^15 and beyond, where the digits stop meaning
   * anything. Anything past a million is shown in scientific form.
   */
  choices(n: number): string {
    if (!isFinite(n)) { return '\u221e'; }
    if (n < 1000000) { return String(Math.round(n)); }
    const exp = Math.floor(Math.log(n) / Math.LN10);
    const mantissa = n / Math.pow(10, exp);
    return mantissa.toFixed(1) + '\u00d710^' + exp;
  }

  get factors() { return this.result ? this.result.entropy.factors : []; }

  get litSegments(): number {
    return Math.round(Math.min(1, this.realBits / METER_MAX_BITS) * METER_SEGMENTS);
  }

  get strength() { return strengthLabel(this.realBits); }

  /** Rough offline-guessing time at 10^11 guesses/sec (a well-funded attacker). */
  get crackTime(): string {
    const bits = this.realBits;
    if (!bits) { return '-'; }
    const seconds = Math.pow(2, bits - 1) / 1e11;
    if (seconds < 1) { return 'instantly'; }
    if (seconds < 60) { return Math.round(seconds) + ' seconds'; }
    if (seconds < 3600) { return Math.round(seconds / 60) + ' minutes'; }
    if (seconds < 86400) { return Math.round(seconds / 3600) + ' hours'; }
    if (seconds < 31536000) { return Math.round(seconds / 86400) + ' days'; }
    const years = seconds / 31536000;
    if (years < 1000) { return Math.round(years) + ' years'; }
    if (years < 1e9) { return Math.round(years / 1000) + ' thousand years'; }
    return 'longer than the universe has existed';
  }

  isActive(cls: string): boolean {
    if (cls === 'lower') { return this.useLower; }
    if (cls === 'upper') { return this.useUpper; }
    if (cls === 'digit') { return this.useDigit; }
    return this.useSymbol;
  }

  // ------------------------------------------------------------------- actions

  toggleSet(cls: string): void {
    const on = [this.useLower, this.useUpper, this.useDigit, this.useSymbol].filter(Boolean).length;
    if (on === 1 && this.isActive(cls)) { return; }
    if (cls === 'lower') { this.useLower = !this.useLower; }
    if (cls === 'upper') { this.useUpper = !this.useUpper; }
    if (cls === 'digit') { this.useDigit = !this.useDigit; }
    if (cls === 'symbol') { this.useSymbol = !this.useSymbol; }
    this.generate();
  }

  onLengthInput(event: any): void {
    this.length = parseInt(event.target.value, 10);
    this.generate();
  }

  onPaddingInput(event: any): void {
    this.personalPadding = parseInt(event.target.value, 10);
    this.generate();
  }

  copy(): void {
    const text = this.password;
    if (!text) { return; }
    const nav: any = window.navigator;
    if (nav.clipboard && nav.clipboard.writeText) {
      nav.clipboard.writeText(text).then(() => this.flagCopied(), () => this.legacyCopy(text));
    } else {
      this.legacyCopy(text);
    }
  }

  private legacyCopy(text: string): void {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    try { document.execCommand('copy'); this.flagCopied(); } catch (e) { /* blocked */ }
    document.body.removeChild(field);
  }

  private flagCopied(): void {
    this.copied = true;
    if (this.copyTimer) { clearTimeout(this.copyTimer); }
    this.copyTimer = setTimeout(() => { this.copied = false; this.copyTimer = null; }, 1600);
  }

  private resetFlags(): void {
    this.copied = false;
    this.saved = false;
    if (this.copyTimer) { clearTimeout(this.copyTimer); this.copyTimer = null; }
  }

  get canSave(): boolean {
    return !!this.password && !!this.spec && this.crypto.unlocked;
  }

  get saveHint(): string {
    if (!this.spec) { return 'Pick a platform to save this against.'; }
    if (!this.crypto.unlocked) { return 'Unlock the vault first, on the Vault tab.'; }
    return '';
  }

  async saveToVault(): Promise<void> {
    if (!this.canSave) { return; }
    const sealed = await this.crypto.seal(this.password);
    const fingerprint = await this.crypto.reuseFingerprint(this.password);
    await this.db.addVaultEntry({
      platformId: this.spec.id,
      label: '',
      iv: sealed.iv,
      cipher: sealed.cipher,
      fingerprint,
      isCurrent: 1,
      createdAt: new Date().toISOString()
    });
    this.saved = true;
  }
}
