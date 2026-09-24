import { Injectable } from '@angular/core';

/**
 * Vault encryption.
 *
 * The master password is stretched with PBKDF2-HMAC-SHA256 into an AES-GCM key
 * that exists only in memory for the life of the tab. Nothing derived from the
 * master password is ever written to disk: the database stores the salt, a
 * verifier blob, and ciphertext.
 *
 * Consequences worth being explicit about:
 *  - Forgetting the master password means the vault is unrecoverable. There is
 *    no reset, because a reset would mean the key was recoverable without it.
 *  - This protects the database file at rest. It cannot protect against malware
 *    running in this browser profile while the vault is unlocked.
 */

/** OWASP's 2023 floor for PBKDF2-HMAC-SHA256. */
export const PBKDF2_ITERATIONS = 310000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const VERIFIER_PLAINTEXT = 'passgen.vault.v1';

export interface Sealed {
  iv: string;
  cipher: string;
}

interface KeyPair {
  key: CryptoKey;
  macKey: CryptoKey;
}

@Injectable({ providedIn: 'root' })
export class VaultCryptoService {
  private key: CryptoKey = null;
  private macKey: CryptoKey = null;

  /** Called whenever the vault locks, so holders of decrypted data can drop it. */
  private lockListeners: Array<() => void> = [];

  onLock(fn: () => void): void {
    this.lockListeners.push(fn);
  }

  get unlocked(): boolean {
    return this.key !== null;
  }

  get available(): boolean {
    const c: any = window.crypto;
    return !!(c && c.subtle && c.subtle.deriveKey);
  }

  newSalt(): string {
    const salt = new Uint8Array(SALT_BYTES);
    window.crypto.getRandomValues(salt);
    return this.toBase64(salt);
  }

  /** Derives and caches the key. Returns false if the verifier does not match. */
  async unlock(masterPassword: string, saltB64: string, verifier: Sealed): Promise<boolean> {
    const pair = await this.deriveKeys(masterPassword, saltB64);
    if (verifier) {
      try {
        const plain = await this.openWith(pair.key, verifier);
        if (plain !== VERIFIER_PLAINTEXT) { return false; }
      } catch (e) {
        // AES-GCM authentication failure -- wrong master password.
        return false;
      }
    }
    this.key = pair.key;
    this.macKey = pair.macKey;
    return true;
  }

  async createVerifier(masterPassword: string, saltB64: string): Promise<Sealed> {
    const pair = await this.deriveKeys(masterPassword, saltB64);
    const verifier = await this.sealWith(pair.key, VERIFIER_PLAINTEXT);
    this.key = pair.key;
    this.macKey = pair.macKey;
    return verifier;
  }

  lock(): void {
    this.key = null;
    this.macKey = null;
    this.lockListeners.forEach(fn => fn());
  }

  async seal(plaintext: string): Promise<Sealed> {
    if (!this.key) { throw new Error('Vault is locked.'); }
    return this.sealWith(this.key, plaintext);
  }

  async open(sealed: Sealed): Promise<string> {
    if (!this.key) { throw new Error('Vault is locked.'); }
    return this.openWith(this.key, sealed);
  }

  /**
   * A keyed fingerprint, used only to spot the same password reused across
   * platforms.
   *
   * This was originally a bare SHA-256 of the password, which was a mistake: an
   * unsalted fast hash sitting in the same database as the ciphertext hands an
   * attacker who obtains the file an offline target far cheaper than the
   * 310,000-round PBKDF2 key, and defeats the encryption for any password weak
   * enough to appear in a breach list.
   *
   * HMAC-SHA256 under a key derived from the master password keeps the property
   * that matters (identical passwords produce identical values, so duplicates
   * still collide) while making the stored value useless without the master
   * password.
   */
  async reuseFingerprint(plaintext: string): Promise<string> {
    if (!this.macKey) { throw new Error('Vault is locked.'); }
    const mac = await window.crypto.subtle.sign('HMAC', this.macKey, this.encode(plaintext));
    return this.toBase64(new Uint8Array(mac));
  }

  // ------------------------------------------------------------------ internals

  /**
   * One PBKDF2 pass produces 512 bits, split into an AES-GCM encryption key and
   * a separate HMAC key for fingerprints. Deriving both from one pass keeps the
   * unlock cost unchanged while keeping the two uses domain-separated.
   */
  private async deriveKeys(masterPassword: string, saltB64: string): Promise<KeyPair> {
    const material = await window.crypto.subtle.importKey(
      'raw', this.encode(masterPassword), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await window.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: this.fromBase64(saltB64),
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      material,
      512
    );
    const raw = new Uint8Array(bits);
    const key = await window.crypto.subtle.importKey(
      'raw', raw.slice(0, 32), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
    const macKey = await window.crypto.subtle.importKey(
      'raw', raw.slice(32, 64), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    return { key, macKey };
  }

  private async sealWith(key: CryptoKey, plaintext: string): Promise<Sealed> {
    const iv = new Uint8Array(IV_BYTES);
    window.crypto.getRandomValues(iv);
    const cipher = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, this.encode(plaintext)
    );
    return { iv: this.toBase64(iv), cipher: this.toBase64(new Uint8Array(cipher)) };
  }

  private async openWith(key: CryptoKey, sealed: Sealed): Promise<string> {
    const plain = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.fromBase64(sealed.iv) },
      key,
      this.fromBase64(sealed.cipher)
    );
    return this.decode(new Uint8Array(plain));
  }

  private encode(text: string): Uint8Array {
    return new (window as any).TextEncoder().encode(text);
  }

  private decode(bytes: Uint8Array): string {
    return new (window as any).TextDecoder().decode(bytes);
  }

  private toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) { binary += String.fromCharCode(bytes[i]); }
    return window.btoa(binary);
  }

  private fromBase64(value: string): Uint8Array {
    const binary = window.atob(value);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) { out[i] = binary.charCodeAt(i); }
    return out;
  }
}
