/**
 * Cloud sync hook — syncs game state to Firestore for authenticated (non-anonymous) users.
 * - On auth: pull remote save, hydrate if newer (last-write-wins)
 * - On state change: debounced push to Firestore (5s)
 * - On page hide / unload: flush pending push
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

interface UseCloudSyncOptions {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}

export function useCloudSync({ state, dispatch }: UseCloudSyncOptions): void {
  const { user, status, profile } = useAuth();
  const hasPulled = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

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

    const persistent = toPersistentState(state);
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

  // Push leaderboard entry when peakEntropy changes (throttled to once per minute)
  const lastPushedPeak = useRef(0);
  const leaderboardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLeaderboard = useRef<{ uid: string; peak: number; profile: typeof profile; time: number; clicks: number; universes: number } | null>(null);

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    if (status !== 'authed') return;
    if (state.peakEntropy <= lastPushedPeak.current) return;

    pendingLeaderboard.current = { uid: user.uid, peak: state.peakEntropy, profile, time: state.totalTimePlayed, clicks: state.totalClicks, universes: state.universeCount };
    if (leaderboardTimer.current) return; // already scheduled

    leaderboardTimer.current = setTimeout(() => {
      leaderboardTimer.current = null;
      const pending = pendingLeaderboard.current;
      if (pending && pending.peak > lastPushedPeak.current) {
        lastPushedPeak.current = pending.peak;
        pushLeaderboardEntry(pending.uid, { peakEntropy: pending.peak, totalTimePlayed: pending.time, totalClicks: pending.clicks, universeCount: pending.universes }, pending.profile);
      }
      pendingLeaderboard.current = null;
    }, 60_000);
  }, [user, status, state.peakEntropy, profile]);

  // Flush on page hide/unload
  useEffect(() => {
    if (!user || user.isAnonymous) return;

    const flush = () => flushPendingPush();
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });

    return () => {
      window.removeEventListener('beforeunload', flush);
    };
  }, [user]);
}
