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
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  linkWithPopup,
  linkWithRedirect,
  type User,
} from 'firebase/auth';
import { auth } from '../cloud/firebase';
import { getProfile, createOrUpdateProfile, type UserProfile } from '../cloud/profile';

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
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Skip if a popup flow is in progress — we'll handle state after popup resolves
      if (popupInProgress.current) return;

      if (firebaseUser) {
        setUser(firebaseUser);

        if (firebaseUser.isAnonymous) {
          setStatus('anonymous');
        } else {
          // Ensure profile doc exists + fetch in parallel
          const providers = firebaseUser.providerData.map((pd) => pd.providerId);
          const profilePromise = getProfile(firebaseUser.uid);
          const p = await profilePromise;
          // Fire-and-forget profile update (non-blocking)
          createOrUpdateProfile(firebaseUser.uid, {
            email: firebaseUser.email ?? null,
            photoURL: firebaseUser.photoURL ?? null,
            providers,
            createdAt: p?.createdAt ?? Date.now(),
          });
          setProfile(p);

          if (!p?.displayName) {
            setStatus('needsName');
          } else {
            setStatus('authed');
          }
        }
        initialAuthDone.current = true;
      } else if (!initialAuthDone.current) {
        // First load, no user — auto sign in anonymously
        setUser(null);
        setProfile(null);
        setStatus('loading');
        try {
          await signInAnonymously(auth!);
        } catch (e) {
          console.error('[Auth] Anonymous sign-in failed:', e);
          setStatus('anonymous');
        }
        initialAuthDone.current = true;
      } else {
        // User signed out explicitly
        setUser(null);
        setProfile(null);
        setStatus('signedOut');
      }
    });
    return unsubscribe;
  }, []);

  // Handle redirect result on page load (after Google redirect returns)
  useEffect(() => {
    if (!auth) return;
    getRedirectResult(auth).then(async (result) => {
      if (!result) return;
      popupInProgress.current = true;
      try {
        setUser(result.user);
        const p = await getProfile(result.user.uid);
        const providers = result.user.providerData.map((pd) => pd.providerId);
        createOrUpdateProfile(result.user.uid, {
          email: result.user.email ?? null,
          photoURL: result.user.photoURL ?? null,
          providers,
          createdAt: p?.createdAt ?? Date.now(),
        });
        setProfile(p);
        if (!p?.displayName) {
          setStatus('needsName');
        } else {
          setStatus('authed');
        }
      } finally {
        popupInProgress.current = false;
      }
    }).catch((e: any) => {
      if (e.code === 'auth/credential-already-in-use') {
        // Will be handled by signInWithRedirect fallback
        const provider = new GoogleAuthProvider();
        signInWithRedirect(auth!, provider);
      } else {
        console.error('[Auth] Redirect result error:', e);
      }
    });
  }, []);

  const handleSignInWithGoogle = useCallback(async () => {
    if (!auth) return;
    const provider = new GoogleAuthProvider();
    await signInWithRedirect(auth, provider);
  }, []);

  const handleLinkWithGoogle = useCallback(async () => {
    if (!auth) return;
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const provider = new GoogleAuthProvider();
    try {
      await linkWithRedirect(currentUser, provider);
    } catch (e: any) {
      if (e.code === 'auth/credential-already-in-use') {
        await signInWithRedirect(auth, provider);
      } else {
        console.error('[Auth] Link error:', e);
      }
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    if (!auth) return;
    await auth.signOut();
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
    signOut: handleSignOut,
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
