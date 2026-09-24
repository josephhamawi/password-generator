import { Component, Input } from '@angular/core';

import { BRAND_MARKS } from '../data/platform-logos';

/**
 * Renders a platform's brand mark.
 *
 * Logos are trademarks of their respective owners and appear only to identify
 * which service a password belongs to. `monochrome` drops the brand colour so
 * the mark sits inside the app's own palette where colour would be noise.
 */
@Component({
  selector: 'app-brand-logo',
  template: `
    <svg *ngIf="mark" viewBox="0 0 24 24" [attr.width]="size" [attr.height]="size"
         [attr.aria-label]="mark.title" role="img"
         [style.fill]="fill">
      <path [attr.d]="mark.path"></path>
    </svg>
    <span *ngIf="!mark" class="brand-fallback" [style.width.px]="size" [style.height.px]="size"
          [attr.aria-label]="slug">{{ initial }}</span>
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; justify-content: center;
            line-height: 0; color: var(--ink); }
    svg { display: block; }
    .brand-fallback {
      display: inline-flex; align-items: center; justify-content: center;
      border: 1px solid currentColor; border-radius: 2px;
      font-family: var(--font-mono); font-size: 10px; color: var(--ink-muted);
    }
  `]
})
export class BrandLogoComponent {
  @Input() slug: string;
  @Input() size = 18;
  @Input() monochrome = false;

  get mark() {
    return this.slug ? BRAND_MARKS[this.slug] : null;
  }

  /**
   * Near-black brand marks (GitHub, Apple, X) vanish against the dark surface.
   * Their own colour is kept in light mode and swapped for the page ink in
   * dark mode, which is the conventional treatment for monochrome logos.
   */
  get fill(): string {
    if (this.monochrome || !this.mark) { return 'currentColor'; }
    return this.isDark && this.isNearBlack(this.mark.hex) ? 'currentColor' : this.mark.hex;
  }

  private get isDark(): boolean {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  private isNearBlack(hex: string): boolean {
    const v = hex.replace('#', '');
    const r = parseInt(v.slice(0, 2), 16);
    const g = parseInt(v.slice(2, 4), 16);
    const b = parseInt(v.slice(4, 6), 16);
    // Rec. 601 luma; anything this dark is unreadable on the dark surface.
    return (0.299 * r + 0.587 * g + 0.114 * b) < 70;
  }

  get initial(): string {
    return this.slug ? this.slug.charAt(0).toUpperCase() : '?';
  }
}
