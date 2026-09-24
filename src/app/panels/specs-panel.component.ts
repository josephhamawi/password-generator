import { Component, OnInit } from '@angular/core';

import { DbService } from '../data/db.service';
import { PlatformSpec, isStale, STALE_AFTER_DAYS } from '../data/platform-specs';

@Component({
  selector: 'app-specs-panel',
  templateUrl: './specs-panel.component.html',
  styleUrls: ['./specs-panel.component.scss']
})
export class SpecsPanelComponent implements OnInit {
  specs: PlatformSpec[] = [];
  editingId: string = null;
  draft: PlatformSpec = null;
  loading = true;
  filter = '';

  readonly staleAfterDays = STALE_AFTER_DAYS;

  constructor(private db: DbService) { }

  async ngOnInit(): Promise<void> {
    await this.db.init();
    this.reload();
    this.loading = false;
  }

  private reload(): void {
    this.specs = this.db.platforms();
  }

  get visible(): PlatformSpec[] {
    const q = this.filter.trim().toLowerCase();
    if (!q) { return this.specs; }
    return this.specs.filter(s => s.name.toLowerCase().indexOf(q) !== -1);
  }

  get staleCount(): number {
    const today = new Date();
    return this.specs.filter(s => isStale(s, today)).length;
  }

  stale(spec: PlatformSpec): boolean { return isStale(spec, new Date()); }

  edit(spec: PlatformSpec): void {
    this.editingId = spec.id;
    this.draft = { ...spec };
  }

  cancel(): void {
    this.editingId = null;
    this.draft = null;
  }

  onNum(key: string, event: any): void {
    const n = parseInt(event.target.value, 10);
    (this.draft as any)[key] = isNaN(n) ? 0 : n;
  }

  onText(key: string, event: any): void {
    (this.draft as any)[key] = event.target.value;
  }

  toggle(key: string): void {
    (this.draft as any)[key] = !(this.draft as any)[key];
  }

  /** Records that the user checked this against the platform today. */
  markVerifiedToday(): void {
    this.draft.verifiedOn = new Date().toISOString().slice(0, 10);
    this.draft.confidence = 'high';
  }

  async save(): Promise<void> {
    await this.db.savePlatform(this.draft);
    this.reload();
    this.cancel();
  }

  async reset(spec: PlatformSpec): Promise<void> {
    await this.db.resetPlatform(spec.id);
    this.reload();
    this.cancel();
  }
}
