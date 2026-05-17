import { useEffect, useRef } from 'react';
import type { ShopBoost } from '../game/types';
import type { Lang } from '../i18n';

// ---------------------------------------------------------------------------
// Bilingual messages
// ---------------------------------------------------------------------------

const MESSAGES = {
  boost_expired: {
    en: { title: 'Boost Expired!', body: 'Your boost has ended. Come back and keep expanding the universe!' },
    ko: { title: '부스트 종료!', body: '부스트가 끝났습니다. 돌아와서 우주를 계속 확장하세요!' },
  },
  come_back: {
    en: { title: 'The universe awaits…', body: 'Your cosmos is still expanding. Come check on your progress!' },
    ko: { title: '우주가 기다리고 있어요…', body: '당신의 우주는 아직 팽창 중입니다. 진행 상황을 확인하세요!' },
  },
} as const;

// ---------------------------------------------------------------------------
// Service Worker registration
// ---------------------------------------------------------------------------

let swRegistration: ServiceWorkerRegistration | null = null;
let swReady = false;

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (swRegistration) return swRegistration;
  if (!('serviceWorker' in navigator)) return null;
  try {
    swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    swReady = true;
    return swRegistration;
  } catch (e) {
    console.warn('[Notifications] SW registration failed:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// ---------------------------------------------------------------------------
// Schedule via Service Worker (survives tab close)
// ---------------------------------------------------------------------------

function scheduleViaSW(delayMs: number, key: keyof typeof MESSAGES, lang: Lang): void {
  if (!swReady || !swRegistration?.active) return;
  const msg = MESSAGES[key][lang];
  swRegistration.active.postMessage({
    type: 'SCHEDULE_NOTIFICATION',
    delayMs,
    title: msg.title,
    body: msg.body,
    tag: key,
  });
}

// ---------------------------------------------------------------------------
// Fallback: in-page Notification (when SW not available)
// ---------------------------------------------------------------------------

function sendFallbackNotification(key: keyof typeof MESSAGES, lang: Lang): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  const msg = MESSAGES[key][lang];
  try {
    new Notification(msg.title, { body: msg.body, icon: '/icon-192.png', tag: key });
  } catch {
    // silent
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBoostNotifications(
  boosts: ShopBoost[] | undefined,
  language: Lang,
): void {
  const timersRef = useRef<number[]>([]);
  const swInitiated = useRef(false);

  // Register SW + request permission on first boost
  useEffect(() => {
    if (swInitiated.current || !boosts || boosts.length === 0) return;
    swInitiated.current = true;
    (async () => {
      const granted = await requestPermission();
      if (granted) await ensureServiceWorker();
    })();
  }, [boosts]);

  // Schedule notifications for active boosts
  useEffect(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];

    if (!boosts || boosts.length === 0) return;

    const now = Date.now();
    for (const boost of boosts) {
      const remaining = boost.expiresAt - now;
      if (remaining > 0) {
        // SW-based (survives tab close)
        if (swReady) {
          scheduleViaSW(remaining, 'boost_expired', language);
        }
        // Fallback timer (in-page, only if tab stays open)
        const id = window.setTimeout(() => {
          sendFallbackNotification('boost_expired', language);
        }, remaining);
        timersRef.current.push(id);
      }
    }

    return () => {
      for (const id of timersRef.current) window.clearTimeout(id);
      timersRef.current = [];
    };
  }, [boosts, language]);

  // "Come back" notification — scheduled via SW when tab goes hidden
  useEffect(() => {
    let fallbackTimer: number | null = null;
    const COME_BACK_DELAY_MS = 30 * 60 * 1000; // 30 minutes

    function handleVisibility() {
      if (document.visibilityState === 'hidden') {
        if (swReady) {
          scheduleViaSW(COME_BACK_DELAY_MS, 'come_back', language);
        }
        fallbackTimer = window.setTimeout(() => {
          sendFallbackNotification('come_back', language);
        }, COME_BACK_DELAY_MS);
      } else {
        if (fallbackTimer !== null) {
          window.clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
    };
  }, [language]);
}
