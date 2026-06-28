/**
 * Stale-build guard.
 *
 * The app is hosted on GitHub Pages, which does NOT allow custom Cache-Control
 * headers — so we can't tell the browser "never cache index.html". Instead the
 * bundle bakes in __BUILD_ID__ (vite.config define) and the build publishes
 * /version.json with the same id. On launch and whenever the tab/PWA becomes
 * visible again, we read version.json bypassing every cache (no-store + a unique
 * query so even the CDN can't hand back a stale copy). If the live build differs
 * from the one running, we reload to a cache-busted URL (?v=<id>) — a brand-new
 * URL the browser MUST fetch fresh — so the player always lands on the latest
 * code without ever clearing their cache by hand.
 *
 * Note: this only helps once a build CONTAINING it is running, so the very first
 * update still needs one manual refresh; every update after that is automatic.
 */

const VERSION_URL = `${import.meta.env.BASE_URL}version.json`;

async function fetchLiveBuild(): Promise<string | null> {
  try {
    // no-store skips the browser cache; the ?t= query skips any CDN/edge cache.
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { build?: unknown };
    return typeof data.build === 'string' ? data.build : null;
  } catch {
    return null; // offline / blocked / missing → behave exactly as before
  }
}

function reloadToFreshBuild(build: string): void {
  const url = new URL(window.location.href);
  // Loop guard: if we already redirected for this exact build but are still stale
  // (a rare CDN miss), don't bounce again — leave the player where they are.
  if (url.searchParams.get('v') === build) return;
  url.searchParams.set('v', build);
  window.location.replace(url.toString());
}

let checking = false;
async function checkForUpdate(): Promise<void> {
  if (checking) return;
  checking = true;
  try {
    const live = await fetchLiveBuild();
    if (live && live !== __BUILD_ID__) reloadToFreshBuild(live);
  } finally {
    checking = false;
  }
}

/** Wire the launch + on-resume update checks. No-op in dev (no version.json emitted). */
export function startUpdateWatch(): void {
  if (import.meta.env.DEV) return;
  void checkForUpdate();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate();
  });
}
