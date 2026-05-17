/**
 * Stripe checkout via Firebase Extension pattern.
 *
 * Flow:
 * 1. Client writes to `users/{uid}/checkout_sessions/{auto}` with price + urls
 * 2. Firebase "Run Payments with Stripe" extension creates Stripe session
 * 3. Extension writes `url` back to the doc
 * 4. Client watches the doc and redirects to Stripe Checkout
 *
 * PREREQUISITE: Install "Run Payments with Stripe" extension in Firebase Console.
 */

import {
  collection,
  addDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';

// ---------------------------------------------------------------------------
// Price ID mapping (game item ID → Stripe price ID)
// ---------------------------------------------------------------------------

export const STRIPE_PRICE_MAP: Record<string, string> = {
  temporal_drive: 'price_1TXuwN0YrtIQqiezrknwjTnN',
  matter_surge: 'price_1TXuwq0YrtIQqiezcYBDvfMF',
  deep_time_engine: 'price_1TXux90YrtIQqiez9u0deiYV',
  matter_storm: 'price_1TXuxJ0YrtIQqiezoAmdJZK7',
  deep_space_storage: 'price_1TXuxU0YrtIQqiezkkNkGwpV',
};

// ---------------------------------------------------------------------------
// Create checkout session
// ---------------------------------------------------------------------------

export async function createCheckoutSession(
  uid: string,
  itemId: string,
): Promise<void> {
  const priceId = STRIPE_PRICE_MAP[itemId];
  if (!priceId) {
    console.error('[checkout] Unknown item:', itemId);
    return;
  }

  if (!db) { console.error('[checkout] Firestore not available'); return; }

  const successUrl = `${window.location.origin}${window.location.pathname}?payment=success`;
  const cancelUrl = `${window.location.origin}${window.location.pathname}?payment=cancelled`;

  const sessionsRef = collection(db, 'users', uid, 'checkout_sessions');
  console.log('[checkout] writing session doc...', { uid, priceId, successUrl });
  const docRef = await addDoc(sessionsRef, {
    price: priceId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    mode: 'payment',
  });
  console.log('[checkout] doc created:', docRef.id, '— waiting for extension to write URL...');

  // Watch for the extension to write back the session URL
  const unsubscribe = onSnapshot(docRef, (snap) => {
    const data = snap.data();
    if (data?.url) {
      unsubscribe();
      window.location.assign(data.url);
    }
    if (data?.error) {
      unsubscribe();
      console.error('[checkout] Session creation failed:', data.error);
      alert(data.error.message ?? 'Payment failed to initialize');
    }
  });

  // Timeout after 10 seconds
  setTimeout(() => {
    unsubscribe();
  }, 10_000);
}
