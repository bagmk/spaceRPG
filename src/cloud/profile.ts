import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserProfile {
  email: string | null;
  photoURL: string | null;
  displayName: string | null;
  displayNameLower: string | null;
  nameChangedAt: number | null;
  createdAt: number;
  lastLoginAt: number;
  providers: string[];
}

// ---------------------------------------------------------------------------
// Name validation
// ---------------------------------------------------------------------------

const NAME_MIN = 2;
const NAME_MAX = 16;
const NAME_PATTERN = /^[\p{L}\p{N} ]+$/u; // letters (any script), digits, spaces

const BLACKLIST = [
  '시발', '씨발', '병신', '개새끼', 'fuck', 'shit', 'asshole', 'nigger', 'bitch',
  'admin', 'administrator', 'moderator', '관리자', '운영자',
];

export function validateDisplayName(name: string): { ok: true } | { ok: false; reason: 'length' | 'chars' | 'profanity' } {
  const trimmed = name.trim();
  if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) {
    return { ok: false, reason: 'length' };
  }
  if (!NAME_PATTERN.test(trimmed)) {
    return { ok: false, reason: 'chars' };
  }
  const lower = trimmed.toLowerCase();
  if (BLACKLIST.some((word) => lower.includes(word))) {
    return { ok: false, reason: 'profanity' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Profile CRUD
// ---------------------------------------------------------------------------

export async function getProfile(uid: string): Promise<UserProfile | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, 'users', uid, 'profile', 'main'));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function createOrUpdateProfile(
  uid: string,
  data: Partial<UserProfile>,
): Promise<void> {
  if (!db) return;
  const ref = doc(db, 'users', uid, 'profile', 'main');
  await setDoc(ref, { ...data, lastLoginAt: Date.now() }, { merge: true });
}

// ---------------------------------------------------------------------------
// Display name claim (Firestore Transaction — unique enforcement)
// ---------------------------------------------------------------------------

export type ClaimResult =
  | { ok: true }
  | { ok: false; reason: 'taken' | 'invalid' };

export async function claimDisplayName(uid: string, name: string): Promise<ClaimResult> {
  if (!db) return { ok: false, reason: 'invalid' };
  const trimmed = name.trim();
  const validation = validateDisplayName(trimmed);
  if (!validation.ok) return { ok: false, reason: 'invalid' };

  const nameLower = trimmed.toLowerCase();
  const nameRef = doc(db, 'displayNames', nameLower);
  const profileRef = doc(db, 'users', uid, 'profile', 'main');

  return runTransaction(db, async (tx) => {
    const nameSnap = await tx.get(nameRef);

    // Check if taken by someone else
    if (nameSnap.exists() && nameSnap.data().uid !== uid) {
      return { ok: false as const, reason: 'taken' as const };
    }

    // Read current profile to delete old name
    const profileSnap = await tx.get(profileRef);
    const currentProfile = profileSnap.data() as UserProfile | undefined;
    if (currentProfile?.displayNameLower && currentProfile.displayNameLower !== nameLower) {
      const oldNameRef = doc(db!, 'displayNames', currentProfile.displayNameLower);
      tx.delete(oldNameRef);
    }

    // Claim new name
    tx.set(nameRef, { uid, claimedAt: Date.now() });
    tx.set(profileRef, {
      displayName: trimmed,
      displayNameLower: nameLower,
      nameChangedAt: Date.now(),
    }, { merge: true });

    return { ok: true as const };
  });
}

// ---------------------------------------------------------------------------
// Check if a name is available (for real-time UI feedback)
// ---------------------------------------------------------------------------

export async function isNameAvailable(name: string): Promise<boolean> {
  if (!db) return false;
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return false;
  const snap = await getDoc(doc(db, 'displayNames', trimmed));
  return !snap.exists();
}
