/**
 * Leaderboard — peakEntropy ranking.
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
  updatedAt?: any;
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

export async function pushLeaderboardEntry(
  uid: string,
  peakEntropy: number,
  profile: UserProfile | null,
  totalTimePlayed?: number,
): Promise<void> {
  if (!db) return;
  if (!profile?.displayName) return;
  if (!Number.isFinite(peakEntropy) || peakEntropy <= 0) return;

  try {
    const ref = doc(db, 'leaderboard', uid);
    const data: Record<string, unknown> = {
      uid,
      displayName: profile.displayName,
      peakEntropy,
      updatedAt: serverTimestamp(),
    };
    if (totalTimePlayed != null && Number.isFinite(totalTimePlayed)) {
      data.totalTimePlayed = totalTimePlayed;
    }
    await setDoc(ref, data, { merge: true });
  } catch (e) {
    console.error('[leaderboard] push failed:', e);
  }
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function fetchTopN(n: number = 100): Promise<LeaderboardEntry[]> {
  if (!db) return [];
  try {
    const q = query(
      collection(db, 'leaderboard'),
      orderBy('peakEntropy', 'desc'),
      limit(n),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as LeaderboardEntry);
  } catch (e) {
    console.error('[leaderboard] fetchTopN failed:', e);
    return [];
  }
}
