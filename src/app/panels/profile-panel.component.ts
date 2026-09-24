import { Component, OnInit } from '@angular/core';

import { DbService, Profile, EMPTY_PROFILE } from '../data/db.service';
import { profileTokens, birthNumbers } from '../data/password-engine';

@Component({
  selector: 'app-profile-panel',
  templateUrl: './profile-panel.component.html',
  styleUrls: ['./profile-panel.component.scss']
})
export class ProfilePanelComponent implements OnInit {
  profile: Profile = { ...EMPTY_PROFILE };
  saved = false;
  loading = true;

  fields = [
    { key: 'firstName', label: 'First name', type: 'text', placeholder: '' },
    { key: 'lastName', label: 'Last name', type: 'text', placeholder: '' },
    { key: 'birthDate', label: 'Date of birth', type: 'date', placeholder: '' },
    { key: 'country', label: 'Country', type: 'text', placeholder: '' },
    { key: 'city', label: 'City', type: 'text', placeholder: '' },
    { key: 'school', label: 'School', type: 'text', placeholder: '' },
    { key: 'field', label: 'Field of study or work', type: 'text', placeholder: '' }
  ];

  constructor(private db: DbService) { }

  async ngOnInit(): Promise<void> {
    await this.db.init();
    this.profile = this.db.profile();
    this.loading = false;
  }

  value(key: string): string {
    return (this.profile as any)[key] || '';
  }

  onInput(key: string, event: any): void {
    (this.profile as any)[key] = event.target.value;
    this.saved = false;
  }

  /** Exactly the words a targeted wordlist would be built from. */
  get tokens(): string[] {
    return profileTokens(this.profile).map(t => t.value);
  }

  get numbers(): string[] {
    return birthNumbers(this.profile);
  }

  get tokenCount(): number {
    return this.tokens.length + this.numbers.length;
  }

  async save(): Promise<void> {
    await this.db.saveProfile(this.profile);
    this.saved = true;
  }

  async clear(): Promise<void> {
    await this.db.clearProfile();
    this.profile = this.db.profile();
    this.saved = true;
  }
}
