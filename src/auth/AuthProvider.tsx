import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signInWithCredential,
  linkWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  linkWithPopup,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { auth } from '../cloud/firebase';
import { getProfile, createOrUpdateProfile, deleteAccountData, type UserProfile } from '../cloud/profile';
import { clearSave } from '../game/storage';
import { CONSENT_VERSION } from './consent';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuthStatus = 'loading' | 'anonymous' | 'needsName' | 'authed' | 'signedOut';

export interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  status: AuthStatus;
  signInWithGoogle: () => Promise<void>;
  linkWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  linkWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Sign in with Apple - platform helpers
// ---------------------------------------------------------------------------

// True inside any native Capacitor shell (iOS/Android). On native we bridge the
// provider credential into the JS SDK so all src/cloud/* code (which reads
// getAuth()) keeps working. Reading the global avoids importing @capacitor/core,
// so the web build keeps zero native dependencies.
function isNativePlatform(): boolean {
  const cap = (globalThis as any).Capacitor;
  return !!cap?.isNativePlatform?.();
}

// Access Capacitor Firebase Authentication plugin via the global Capacitor registry.
// This avoids dynamic import() issues in the built Vite bundle.
function getFirebaseAuthPlugin(): any {
  const cap = (globalThis as any).Capacitor;
  const plugin = cap?.Plugins?.FirebaseAuthentication;
  if (!plugin) throw new Error('FirebaseAuthentication plugin not available');
  return plugin;
}

async function nativeAppleCredential() {
  const plugin = getFirebaseAuthPlugin();
  console.log('[Auth] Calling native Apple sign-in...');

  // Same Capacitor 8 SPM workaround as Google: dual-channel resolution.
  const result = await new Promise<any>((resolve, reject) => {
    let settled = false;
    const settle = (val: any) => { if (!settled) { settled = true; resolve(val); } };

    plugin.signInWithApple().then(settle).catch((e: any) => {
      if (!settled) { settled = true; reject(e); }
    });

    plugin.addListener('appleSignInResult', (data: any) => {
      console.log('[Auth] Got appleSignInResult event');
      settle(data);
    });
  });

  console.log('[Auth] Apple result:', JSON.stringify(result));
  const idToken = result?.credential?.idToken;
  const rawNonce = result?.credential?.nonce;
  if (!idToken) throw new Error('Apple did not return an identity token');
  return new OAuthProvider('apple.com').credential({ idToken, rawNonce });
}

async function nativeGoogleCredential() {
  const plugin = getFirebaseAuthPlugin();
  console.log('[Auth] Calling native Google sign-in...');

  // Capacitor 8 SPM bug: call.resolve() doesn't reach JS because the bridge's
  // weak self reference is nil in the success handler.  Work around by listening
  // for a custom event from the native side as a fallback channel.
  const result = await new Promise<any>((resolve, reject) => {
    let settled = false;
    const settle = (val: any) => { if (!settled) { settled = true; resolve(val); } };

    // Channel 1: normal resolve (may work in future Capacitor versions)
    plugin.signInWithGoogle().then(settle).catch((e: any) => {
      if (!settled) { settled = true; reject(e); }
    });

    // Channel 2: event listener fallback
    plugin.addListener('googleSignInResult', (data: any) => {
      console.log('[Auth] Got googleSignInResult event:', JSON.stringify(data));
      settle(data);
    });
  });

  console.log('[Auth] Google result:', JSON.stringify(result));
  const idToken = result?.credential?.idToken;
  if (!idToken) {
    throw new Error('Google sign-in did not return an ID token');
  }
  return GoogleAuthProvider.credential(idToken);
}

