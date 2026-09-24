import { Injectable } from '@angular/core';

export type ThemeChoice = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'passgen.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Drives the `data-theme` attribute on <html>.
 *
 * Light is the explicit default: a first-time visitor always gets light, even on
 * a machine set to dark. The system preference is honoured only when the user
 * deliberately picks "system".
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  choice: ThemeChoice = 'light';

  private media: MediaQueryList = null;

  init(): void {
    this.choice = this.read();

    if (window.matchMedia) {
      this.media = window.matchMedia(DARK_QUERY);
      const onChange = () => {
        if (this.choice === 'system') { this.paint(); }
      };
      // addEventListener is unavailable on MediaQueryList in older Safari.
      if (this.media.addEventListener) {
        this.media.addEventListener('change', onChange);
      } else if (this.media.addListener) {
        this.media.addListener(onChange);
      }
    }

    this.paint();
  }

  set(choice: ThemeChoice): void {
    this.choice = choice;
    try {
      window.localStorage.setItem(STORAGE_KEY, choice);
    } catch (e) {
      // Private browsing can reject writes; the theme still applies for this session.
    }
    this.paint();
  }

  /** The theme actually on screen, with 'system' already resolved. */
  get resolved(): 'light' | 'dark' {
    if (this.choice === 'system') {
      return this.media && this.media.matches ? 'dark' : 'light';
    }
    return this.choice;
  }

  private paint(): void {
    document.documentElement.setAttribute('data-theme', this.resolved);
  }

  private read(): ThemeChoice {
    let stored: string = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      stored = null;
    }
    return stored === 'dark' || stored === 'system' || stored === 'light' ? stored : 'light';
  }
}
