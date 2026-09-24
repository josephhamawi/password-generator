import { Injectable } from '@angular/core';

import { PLATFORM_SPECS, PlatformSpec } from './platform-specs';
import { Sealed } from './vault-crypto.service';

declare const initSqlJs: any;

const SCHEMA_VERSION = 1;
const IDB_NAME = 'passgen';
const IDB_STORE = 'sqlite';
const IDB_KEY = 'db';

export interface Profile {
  firstName: string;
  lastName: string;
  birthDate: string;
  country: string;
  city: string;
  school: string;
  field: string;
}

export const EMPTY_PROFILE: Profile = {
  firstName: '', lastName: '', birthDate: '',
  country: '', city: '', school: '', field: ''
};

export interface VaultEntry {
  id?: number;
  platformId: string;
  label: string;
  iv: string;
  cipher: string;
  fingerprint: string;
  isCurrent: number;
  createdAt: string;
}

/**
 * SQLite in the browser, via sql.js (SQLite compiled to WebAssembly).
 *
 * sql.js keeps the whole database in memory, so it is exported to a byte array
 * and parked in IndexedDB after every write. IndexedDB is used purely as a
 * container for that blob -- all querying is real SQL.
 */
@Injectable({ providedIn: 'root' })
export class DbService {
  private db: any = null;
  private ready: Promise<void> = null;

  init(): Promise<void> {
    if (!this.ready) { this.ready = this.boot(); }
    return this.ready;
  }

  private async boot(): Promise<void> {
    const SQL = await initSqlJs({ locateFile: (f: string) => 'assets/sql/' + f });
    const saved = await this.loadBytes();
    this.db = saved ? new SQL.Database(saved) : new SQL.Database();
    this.migrate();
    await this.persist();
  }

