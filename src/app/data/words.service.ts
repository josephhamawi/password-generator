import { Injectable } from '@angular/core';

import { DbService } from './db.service';
import { VaultCryptoService } from './vault-crypto.service';
import { Wordlist } from './password-engine';
import { MIN_WORDS, MAX_WORDS } from './word-engine';

/**
 * The user's private word list.
 *
 * Held in memory only while the vault is unlocked, and written back as a single
 * encrypted blob. It is deliberately coupled to the vault: the list is the
 * secret that every generated password leans on, so it gets the same protection
 * as the passwords themselves.
 */
@Injectable({ providedIn: 'root' })
export class WordsService {
  words: Wordlist = [];
  loaded = false;

  constructor(private db: DbService, private crypto: VaultCryptoService) {
    // Locking the vault has to drop the decrypted list too. Without this the
    // words stayed in memory after "Lock", so the button claimed more than it did.
    this.crypto.onLock(() => this.lock());
  }

  get stored(): boolean {
    return !!this.db.wordsSealed();
  }

  get usable(): boolean {
    return this.loaded && this.words.length >= MIN_WORDS;
  }

  get min(): number { return MIN_WORDS; }
  get max(): number { return MAX_WORDS; }

  async load(): Promise<void> {
    if (!this.crypto.unlocked) { this.loaded = false; return; }
    const sealed = this.db.wordsSealed();
    if (!sealed) { this.words = []; this.loaded = true; return; }
    try {
      this.words = JSON.parse(await this.crypto.open(sealed));
      this.loaded = true;
    } catch (e) {
      this.words = [];
      this.loaded = false;
    }
  }

  async save(words: Wordlist): Promise<void> {
    if (!this.crypto.unlocked) { throw new Error('Vault is locked.'); }
    const clean = words.map(w => (w || '').trim()).filter(w => w.length > 0).slice(0, MAX_WORDS);
    this.words = clean;
    await this.db.setWordsSealed(await this.crypto.seal(JSON.stringify(clean)));
    this.loaded = true;
  }

  async forget(): Promise<void> {
    this.words = [];
    this.loaded = false;
    await this.db.clearWords();
  }

  lock(): void {
    this.words = [];
    this.loaded = false;
  }
}
