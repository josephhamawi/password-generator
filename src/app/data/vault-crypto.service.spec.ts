import { TestBed } from '@angular/core/testing';

import { VaultCryptoService } from './vault-crypto.service';

describe('VaultCryptoService', () => {
  let crypto: VaultCryptoService;
  const MASTER = 'correct-horse-battery-staple';

  beforeEach(() => {
    TestBed.configureTestingModule({});
    crypto = TestBed.get(VaultCryptoService);
  });

  async function opened(): Promise<string> {
    const salt = crypto.newSalt();
    await crypto.createVerifier(MASTER, salt);
    return salt;
  }

  it('round-trips a secret', async () => {
    await opened();
    const sealed = await crypto.seal('hunter2');
    expect(await crypto.open(sealed)).toBe('hunter2');
  });

  it('uses a fresh IV for every encryption', async () => {
    await opened();
    const a = await crypto.seal('same input');
    const b = await crypto.seal('same input');
    expect(a.iv).not.toBe(b.iv);
    expect(a.cipher).not.toBe(b.cipher);
  });

  it('rejects the wrong master password', async () => {
    const salt = crypto.newSalt();
    const verifier = await crypto.createVerifier(MASTER, salt);
    crypto.lock();
    expect(await crypto.unlock('not the password', salt, verifier)).toBe(false);
    expect(crypto.unlocked).toBe(false);
  });

  it('accepts the right one and restores the key', async () => {
    const salt = crypto.newSalt();
    const verifier = await crypto.createVerifier(MASTER, salt);
    const sealed = await crypto.seal('kept');
    crypto.lock();
    expect(await crypto.unlock(MASTER, salt, verifier)).toBe(true);
    expect(await crypto.open(sealed)).toBe('kept');
  });

  describe('reuse fingerprint', () => {
    it('collides for identical passwords so reuse is detectable', async () => {
      await opened();
      expect(await crypto.reuseFingerprint('abc')).toBe(await crypto.reuseFingerprint('abc'));
      expect(await crypto.reuseFingerprint('abc')).not.toBe(await crypto.reuseFingerprint('abd'));
    });

    /**
     * Regression for the audit finding. The fingerprint used to be a bare
     * SHA-256 of the password, stored in plaintext beside the ciphertext, which
     * gave anyone holding the database file a fast offline target far cheaper
     * than the PBKDF2 key.
     */
    it('is not a bare SHA-256 of the password', async () => {
      await opened();
      const fp = await crypto.reuseFingerprint('password123');

      const digest = await window.crypto.subtle.digest(
        'SHA-256', new (window as any).TextEncoder().encode('password123')
      );
      const bytes = new Uint8Array(digest);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) { binary += String.fromCharCode(bytes[i]); }
      expect(fp).not.toBe(window.btoa(binary));
    });

    it('differs between two vaults with different master passwords', async () => {
      const saltA = crypto.newSalt();
      await crypto.createVerifier('master one', saltA);
      const a = await crypto.reuseFingerprint('shared');

      crypto.lock();
      const saltB = crypto.newSalt();
      await crypto.createVerifier('master two', saltB);
      const b = await crypto.reuseFingerprint('shared');

      expect(a).not.toBe(b);
    });

    it('cannot be computed while the vault is locked', async () => {
      await opened();
      crypto.lock();
      let threw = false;
      try { await crypto.reuseFingerprint('abc'); } catch (e) { threw = true; }
      expect(threw).toBe(true);
    });
  });

  it('notifies listeners on lock so decrypted data can be dropped', async () => {
    let notified = false;
    crypto.onLock(() => { notified = true; });
    await opened();
    crypto.lock();
    expect(notified).toBe(true);
  });

  it('drops both keys on lock', async () => {
    await opened();
    const sealed = await crypto.seal('x');
    crypto.lock();
    expect(crypto.unlocked).toBe(false);
    let threw = false;
    try { await crypto.open(sealed); } catch (e) { threw = true; }
    expect(threw).toBe(true);
  });
});
