//
// Consent gating for App Store / Google Play required policy acceptance.
// Model: implicit consent. Tapping a sign-in button equals acceptance of the
// versioned Terms of Service + Privacy Policy shown on the login screen.
// Bump CONSENT_VERSION whenever either document materially changes so users
// are asked to re-accept (call hasCurrentConsent() at launch for a hard gate).

// v2: updated to disclose AdMob rewarded ads, consumable IAP, push notifications,
// and advertising identifier (IDFA/GAID) usage.
export const CONSENT_VERSION = '2026-06-07-v2';

// Public, non-login URLs. Served from /public so they resolve in the web build
// AND inside the Capacitor WebView. Put the deployed absolute versions of these
// (e.g. https://your-domain/privacy.html) into App Store Connect and Play Console.
export const PRIVACY_URL = 'https://the-big-bang-84499.web.app/privacy.html';
export const TERMS_URL = 'https://the-big-bang-84499.web.app/terms.html';

const STORAGE_KEY = 'cc:consent';

export interface ConsentRecord {
  version: string;
  acceptedAt: number; // epoch ms
}

export function getConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ConsentRecord) : null;
  } catch {
    return null;
  }
}

// True only if the user has accepted the current policy version.
export function hasCurrentConsent(): boolean {
  return getConsent()?.version === CONSENT_VERSION;
}

// Record acceptance of the current policy version.
export function recordConsent(): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: CONSENT_VERSION, acceptedAt: Date.now() } satisfies ConsentRecord),
    );
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}
