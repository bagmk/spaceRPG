/**
 * Purchase + restore event tracking (Firestore).
 *
 * Append-only audit log at users/{uid}/purchase_events/{auto}. Best-effort:
 * no-ops when offline or signed out, and never throws into the UI. Web Stripe
 * purchases are tracked server-side by the Stripe extension; this covers the
 * native RevenueCat purchase and restore flows.
 */
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { db, auth } from './firebase';

export type PurchaseEventType = 'purchase' | 'restore';

export interface PurchaseEvent {
  type: PurchaseEventType;
  productId: string;
  priceUSD?: number;
}

export async function recordPurchaseEvent(event: PurchaseEvent): Promise<void> {
  const uid = auth?.currentUser?.uid;
  if (!db || !uid) return; // anonymous / offline: skip silently
  try {
    await addDoc(collection(db, 'users', uid, 'purchase_events'), {
      type: event.type,
      productId: event.productId,
      priceUSD: event.priceUSD ?? null,
      platform: Capacitor.getPlatform(),                 // 'ios' | 'android' | 'web'
      store: Capacitor.isNativePlatform() ? 'revenuecat' : 'stripe',
      createdAt: Date.now(),
      serverTime: serverTimestamp(),
    });
  } catch (e) {
    console.warn('[purchases] track failed:', e);
  }
}
