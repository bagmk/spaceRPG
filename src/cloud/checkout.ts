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

// Overhaul-2: the time-boost IAPs were removed; matter packs (pack_1..6) replace
// them. NATIVE purchases use RevenueCat (product ids directly), so they work
// without this map. WEB Stripe checkout needs a real Stripe price id per item —
// the placeholders below MUST be replaced with the real ids created in Stripe
// (and server-side fulfillment must credit the matter_pack payout) before web
// checkout works. Until then, web pack purchases no-op (logged 'Unknown item').
export const STRIPE_PRICE_MAP: Record<string, string> = {
  deep_space_storage: 'price_1TXuxU0YrtIQqiezkkNkGwpV',
  // TODO(stripe): set real price ids for the matter packs.
  pack_1: 'price_TODO_pack_1',
  pack_2: 'price_TODO_pack_2',
  pack_3: 'price_TODO_pack_3',
  pack_4: 'price_TODO_pack_4',
  pack_5: 'price_TODO_pack_5',
  pack_6: 'price_TODO_pack_6',
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
