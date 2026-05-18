/**
 * Leaderboard — multi-category ranking.
 * Only authenticated users with displayName are eligible.
 */

import {
  doc,
  setDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { UserProfile } from './profile';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  peakEntropy: number;
  totalTimePlayed?: number;
  totalClicks?: number;
  universeCount?: number;
  updatedAt?: any;
}

export type LeaderboardTab = 'entropy' | 'time' | 'clicks' | 'multiverse';

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

export async function pushLeaderboardEntry(
  uid: string,
  stats: {
    peakEntropy: number;
    totalTimePlayed?: number;
    totalClicks?: number;
    universeCount?: number;
  },
  profile: UserProfile | null,
): Promise<void> {
  if (!db) return;
  if (!profile?.displayName) return;
  if (!Number.isFinite(stats.peakEntropy) || stats.peakEntropy <= 0) return;

  try {
    const ref = doc(db, 'leaderboard', uid);
    const data: Record<string, unknown> = {
      uid,
      displayName: profile.displayName,
      peakEntropy: stats.peakEntropy,
      updatedAt: serverTimestamp(),
    };
    if (stats.totalTimePlayed != null && Number.isFinite(stats.totalTimePlayed)) {
      data.totalTimePlayed = stats.totalTimePlayed;
    }
    if (stats.totalClicks != null && Number.isFinite(stats.totalClicks)) {
      data.totalClicks = stats.totalClicks;
    }
    if (stats.universeCount != null && Number.isFinite(stats.universeCount)) {
      data.universeCount = stats.universeCount;
    }
    await setDoc(ref, data, { merge: true });
  } catch (e) {
    console.error('[leaderboard] push failed:', e);
  }
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

const TAB_SORT_FIELD: Record<LeaderboardTab, string> = {
  entropy: 'peakEntropy',
  time: 'totalTimePlayed',
  clicks: 'totalClicks',
  multiverse: 'universeCount',
};

export async function fetchTopN(n: number = 100, tab: LeaderboardTab = 'entropy'): Promise<LeaderboardEntry[]> {
  if (!db) return [];
  try {
    const field = TAB_SORT_FIELD[tab];
    const q = query(
      collection(db, 'leaderboard'),
      orderBy(field, 'desc'),
      limit(n),
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as LeaderboardEntry)
      .filter((e) => {
        const val = (e as any)[field];
        return val != null && val > 0;
      });
  } catch (e) {
    console.error('[leaderboard] fetchTopN failed:', e);
    return [];
  }
}
