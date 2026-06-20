import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

// Dev/offline escape hatch: `VITE_FORCE_OFFLINE=1` skips Firebase init so the app
// takes its existing anonymous/offline path (no login wall) — for local testing
// and previews. Production builds never set it, so it has zero prod effect.
const forceOffline = import.meta.env.VITE_FORCE_OFFLINE === '1';

try {
  if (!forceOffline && firebaseConfig.apiKey && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    // Keep localStorage persistence for Capacitor, but explicitly install the
    // browser resolver because initializeAuth() does not add it automatically.
    auth = initializeAuth(app, {
      persistence: browserLocalPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
    db = getFirestore(app);
  } else {
    console.warn(`[Firebase] ${forceOffline ? 'VITE_FORCE_OFFLINE set' : 'Missing config'} — running in offline mode`);
  }
} catch (e) {
  console.error('[Firebase] Init failed — running in offline mode', e);
}

export { app, auth, db };
