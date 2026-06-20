/**
 * Pure cloud-merge decision (extracted from useCloudSync so it is unit-testable).
 *
 * Plain last-write-wins on each device's wall clock can silently destroy progress
 * across devices (clock skew, or just the last device to push an older save). The
 * policy:
 *   1. Empty local (fresh install) → always adopt the remote save.
 *   2. Remote is strictly newer AND not a regression → adopt it (backing up local
 *      first so the discarded save is recoverable).
 *   3. Remote regressed (strictly behind local on BOTH stage and peak entropy =
 *      almost certainly stale/skewed) → keep local even if its timestamp is older.
 *   4. Otherwise local is newer → keep local (it pushes on the next save).
 */
export interface CloudMergeLocal {
  totalClicks: number;
  stageIdx: number;
  lastSaveAt?: number;
  peakEntropy?: number;
}

export interface CloudMergeRemote {
  stageIdx: number;
  lastSaveAt?: number;
  peakEntropy?: number;
}

export type CloudMergeReason =
  | 'local-empty'          // fresh local → take remote
  | 'remote-newer'         // remote strictly newer + not regressed → take it
  | 'keep-remote-regressed' // remote behind on stage AND peak entropy → keep local
  | 'keep-local-newer';    // local timestamp ≥ remote → keep local

export interface CloudMergeDecision {
  /** Adopt the remote save (HYDRATE)? */
  hydrate: boolean;
  /** Snapshot the local save before discarding it (only when overwriting real progress)? */
  backupLocal: boolean;
  reason: CloudMergeReason;
}

export function decideCloudMerge(local: CloudMergeLocal, remote: CloudMergeRemote): CloudMergeDecision {
  const localIsEmpty = local.totalClicks === 0 && local.stageIdx === 0;
  const localSaveAt = local.lastSaveAt ?? 0;
  const remoteSaveAt = remote.lastSaveAt ?? 0;
  // A regression: remote is STRICTLY behind local on BOTH milestones.
  const remoteRegressed = remote.stageIdx < local.stageIdx && (remote.peakEntropy ?? 0) < (local.peakEntropy ?? 0);

  if (localIsEmpty) return { hydrate: true, backupLocal: false, reason: 'local-empty' };
  if (remoteSaveAt > localSaveAt && !remoteRegressed) return { hydrate: true, backupLocal: true, reason: 'remote-newer' };
  if (remoteRegressed) return { hydrate: false, backupLocal: false, reason: 'keep-remote-regressed' };
  return { hydrate: false, backupLocal: false, reason: 'keep-local-newer' };
}
