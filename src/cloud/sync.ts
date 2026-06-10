/**
 * Firestore save synchronization.
 * - Pulls remote save on login
 * - Pushes local save with debounce
 * - Last-write-wins conflict resolution
 */

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { getDeviceId } from './deviceId';
import { SAVE_SCHEMA_VERSION } from '../game/storage';
import { validateV5 } from '../game/storage/migrate';
import type { PersistentGameState, SaveState } from '../game/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RemoteSaveDoc {
  schemaVersion: number;
  data: PersistentGameState;
  updatedAt: any; // Firestore Timestamp or serverTimestamp sentinel
  deviceId: string;
  writeSeq: number;
}

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

/**
 * True when the remote save was written by a NEWER client schema than this
 * build understands. While set, pushes are blocked so this (older) client
 * never clobbers a save it cannot represent.
 */
let remoteAheadOfClient = false;

export function isRemoteAheadOfClient(): boolean {
  return remoteAheadOfClient;
}

export async function pullRemoteSave(uid: string): Promise<PersistentGameState | null> {
  if (!db) return null;
  try {
    const ref = doc(db, 'users', uid, 'saves', 'main');
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const remote = snap.data() as RemoteSaveDoc;
    if ((remote.schemaVersion ?? 0) > SAVE_SCHEMA_VERSION) {
      remoteAheadOfClient = true;
      console.warn(
        `[sync] Remote save schema v${remote.schemaVersion} is newer than this client (v${SAVE_SCHEMA_VERSION}). ` +
        'Skipping hydrate and blocking pushes — update the app to sync.',
      );
      return null;
    }
    remoteAheadOfClient = false;
    if (!remote.data) return null;
    // Normalize older cloud saves through the same validation/migration as
    // local storage (e.g. purchasedEntities → inventory in v14).
    return validateV5(remote.data as Partial<SaveState>);
  } catch (e) {
    console.error('[sync] pullRemoteSave failed:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

let writeSeq = 0;

export async function pushRemoteSave(
  uid: string,
  save: PersistentGameState,
  schemaVersion: number,
): Promise<void> {
  if (!db) return;
  if (remoteAheadOfClient) return; // never clobber a newer-schema save
  try {
    writeSeq += 1;
    const ref = doc(db, 'users', uid, 'saves', 'main');
    const payload: RemoteSaveDoc = {
      schemaVersion,
      data: save,
      updatedAt: serverTimestamp(),
      deviceId: getDeviceId(),
      writeSeq,
    };
    await setDoc(ref, payload);
  } catch (e) {
    console.error('[sync] pushRemoteSave failed:', e);
  }
}

// ---------------------------------------------------------------------------
// Debounced push (5 seconds)
// ---------------------------------------------------------------------------

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPush: { uid: string; save: PersistentGameState; version: number } | null = null;

const DEBOUNCE_MS = 60_000; // 1 minute

export function debouncedPush(uid: string, save: PersistentGameState, version: number): void {
  pendingPush = { uid, save, version };
  if (pushTimer) return; // already scheduled
  pushTimer = setTimeout(async () => {
    pushTimer = null;
    if (pendingPush) {
      await pushRemoteSave(pendingPush.uid, pendingPush.save, pendingPush.version);
      pendingPush = null;
    }
  }, DEBOUNCE_MS);
}

export function flushPendingPush(): void {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  if (pendingPush) {
    pushRemoteSave(pendingPush.uid, pendingPush.save, pendingPush.version);
    pendingPush = null;
  }
}