  private migrate(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS profile (
        id          INTEGER PRIMARY KEY CHECK (id = 1),
        first_name  TEXT NOT NULL DEFAULT '',
        last_name   TEXT NOT NULL DEFAULT '',
        birth_date  TEXT NOT NULL DEFAULT '',
        country     TEXT NOT NULL DEFAULT '',
        city        TEXT NOT NULL DEFAULT '',
        school      TEXT NOT NULL DEFAULT '',
        field       TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS platform (
        id              TEXT PRIMARY KEY,
        name            TEXT NOT NULL,
        slug            TEXT NOT NULL,
        min_length      INTEGER NOT NULL,
        max_length      INTEGER NOT NULL,
        require_upper   INTEGER NOT NULL DEFAULT 0,
        require_lower   INTEGER NOT NULL DEFAULT 0,
        require_digit   INTEGER NOT NULL DEFAULT 0,
        require_symbol  INTEGER NOT NULL DEFAULT 0,
        allowed_symbols TEXT NOT NULL DEFAULT '',
        max_repeat      INTEGER NOT NULL DEFAULT 0,
        passwordless    INTEGER NOT NULL DEFAULT 0,
        notes           TEXT NOT NULL DEFAULT '',
        source_url      TEXT NOT NULL DEFAULT '',
        verified_on     TEXT NOT NULL DEFAULT '',
        confidence      TEXT NOT NULL DEFAULT 'medium',
        user_edited     INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS vault (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        platform_id  TEXT NOT NULL,
        label        TEXT NOT NULL DEFAULT '',
        iv           TEXT NOT NULL,
        cipher       TEXT NOT NULL,
        fingerprint  TEXT NOT NULL DEFAULT '',
        is_current   INTEGER NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS vault_platform ON vault (platform_id);
      CREATE INDEX IF NOT EXISTS vault_fingerprint ON vault (fingerprint);
    `);

    this.db.run(`INSERT OR IGNORE INTO profile (id) VALUES (1);`);
    this.db.run(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?);`,
      [String(SCHEMA_VERSION)]);

    this.seedPlatforms();
  }

  /**
   * Refreshes the built-in catalogue without touching rows the user has edited.
   * That is what makes updating platform-specs.ts a safe operation.
   */
  private seedPlatforms(): void {
    PLATFORM_SPECS.forEach(s => {
      this.db.run(
        `INSERT INTO platform (id, name, slug, min_length, max_length, require_upper,
           require_lower, require_digit, require_symbol, allowed_symbols, max_repeat,
           passwordless, notes, source_url, verified_on, confidence, user_edited)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
         ON CONFLICT(id) DO UPDATE SET
           name=excluded.name, slug=excluded.slug, min_length=excluded.min_length,
           max_length=excluded.max_length, require_upper=excluded.require_upper,
           require_lower=excluded.require_lower, require_digit=excluded.require_digit,
           require_symbol=excluded.require_symbol, allowed_symbols=excluded.allowed_symbols,
           max_repeat=excluded.max_repeat, passwordless=excluded.passwordless,
           notes=excluded.notes, source_url=excluded.source_url,
           verified_on=excluded.verified_on, confidence=excluded.confidence
         WHERE platform.user_edited = 0;`,
        [s.id, s.name, s.slug, s.minLength, s.maxLength, s.requireUpper ? 1 : 0,
         s.requireLower ? 1 : 0, s.requireDigit ? 1 : 0, s.requireSymbol ? 1 : 0,
         s.allowedSymbols, s.maxRepeat, s.passwordless ? 1 : 0, s.notes,
         s.sourceUrl, s.verifiedOn, s.confidence]
      );
    });
  }

  // -------------------------------------------------------------------- queries

  platforms(): PlatformSpec[] {
    return this.select(`SELECT * FROM platform ORDER BY name COLLATE NOCASE;`)
      .map(r => this.toSpec(r));
  }

  platform(id: string): PlatformSpec {
    const rows = this.select(`SELECT * FROM platform WHERE id = ?;`, [id]);
    return rows.length ? this.toSpec(rows[0]) : null;
  }

  async savePlatform(spec: PlatformSpec): Promise<void> {
    this.db.run(
      `UPDATE platform SET min_length=?, max_length=?, require_upper=?, require_lower=?,
         require_digit=?, require_symbol=?, allowed_symbols=?, max_repeat=?,
         notes=?, source_url=?, verified_on=?, confidence=?, user_edited=1
       WHERE id=?;`,
      [spec.minLength, spec.maxLength, spec.requireUpper ? 1 : 0, spec.requireLower ? 1 : 0,
       spec.requireDigit ? 1 : 0, spec.requireSymbol ? 1 : 0, spec.allowedSymbols,
       spec.maxRepeat, spec.notes, spec.sourceUrl, spec.verifiedOn, spec.confidence, spec.id]
    );
    await this.persist();
  }

  /** Drops the user's overrides for one platform and restores the built-in row. */
  async resetPlatform(id: string): Promise<void> {
    this.db.run(`UPDATE platform SET user_edited = 0 WHERE id = ?;`, [id]);
    this.seedPlatforms();
    await this.persist();
  }

  profile(): Profile {
    const rows = this.select(`SELECT * FROM profile WHERE id = 1;`);
    if (!rows.length) { return { ...EMPTY_PROFILE }; }
    const r = rows[0];
    return {
      firstName: r.first_name, lastName: r.last_name, birthDate: r.birth_date,
      country: r.country, city: r.city, school: r.school, field: r.field
    };
  }

  async saveProfile(p: Profile): Promise<void> {
    this.db.run(
      `UPDATE profile SET first_name=?, last_name=?, birth_date=?, country=?,
         city=?, school=?, field=? WHERE id=1;`,
      [p.firstName, p.lastName, p.birthDate, p.country, p.city, p.school, p.field]
    );
    await this.persist();
  }

  async clearProfile(): Promise<void> {
    await this.saveProfile({ ...EMPTY_PROFILE });
  }

  vaultEntries(): VaultEntry[] {
    return this.select(
      `SELECT * FROM vault ORDER BY is_current DESC, created_at DESC;`
    ).map(r => ({
      id: r.id, platformId: r.platform_id, label: r.label, iv: r.iv, cipher: r.cipher,
      fingerprint: r.fingerprint, isCurrent: r.is_current, createdAt: r.created_at
    }));
  }

  async addVaultEntry(e: VaultEntry): Promise<void> {
    if (e.isCurrent) {
      // Only one current password per platform; the rest become history.
      this.db.run(`UPDATE vault SET is_current = 0 WHERE platform_id = ?;`, [e.platformId]);
    }
    this.db.run(
      `INSERT INTO vault (platform_id, label, iv, cipher, fingerprint, is_current, created_at)
       VALUES (?,?,?,?,?,?,?);`,
      [e.platformId, e.label, e.iv, e.cipher, e.fingerprint, e.isCurrent ? 1 : 0, e.createdAt]
    );
    await this.persist();
  }

  async deleteVaultEntry(id: number): Promise<void> {
    this.db.run(`DELETE FROM vault WHERE id = ?;`, [id]);
    await this.persist();
  }

  /** Fingerprints that appear on more than one platform. */
  reusedFingerprints(): { [fp: string]: number } {
    const rows = this.select(
      `SELECT fingerprint, COUNT(DISTINCT platform_id) AS n
         FROM vault WHERE fingerprint <> ''
        GROUP BY fingerprint HAVING n > 1;`
    );
    const out: { [fp: string]: number } = {};
    rows.forEach(r => { out[r.fingerprint] = r.n; });
    return out;
  }

  meta(key: string): string {
    const rows = this.select(`SELECT value FROM meta WHERE key = ?;`, [key]);
    return rows.length ? rows[0].value : null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    this.db.run(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?);`, [key, value]);
    await this.persist();
  }

  /**
   * The word list is key material -- it is reused across every password it
   * generates -- so it is stored as a single AES-GCM blob under the vault key,
   * never in plaintext.
   */
  wordsSealed(): Sealed {
    const raw = this.meta('words_sealed');
    return raw ? JSON.parse(raw) : null;
  }

  async setWordsSealed(sealed: Sealed): Promise<void> {
    await this.setMeta('words_sealed', JSON.stringify(sealed));
  }

  async clearWords(): Promise<void> {
    this.db.run(`DELETE FROM meta WHERE key = 'words_sealed';`);
    await this.persist();
  }

  vaultSalt(): string { return this.meta('vault_salt'); }

  vaultVerifier(): Sealed {
    const raw = this.meta('vault_verifier');
    return raw ? JSON.parse(raw) : null;
  }

  async setVaultKeyMaterial(salt: string, verifier: Sealed): Promise<void> {
    await this.setMeta('vault_salt', salt);
    await this.setMeta('vault_verifier', JSON.stringify(verifier));
  }

  /** Wipes every stored password but leaves platform specs and profile alone. */
  async wipeVault(): Promise<void> {
    this.db.run(`DELETE FROM vault;`);
    this.db.run(`DELETE FROM meta WHERE key IN ('vault_salt','vault_verifier','words_sealed');`);
    await this.persist();
  }

  exportBytes(): Uint8Array {
    return this.db.export();
  }

  // ------------------------------------------------------------------ internals

  private toSpec(r: any): PlatformSpec {
    return {
      id: r.id, name: r.name, slug: r.slug,
      minLength: r.min_length, maxLength: r.max_length,
      requireUpper: !!r.require_upper, requireLower: !!r.require_lower,
      requireDigit: !!r.require_digit, requireSymbol: !!r.require_symbol,
      allowedSymbols: r.allowed_symbols, maxRepeat: r.max_repeat,
      passwordless: !!r.passwordless, notes: r.notes, sourceUrl: r.source_url,
      verifiedOn: r.verified_on, confidence: r.confidence
    };
  }

  private select(sql: string, params: any[] = []): any[] {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const out: any[] = [];
    while (stmt.step()) { out.push(stmt.getAsObject()); }
    stmt.free();
    return out;
  }

  private async persist(): Promise<void> {
    await this.saveBytes(this.db.export());
  }

  private idb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) { db.createObjectStore(IDB_STORE); }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async loadBytes(): Promise<Uint8Array> {
    try {
      const db = await this.idb();
      return await new Promise<Uint8Array>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
        req.onsuccess = () => resolve(req.result ? new Uint8Array(req.result) : null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      return null;
    }
  }

  private async saveBytes(bytes: Uint8Array): Promise<void> {
    try {
      const db = await this.idb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      // Storage can be denied (private mode, quota). The in-memory DB still works
      // for this session; surfacing a hard failure here would block the whole app.
    }
  }
}
