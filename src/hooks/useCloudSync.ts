/**
 * Cloud sync hook — syncs game state to Firestore for authenticated (non-anonymous) users.
 * - On auth: pull remote save, hydrate if newer (last-write-wins)
 * - While active: push the latest state to Firestore every 30s
 * - On page hide / unload: flush the latest state
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { pullRemoteSave, debouncedPush, flushPendingPush } from '../cloud/sync';
import { pushLeaderboardEntry } from '../cloud/leaderboard';
import { toPersistentState } from '../game/reducer';
import type { GameState } from '../game/types';
import type { GameAction } from '../game/reducer';
import type { Dispatch } from 'react';

const SAVE_VERSION = 12;
const CLOUD_SAVE_INTERVAL_MS = 30_000;

interface UseCloudSyncOptions {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}

function toCloudSave(state: GameState): ReturnType<typeof toPersistentState> {
  return {
    ...toPersistentState(state),
    lastSaveAt: Date.now(),
  };
}

export function useCloudSync({ state, dispatch }: UseCloudSyncOptions): void {
  const { user, status, profile } = useAuth();
  const hasPulled = useRef(false);
  const lastPulledUid = useRef<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Reset pull flag when user changes (logout → login with same or different account)
  useEffect(() => {
    const uid = user?.uid ?? null;
    if (uid !== lastPulledUid.current) {
      hasPulled.current = false;
      lastPulledUid.current = uid;
    }
  }, [user]);

  // Pull remote save on first authenticated login
  useEffect(() => {
    if (status !== 'authed' && status !== 'needsName') return;
    if (!user || user.isAnonymous) return;
    if (hasPulled.current) return;
    hasPulled.current = true;

    (async () => {
      const remote = await pullRemoteSave(user.uid);
      if (!remote) return; // No remote save — local is the source of truth

      const local = stateRef.current;
      const localIsEmpty = local.totalClicks === 0 && local.stageIdx === 0;
      const localSaveAt = local.lastSaveAt ?? 0;
      const remoteSaveAt = remote.lastSaveAt ?? 0;

      if (localIsEmpty || remoteSaveAt > localSaveAt) {
        // Remote is newer or local is fresh/empty — hydrate from remote
        dispatch({ type: 'HYDRATE', payload: remote, now: Date.now() });
      }
      // Otherwise local is newer — keep local, it'll push on next save
    })();
  }, [status, user, dispatch]);

  // Debounced push on milestone changes only (not every tick)
  useEffect(() => {
    if (!user || user.isAnonymous) return;
    if (status !== 'authed') return;

    const persistent = toCloudSave(state);
    debouncedPush(user.uid, persistent, SAVE_VERSION);
  }, [
    user,
    status,
    // Milestones only — NOT quanta/timeGauge (those change every frame)
    state.stageIdx,
    state.completedRun,
    state.universeCount,
    state.condensedMass,
    state.echoes,
    state.skillPoints,
    state.singularityUnlocks,
    state.endingsCompleted,
    state.purchasedEntities,
    state.prestigeUpgrades,
    state.peakEntropy,
  ]);

  // Periodic cloud save for high-frequency progress such as matter/time/clicks.
  useEffect(() => {
    if (!user || user.isAnonymous) return;
    if (status !== 'authed') return;

    const pushCurrentState = () => {
      debouncedPush(user.uid, toCloudSave(stateRef.current), SAVE_VERSION);
      flushPendingPush();
    };

    const intervalId = window.setInterval(pushCurrentState, CLOUD_SAVE_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [user, status]);

  // Push leaderboard entry on milestone changes
  const leaderboardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLeaderboard = useRef<{ uid: string; profile: typeof profile; stats: { peakEntropy: number; totalTimePlayed: number; totalClicks: number; universeCount: number } } | null>(null);

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    if (status !== 'authed') return;

    const stats = { peakEntropy: state.peakEntropy, totalTimePlayed: state.totalTimePlayed, totalClicks: state.totalClicks, universeCount: state.universeCount };
    pendingLeaderboard.current = { uid: user.uid, profile, stats };

    // Push immediately when a run completes
    if (state.completedRun) {
      if (leaderboardTimer.current) {
        clearTimeout(leaderboardTimer.current);
        leaderboardTimer.current = null;
      }
      pushLeaderboardEntry(user.uid, stats, profile);
      pendingLeaderboard.current = null;
      return;
    }

    if (leaderboardTimer.current) return;
    leaderboardTimer.current = setTimeout(() => {
      leaderboardTimer.current = null;
      const pending = pendingLeaderboard.current;
      if (pending) {
        pushLeaderboardEntry(pending.uid, pending.stats, pending.profile);
      }
      pendingLeaderboard.current = null;
    }, 30_000);
  }, [user, status, state.peakEntropy, state.stageIdx, state.completedRun, profile]);

  // Flush the latest state on page hide/unload.
  useEffect(() => {
    if (!user || user.isAnonymous) return;

    const flushLeaderboard = () => {
      if (leaderboardTimer.current) {
        clearTimeout(leaderboardTimer.current);
        leaderboardTimer.current = null;
      }
      const pending = pendingLeaderboard.current;
      if (pending) {
        pushLeaderboardEntry(pending.uid, pending.stats, pending.profile);
        pendingLeaderboard.current = null;
      }
    };

    const flush = () => {
      if (status === 'authed') {
        debouncedPush(user.uid, toCloudSave(stateRef.current), SAVE_VERSION);
      }
      flushPendingPush();
      flushLeaderboard();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    };

    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, status]);
}
