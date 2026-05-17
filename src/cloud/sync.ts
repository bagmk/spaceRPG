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
import type { PersistentGameState } from '../game/types';

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

export async function pullRemoteSave(uid: string): Promise<PersistentGameState | null> {
  if (!db) return null;
  try {
    const ref = doc(db, 'users', uid, 'saves', 'main');
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const remote = snap.data() as RemoteSaveDoc;
    return remote.data ?? null;
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
