/**
 * Built-in password policies, used as SEED DATA for the local database.
 *
 * These are best-effort defaults, not authoritative. Platforms change their
 * rules without announcement and rarely publish them in full, so every entry
 * carries a `confidence` and a `verifiedOn` date. The app cannot check them
 * over the network -- it has no network -- so anything older than
 * STALE_AFTER_DAYS is flagged in the UI for review, and every field is
 * user-editable. Edits live in SQLite and survive upgrades to this file.
 */

export type Confidence = 'high' | 'medium' | 'low';

export interface PlatformSpec {
  id: string;
  name: string;
  /** Key into BRAND_MARKS. */
  slug: string;
  minLength: number;
  maxLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireDigit: boolean;
  requireSymbol: boolean;
  /** Empty string means "no documented restriction" -- the full set is used. */
  allowedSymbols: string;
  /** Longest run of the same character allowed. 0 = no documented limit. */
  maxRepeat: number;
  /** Platform has no conventional password (e.g. phone + code). */
  passwordless: boolean;
  notes: string;
  sourceUrl: string;
  verifiedOn: string;
  confidence: Confidence;
}

/** A spec older than this is shown with a "needs review" badge. */
export const STALE_AFTER_DAYS = 180;

/** The widest symbol set the generator will ever draw from. */
export const DEFAULT_SYMBOLS = '!@#$%^&*()-_=+[]{}<>?/~.,:;';

/** Conservative set: the symbols most consistently accepted across platforms. */
export const SAFE_SYMBOLS = '!@#$%^&*()-_=+?.';

const base = {
  requireUpper: false,
  requireLower: false,
  requireDigit: false,
  requireSymbol: false,
  allowedSymbols: '',
  maxRepeat: 0,
  passwordless: false,
  verifiedOn: '2026-09-24'
};

