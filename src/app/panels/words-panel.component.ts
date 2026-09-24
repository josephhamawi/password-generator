import { Component, OnInit } from '@angular/core';

import { DbService } from '../data/db.service';
import { VaultCryptoService } from '../data/vault-crypto.service';
import { WordsService } from '../data/words.service';
import { wordEntropyBits, dictionaryCore, MIN_WORDS, MAX_WORDS, HUMAN_VOCAB } from '../data/word-engine';

@Component({
  selector: 'app-words-panel',
  templateUrl: './words-panel.component.html',
  styleUrls: ['./words-panel.component.scss']
})
export class WordsPanelComponent implements OnInit {
  draft: string[] = [];
  saved = false;
  error: string = null;
  loading = true;

  readonly min = MIN_WORDS;
  readonly max = MAX_WORDS;
  readonly humanVocab = HUMAN_VOCAB;

  constructor(
    private db: DbService,
    private crypto: VaultCryptoService,
    private words: WordsService
  ) { }

  async ngOnInit(): Promise<void> {
    await this.db.init();
    await this.reload();
    this.loading = false;
  }

  async reload(): Promise<void> {
    if (!this.crypto.unlocked) { this.draft = []; return; }
    await this.words.load();
    this.draft = this.words.words.slice();
    while (this.draft.length < this.min) { this.draft.push(''); }
  }

  get unlocked(): boolean { return this.crypto.unlocked; }

  get filled(): string[] {
    return this.draft.map(w => (w || '').trim()).filter(w => w.length > 0);
  }

  get canSave(): boolean {
    return this.unlocked && this.filled.length >= this.min;
  }

  get canAdd(): boolean { return this.draft.length < this.max; }

  add(): void { if (this.canAdd) { this.draft.push(''); } }

  remove(i: number): void {
    this.draft.splice(i, 1);
    this.saved = false;
  }

  onInput(i: number, event: any): void {
    this.draft[i] = event.target.value;
    this.saved = false;
  }

  /** What one word is worth against someone who does not have the list. */
  bitsFor(word: string): number {
    return Math.round(wordEntropyBits((word || '').trim()) * 10) / 10;
  }

  /** True when the entry is a manglable dictionary word rather than a string. */
  isPlainWord(word: string): boolean {
    return dictionaryCore((word || '').trim()).length >= 3;
  }

  get totalBits(): number {
    return Math.round(this.filled.reduce((s, w) => s + wordEntropyBits(w), 0));
  }

  async save(): Promise<void> {
    this.error = null;
    if (!this.canSave) {
      this.error = `Enter at least ${this.min} words.`;
      return;
    }
    await this.words.save(this.draft);
    this.draft = this.words.words.slice();
    this.saved = true;
  }

  async forget(): Promise<void> {
    await this.words.forget();
    this.draft = [];
    while (this.draft.length < this.min) { this.draft.push(''); }
    this.saved = false;
  }
}
