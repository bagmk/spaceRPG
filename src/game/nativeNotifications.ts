/**
 * nativeNotifications.ts
 *
 * Capacitor LocalNotifications wrapper.
 * Used on iOS / Android only — no-ops on web.
 * Schedules a notification at the exact moment a boost expires.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { ShopBoost } from './types';
import type { Lang } from '../i18n';

// ---------------------------------------------------------------------------
// Stable numeric ID from string boost ID
// (LocalNotifications requires a 32-bit signed integer ID)
// ---------------------------------------------------------------------------

function boostToNotifId(boostId: string): number {
  let h = 0;
  for (let i = 0; i < boostId.length; i++) {
    h = Math.imul(h ^ boostId.charCodeAt(i), 0x9e3779b1);
  }
  // Keep positive and well within Android's limit
  return (h >>> 0) % 2_000_000_000;
}

// ---------------------------------------------------------------------------
// Bilingual messages
// ---------------------------------------------------------------------------

const BOOST_EXPIRED: Record<Lang, { title: string; body: string }> = {
  en: {
    title: '🚀 Boost Ended!',
    body: 'Your boost has expired. Tap to keep expanding the universe!',
  },
  ko: {
    title: '🚀 부스트 종료!',
    body: '부스트가 끝났습니다. 탭해서 우주를 계속 확장하세요!',
  },
};

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

let permissionGranted: boolean | null = null;

export async function requestNativeNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { display } = await LocalNotifications.requestPermissions();
    permissionGranted = display === 'granted';
    return permissionGranted;
  } catch {
    permissionGranted = false;
    return false;
  }
}

// ---------------------------------------------------------------------------
// Schedule notifications for all active boosts
// ---------------------------------------------------------------------------

export async function scheduleBoostExpiryNotifications(
  boosts: ShopBoost[],
  lang: Lang,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  // Request permission if we haven't yet
  if (permissionGranted === null) {
    await requestNativeNotificationPermission();
  }
  if (!permissionGranted) return;

  const now = Date.now();
  const pending = boosts.filter((b) => b.expiresAt > now);
  if (pending.length === 0) return;

  const msg = BOOST_EXPIRED[lang] ?? BOOST_EXPIRED.en;

  try {
    await LocalNotifications.schedule({
      notifications: pending.map((boost) => ({
        id: boostToNotifId(boost.id),
        title: msg.title,
        body: msg.body,
        schedule: { at: new Date(boost.expiresAt), allowWhileIdle: true },
        smallIcon: 'ic_stat_notification', // Android only; ignored on iOS
        actionTypeId: '',
        extra: null,
      })),
    });
  } catch (e) {
    console.warn('[NativeNotif] schedule failed:', e);
  }
}

// ---------------------------------------------------------------------------
// Cancel notifications for removed / expired boosts
// ---------------------------------------------------------------------------

export async function cancelBoostNotifications(boostIds: string[]): Promise<void> {
  if (!Capacitor.isNativePlatform() || boostIds.length === 0) return;
  try {
    await LocalNotifications.cancel({
      notifications: boostIds.map((id) => ({ id: boostToNotifId(id) })),
    });
  } catch {
    // silent
  }
}