export const PLATFORM_SPECS: PlatformSpec[] = [
  { ...base, id: 'google', name: 'Google', slug: 'google',
    minLength: 8, maxLength: 100, confidence: 'high',
    notes: 'At least 8 characters. Leading and trailing spaces are stripped.',
    sourceUrl: 'https://support.google.com/accounts/answer/32040' },

  { ...base, id: 'apple', name: 'Apple ID', slug: 'apple',
    minLength: 8, maxLength: 64, requireUpper: true, requireLower: true,
    requireDigit: true, maxRepeat: 2, confidence: 'high',
    notes: 'Needs upper, lower and a digit. No more than two identical characters in a row.',
    sourceUrl: 'https://support.apple.com/en-us/102656' },

  { ...base, id: 'github', name: 'GitHub', slug: 'github',
    minLength: 15, maxLength: 72, confidence: 'high',
    notes: 'Either 15+ characters of anything, or 8+ with at least one lowercase and one number. This app targets the 15+ rule.',
    sourceUrl: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-strong-password' },

  { ...base, id: 'facebook', name: 'Facebook', slug: 'facebook',
    minLength: 8, maxLength: 64, confidence: 'medium',
    notes: 'Minimum 6 historically; 8 is the current guidance. No documented maximum.',
    sourceUrl: 'https://www.facebook.com/help/124904560921566' },

  { ...base, id: 'instagram', name: 'Instagram', slug: 'instagram',
    minLength: 8, maxLength: 64, confidence: 'medium',
    notes: 'Minimum 6 historically; 8 is the current guidance.',
    sourceUrl: 'https://help.instagram.com/566810106808145' },

  { ...base, id: 'x', name: 'X (Twitter)', slug: 'x',
    minLength: 8, maxLength: 64, confidence: 'medium',
    notes: 'At least 8 characters.',
    sourceUrl: 'https://help.x.com/en/safety-and-security/account-security-tips' },

  { ...base, id: 'microsoft-like', name: 'Adobe', slug: 'adobe',
    minLength: 8, maxLength: 64, confidence: 'medium',
    notes: 'At least 8 characters with a mix of types.',
    sourceUrl: 'https://helpx.adobe.com/manage-account/using/update-account-password.html' },

  { ...base, id: 'amazon', name: 'Amazon', slug: 'amazon',
    minLength: 8, maxLength: 64, confidence: 'medium',
    notes: 'Minimum 6 historically; 8 is the current guidance.',
    sourceUrl: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=G8KMSFSMBJPMFVHS' },

  { ...base, id: 'linkedin', name: 'LinkedIn', slug: 'linkedin',
    minLength: 8, maxLength: 200, confidence: 'medium',
    notes: 'At least 6 required, 8+ recommended.',
    sourceUrl: 'https://www.linkedin.com/help/linkedin/answer/a1339315' },

  { ...base, id: 'paypal', name: 'PayPal', slug: 'paypal',
    minLength: 8, maxLength: 20, requireUpper: true, requireLower: true,
    requireDigit: true, allowedSymbols: SAFE_SYMBOLS, confidence: 'medium',
    notes: 'Capped at 20 characters. Mixed case plus a number. Symbol set is restricted.',
    sourceUrl: 'https://www.paypal.com/us/cshelp/article/help541' },

  { ...base, id: 'tiktok', name: 'TikTok', slug: 'tiktok',
    minLength: 8, maxLength: 20, requireDigit: true, requireSymbol: true,
    allowedSymbols: SAFE_SYMBOLS, confidence: 'medium',
    notes: 'Capped at 20 characters. Needs letters, numbers and a symbol.',
    sourceUrl: 'https://support.tiktok.com/en/log-in-troubleshoot/log-in/changing-your-password' },

  { ...base, id: 'snapchat', name: 'Snapchat', slug: 'snapchat',
    minLength: 8, maxLength: 64, confidence: 'medium',
    notes: 'At least 8 characters.',
    sourceUrl: 'https://help.snapchat.com/hc/en-us/articles/7012310531732' },

  { ...base, id: 'reddit', name: 'Reddit', slug: 'reddit',
    minLength: 8, maxLength: 64, confidence: 'medium',
    notes: 'At least 8 characters.',
    sourceUrl: 'https://support.reddithelp.com/hc/en-us/articles/205240005' },

  { ...base, id: 'discord', name: 'Discord', slug: 'discord',
    minLength: 8, maxLength: 72, confidence: 'medium',
    notes: 'At least 6 required, 8+ recommended. Backed by bcrypt, hence the 72-byte ceiling.',
    sourceUrl: 'https://support.discord.com/hc/en-us/articles/218410947' },

  { ...base, id: 'netflix', name: 'Netflix', slug: 'netflix',
    minLength: 8, maxLength: 60, confidence: 'medium',
    notes: 'Between 6 and 60 characters; 8+ recommended.',
    sourceUrl: 'https://help.netflix.com/en/node/365' },

  { ...base, id: 'spotify', name: 'Spotify', slug: 'spotify',
    minLength: 10, maxLength: 64, requireDigit: true, confidence: 'medium',
    notes: 'At least 10 characters including a number or a symbol.',
    sourceUrl: 'https://support.spotify.com/us/article/password-reset/' },

  { ...base, id: 'steam', name: 'Steam', slug: 'steam',
    minLength: 8, maxLength: 64, confidence: 'medium',
    notes: 'At least 8 characters.',
    sourceUrl: 'https://help.steampowered.com/en/faqs/view/06B0-26E6-2CF8-6association' },

  { ...base, id: 'twitch', name: 'Twitch', slug: 'twitch',
    minLength: 8, maxLength: 71, confidence: 'medium',
    notes: 'At least 8 characters.',
    sourceUrl: 'https://help.twitch.tv/s/article/how-to-change-your-password' },

  { ...base, id: 'dropbox', name: 'Dropbox', slug: 'dropbox',
    minLength: 8, maxLength: 72, confidence: 'medium',
    notes: 'At least 6 required, 8+ recommended.',
    sourceUrl: 'https://help.dropbox.com/security/change-password' },

  { ...base, id: 'pinterest', name: 'Pinterest', slug: 'pinterest',
    minLength: 8, maxLength: 64, confidence: 'low',
    notes: 'At least 6 required, 8+ recommended. Policy is not published in detail.',
    sourceUrl: 'https://help.pinterest.com/en/article/change-your-password' },

  { ...base, id: 'ebay', name: 'eBay', slug: 'ebay',
    minLength: 8, maxLength: 64, confidence: 'low',
    notes: 'At least 6 required, 8+ recommended. Policy is not published in detail.',
    sourceUrl: 'https://www.ebay.com/help/account/changing-account-settings/changing-password' },

  { ...base, id: 'gitlab', name: 'GitLab', slug: 'gitlab',
    minLength: 8, maxLength: 128, confidence: 'medium',
    notes: 'At least 8 characters on GitLab.com.',
    sourceUrl: 'https://docs.gitlab.com/ee/user/profile/user_passwords.html' },

  { ...base, id: 'slack', name: 'Slack', slug: 'slack',
    minLength: 8, maxLength: 72, confidence: 'low',
    notes: 'At least 6 required, 8+ recommended. Policy is not published in detail.',
    sourceUrl: 'https://slack.com/help/articles/201909068' },

  { ...base, id: 'zoom', name: 'Zoom', slug: 'zoom',
    minLength: 8, maxLength: 32, requireUpper: true, requireLower: true,
    requireDigit: true, confidence: 'medium',
    notes: 'At least 8 characters with upper, lower and a number. No more than 32.',
    sourceUrl: 'https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0061659' },

  { ...base, id: 'roblox', name: 'Roblox', slug: 'roblox',
    minLength: 8, maxLength: 200, confidence: 'medium',
    notes: 'At least 8 characters. Cannot contain your username.',
    sourceUrl: 'https://en.help.roblox.com/hc/en-us/articles/203313360' },

  { ...base, id: 'telegram', name: 'Telegram', slug: 'telegram',
    minLength: 8, maxLength: 64, confidence: 'medium',
    notes: 'Applies to the optional two-step "cloud password"; normal sign-in uses an SMS code.',
    sourceUrl: 'https://telegram.org/faq#q-how-does-2-step-verification-work' },

  { ...base, id: 'whatsapp', name: 'WhatsApp', slug: 'whatsapp',
    minLength: 6, maxLength: 6, passwordless: true, confidence: 'high',
    notes: 'No account password. Sign-in is by phone number; two-step verification is a 6-digit PIN.',
    sourceUrl: 'https://faq.whatsapp.com/1920866721675554' }
];

export function isStale(spec: PlatformSpec, today: Date): boolean {
  const then = Date.parse(spec.verifiedOn);
  if (isNaN(then)) { return true; }
  const days = (today.getTime() - then) / 86400000;
  return days > STALE_AFTER_DAYS;
}
