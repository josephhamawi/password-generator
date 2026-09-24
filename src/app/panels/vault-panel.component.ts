import { Component, OnInit } from '@angular/core';

import { DbService, VaultEntry } from '../data/db.service';
import { VaultCryptoService } from '../data/vault-crypto.service';
import { PlatformSpec } from '../data/platform-specs';
import { BRAND_MARKS } from '../data/platform-logos';

interface Row {
  entry: VaultEntry;
  platformName: string;
  slug: string;
  revealed: string;
  reusedOn: number;
}

@Component({
  selector: 'app-vault-panel',
  templateUrl: './vault-panel.component.html',
  styleUrls: ['./vault-panel.component.scss']
})
export class VaultPanelComponent implements OnInit {
  loading = true;
  hasVault = false;
  unlocked = false;
  error: string = null;
  busy = false;

  masterPassword = '';
  masterConfirm = '';

  rows: Row[] = [];
  platforms: PlatformSpec[] = [];

  // add-entry form
  newPlatformId = '';
  newPassword = '';
  newIsCurrent = true;
  newLabel = '';

  constructor(private db: DbService, private crypto: VaultCryptoService) { }

  async ngOnInit(): Promise<void> {
    await this.db.init();
    this.platforms = this.db.platforms();
    this.hasVault = !!this.db.vaultSalt();
    this.unlocked = this.crypto.unlocked;
    this.loading = false;
    if (this.unlocked) { await this.load(); }
  }

  get cryptoAvailable(): boolean { return this.crypto.available; }

  // -------------------------------------------------------------- lock/unlock

  async createVault(): Promise<void> {
    this.error = null;
    if (this.masterPassword.length < 10) {
      this.error = 'Use at least 10 characters for the master password.';
      return;
    }
    if (this.masterPassword !== this.masterConfirm) {
      this.error = 'The two master passwords do not match.';
      return;
    }
    this.busy = true;
    const salt = this.crypto.newSalt();
    const verifier = await this.crypto.createVerifier(this.masterPassword, salt);
    await this.db.setVaultKeyMaterial(salt, verifier);
    this.masterPassword = '';
    this.masterConfirm = '';
    this.hasVault = true;
    this.unlocked = true;
    this.busy = false;
    await this.load();
  }

  onMasterInput(): void {
    this.error = null;
  }

  async unlock(): Promise<void> {
    this.error = null;
    this.busy = true;
    const ok = await this.crypto.unlock(
      this.masterPassword, this.db.vaultSalt(), this.db.vaultVerifier()
    );
    this.busy = false;
    if (!ok) {
      // Clear it here too: a rejected attempt should not leave the string
      // sitting in component state and bound to the input.
      this.masterPassword = '';
      this.error = 'That master password does not match this vault.';
      return;
    }
    this.masterPassword = '';
    this.unlocked = true;
    await this.load();
  }

  lock(): void {
    this.crypto.lock();
    this.unlocked = false;
    this.rows = [];
  }

  // -------------------------------------------------------------------- data

  private async load(): Promise<void> {
    const reused = this.db.reusedFingerprints();
    const byId: { [id: string]: PlatformSpec } = {};
    this.platforms.forEach(p => { byId[p.id] = p; });

    const entries = this.db.vaultEntries();
    const rows: Row[] = [];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const p = byId[e.platformId];
      rows.push({
        entry: e,
        platformName: p ? p.name : e.platformId,
        slug: p ? p.slug : '',
        revealed: null,
        reusedOn: reused[e.fingerprint] || 0
      });
    }
    this.rows = rows;
  }

  async reveal(row: Row): Promise<void> {
    if (row.revealed) { row.revealed = null; return; }
    try {
      row.revealed = await this.crypto.open({ iv: row.entry.iv, cipher: row.entry.cipher });
    } catch (e) {
      this.error = 'Could not decrypt that entry.';
    }
  }

  copy(row: Row): void {
    if (!row.revealed) { return; }
    const nav: any = window.navigator;
    if (nav.clipboard && nav.clipboard.writeText) { nav.clipboard.writeText(row.revealed); }
  }

  async addEntry(): Promise<void> {
    this.error = null;
    if (!this.newPlatformId) { this.error = 'Pick a platform.'; return; }
    if (!this.newPassword) { this.error = 'Enter the password to store.'; return; }

    this.busy = true;
    const sealed = await this.crypto.seal(this.newPassword);
    const fingerprint = await this.crypto.reuseFingerprint(this.newPassword);
    await this.db.addVaultEntry({
      platformId: this.newPlatformId,
      label: this.newLabel,
      iv: sealed.iv,
      cipher: sealed.cipher,
      fingerprint,
      isCurrent: this.newIsCurrent ? 1 : 0,
      createdAt: new Date().toISOString()
    });
    this.newPassword = '';
    this.newLabel = '';
    this.busy = false;
    await this.load();
  }

  async remove(row: Row): Promise<void> {
    await this.db.deleteVaultEntry(row.entry.id);
    await this.load();
  }

  async wipe(): Promise<void> {
    await this.db.wipeVault();
    this.crypto.lock();
    this.hasVault = false;
    this.unlocked = false;
    this.rows = [];
  }

  get reuseCount(): number {
    return this.rows.filter(r => r.reusedOn > 1).length;
  }

  hasMark(slug: string): boolean { return !!BRAND_MARKS[slug]; }

  shortDate(iso: string): string { return (iso || '').slice(0, 10); }
}
