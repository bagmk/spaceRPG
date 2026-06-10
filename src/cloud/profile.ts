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
  // Consent tracking — version string matches CONSENT_VERSION in consent.ts.
  // Written to Firestore on every sign-in so there is an auditable record of
  // which policy version the user accepted and when.
  consentVersion?: string;
  consentAcceptedAt?: number;
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

// ---------------------------------------------------------------------------
// Account deletion - wipe all owned documents (App Store Guideline 5.1.1(v))
// ---------------------------------------------------------------------------

// Deletes every Firestore document this user owns. Best-effort: a missing doc
// or a single failed delete does not abort the rest. There are no deep
// subcollections today; if added, clean them up via a Cloud Function or the
// "Delete User Data" Firebase extension.
export async function deleteAccountData(uid: string): Promise<void> {
  if (!db) {
    console.warn('[deleteAccountData] db is null — skipping');
    return;
  }
  let nameLower: string | null = null;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'profile', 'main'));
    nameLower = (snap.data() as UserProfile | undefined)?.displayNameLower ?? null;
  } catch (e) {
    console.warn('[deleteAccountData] failed to read profile:', e);
  }
  const targets = [
    doc(db, 'users', uid, 'profile', 'main'),
    doc(db, 'users', uid, 'saves', 'main'),
    doc(db, 'leaderboard', uid),
  ];
  if (nameLower) targets.push(doc(db, 'displayNames', nameLower));
  const results = await Promise.allSettled(targets.map((ref) => deleteDoc(ref)));
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[deleteAccountData] failed to delete doc ${targets[i].path}:`, r.reason);
    } else {
      console.log(`[deleteAccountData] deleted ${targets[i].path}`);
    }
  });
}