// Re-authenticate the current user. Firebase requires a fresh sign-in before
// deleteUser when the session is older than ~5 minutes. Mirrors sign-in routing.
async function reauthenticateUser(user: User): Promise<void> {
  const providerId = user.providerData[0]?.providerId ?? 'google.com';
  if (providerId === 'apple.com') {
    if (isNativePlatform()) {
      await reauthenticateWithCredential(user, await nativeAppleCredential());
    } else {
      await reauthenticateWithPopup(user, new OAuthProvider('apple.com'));
    }
  } else {
    if (isNativePlatform()) {
      await reauthenticateWithCredential(user, await nativeGoogleCredential());
    } else {
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
    }
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const popupInProgress = useRef(false);
  const initialAuthDone = useRef(false);

  const refreshProfile = useCallback(async () => {
    const currentUser = auth?.currentUser;
    if (!currentUser) return;
    const p = await getProfile(currentUser.uid);
    setProfile(p);
    if (currentUser.isAnonymous) {
      setStatus('anonymous');
    } else if (!p?.displayName) {
      setStatus('needsName');
    } else {
      setStatus('authed');
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      // Firebase not available — go straight to anonymous/offline mode
      setStatus('anonymous');
      initialAuthDone.current = true;
      return;
    }
    // Fallback: if onAuthStateChanged never resolves, stop showing "Connecting..."
    const loadingTimeout = setTimeout(() => {
      if (!initialAuthDone.current) {
        console.warn('[Auth] Loading timeout — falling back to signedOut');
        setStatus('signedOut');
        initialAuthDone.current = true;
      }
    }, 2000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('[Auth] onAuthStateChanged fired, user:', !!firebaseUser, 'popup:', popupInProgress.current);
      // Skip if a popup flow is in progress — we'll handle state after popup resolves
      if (popupInProgress.current) return;

      try {
        if (firebaseUser) {
          if (firebaseUser.isAnonymous) {
            // Ignore anonymous users — sign them out silently
            await auth!.signOut();
            return;
          }
          setUser(firebaseUser);
          const providers = firebaseUser.providerData.map((pd) => pd.providerId);
          const p = await getProfile(firebaseUser.uid);
          createOrUpdateProfile(firebaseUser.uid, {
            email: firebaseUser.email ?? null,
            photoURL: firebaseUser.photoURL ?? null,
            providers,
            createdAt: p?.createdAt ?? Date.now(),
            // Record consent version in Firestore for audit trail.
            // Only write if newer than what's already stored.
            ...((!p?.consentVersion || p.consentVersion < CONSENT_VERSION)
              ? { consentVersion: CONSENT_VERSION, consentAcceptedAt: Date.now() }
              : {}),
          });
          setProfile(p);

          if (!p?.displayName) {
            setStatus('needsName');
          } else {
            setStatus('authed');
          }
          initialAuthDone.current = true;
        } else {
          // No user — show login screen
          setUser(null);
          setProfile(null);
          setStatus('signedOut');
          initialAuthDone.current = true;
        }
      } catch (e) {
        console.error('[Auth] onAuthStateChanged error:', e);
        setStatus('signedOut');
        initialAuthDone.current = true;
      }
    });
    return () => { clearTimeout(loadingTimeout); unsubscribe(); };
  }, []);

  const handleSignInWithGoogle = useCallback(async () => {
    if (!auth) return;
    popupInProgress.current = true;
    try {
      const native = isNativePlatform();
      console.log('[Auth] isNativePlatform:', native);
      let result;
      if (native) {
        const credential = await nativeGoogleCredential();
        result = await signInWithCredential(auth, credential);
      } else {
        result = await signInWithPopup(auth, new GoogleAuthProvider());
      }
      setUser(result.user);
      const p = await getProfile(result.user.uid);
      const providers = result.user.providerData.map((pd) => pd.providerId);
      await createOrUpdateProfile(result.user.uid, {
        email: result.user.email ?? null,
        photoURL: result.user.photoURL ?? null,
        providers,
        createdAt: p?.createdAt ?? Date.now(),
        // Consent accepted by tapping "Continue with Google" — record in Firestore.
        consentVersion: CONSENT_VERSION,
        consentAcceptedAt: Date.now(),
      });
      const updatedProfile = await getProfile(result.user.uid);
      setProfile(updatedProfile);
      setStatus(!updatedProfile?.displayName ? 'needsName' : 'authed');
    } catch (e: any) {
      if (e?.code !== 'auth/popup-closed-by-user') {
        console.error('[Auth] Google sign-in error:', JSON.stringify(e), e?.message, e?.code, e?.stack);
      }
      throw e;
    } finally {
      popupInProgress.current = false;
    }
  }, []);

  const handleLinkWithGoogle = useCallback(async () => {
    if (!auth) return;
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    popupInProgress.current = true;
    try {
      if (isNativePlatform()) {
        await linkWithCredential(currentUser, await nativeGoogleCredential());
      } else {
        await linkWithPopup(currentUser, new GoogleAuthProvider());
      }
    } catch (e: any) {
      if (e.code === 'auth/credential-already-in-use') {
        if (isNativePlatform()) {
          await signInWithCredential(auth, await nativeGoogleCredential());
        } else {
          await signInWithPopup(auth, new GoogleAuthProvider());
        }
      } else if (e.code !== 'auth/popup-closed-by-user') {
        console.error('[Auth] Link error:', e);
      }
    } finally {
      popupInProgress.current = false;
    }
  }, []);

  const handleSignInWithApple = useCallback(async () => {
    if (!auth) return;
    popupInProgress.current = true;
    try {
      let result: UserCredential;
      if (isNativePlatform()) {
        result = await signInWithCredential(auth, await nativeAppleCredential());
      } else {
        const provider = new OAuthProvider('apple.com');
        provider.addScope('email');
        provider.addScope('name');
        result = await signInWithPopup(auth, provider);
      }
      setUser(result.user);
      // Apple returns email/name ONLY on the first authorization - capture it now.
      // Never overwrite profile.displayName (that is the user-set in-game name).
      const p = await getProfile(result.user.uid);
      const providers = result.user.providerData.map((pd) => pd.providerId);
      await createOrUpdateProfile(result.user.uid, {
        email: result.user.email ?? null,
        photoURL: result.user.photoURL ?? null,
        providers,
        createdAt: p?.createdAt ?? Date.now(),
        // Consent accepted by tapping "Continue with Apple" — record in Firestore.
        consentVersion: CONSENT_VERSION,
        consentAcceptedAt: Date.now(),
      });
      const updatedProfile = await getProfile(result.user.uid);
      setProfile(updatedProfile);
      setStatus(!updatedProfile?.displayName ? 'needsName' : 'authed');
    } catch (e: any) {
      // 1001 = user canceled the native Apple sheet
      if (e?.code !== 'auth/popup-closed-by-user' && e?.code !== '1001') {
        console.error('[Auth] Apple sign-in error:', e);
      }
    } finally {
      popupInProgress.current = false;
    }
  }, []);

  const handleLinkWithApple = useCallback(async () => {
    if (!auth) return;
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    popupInProgress.current = true;
    try {
      if (isNativePlatform()) {
        await linkWithCredential(currentUser, await nativeAppleCredential());
      } else {
        const provider = new OAuthProvider('apple.com');
        provider.addScope('email');
        provider.addScope('name');
        await linkWithPopup(currentUser, provider);
      }
    } catch (e: any) {
      if (e?.code === 'auth/credential-already-in-use') {
        // This Apple ID already maps to an account - sign into it instead.
        if (isNativePlatform()) {
          await signInWithCredential(auth, await nativeAppleCredential());
        } else {
          await signInWithPopup(auth, new OAuthProvider('apple.com'));
        }
      } else if (e?.code !== 'auth/popup-closed-by-user' && e?.code !== '1001') {
        console.error('[Auth] Apple link error:', e);
      }
    } finally {
      popupInProgress.current = false;
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    if (!auth) return;
    clearSave();
    await auth.signOut();
    setUser(null);
    setProfile(null);
    setStatus('signedOut');
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    if (!auth) return;
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    // 1) Remove owned Firestore data while still authenticated (best-effort).
    try {
      await deleteAccountData(currentUser.uid);
    } catch (e) {
      console.warn('[deleteAccount] Firestore cleanup failed (continuing):', e);
    }
    // 2) Clear local save so progress doesn't resurrect on next login.
    clearSave();
    // 3) Delete the auth account.
    const isAnonymous = currentUser.isAnonymous || currentUser.providerData.length === 0;
    if (isAnonymous) {
      // Anonymous users can be deleted directly (no reauth needed for fresh sessions).
      // If session is stale, there is no way to reauth an anonymous user, so just sign out.
      try {
        await deleteUser(currentUser);
      } catch {
        // Stale anonymous session — sign out only (account will be auto-cleaned by Firebase).
        await auth.signOut();
      }
    } else {
      // Linked account — reauthenticate if session is too old.
      try {
        await deleteUser(currentUser);
      } catch (e: any) {
        if (e?.code === 'auth/requires-recent-login') {
          await reauthenticateUser(currentUser);
          await deleteUser(currentUser);
        } else {
          throw e;
        }
      }
    }
    setUser(null);
    setProfile(null);
    setStatus('signedOut');
  }, []);

  const value: AuthContextValue = {
    user,
    profile,
    status,
    signInWithGoogle: handleSignInWithGoogle,
    linkWithGoogle: handleLinkWithGoogle,
    signInWithApple: handleSignInWithApple,
    linkWithApple: handleLinkWithApple,
    signOut: handleSignOut,
    deleteAccount: handleDeleteAccount,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
