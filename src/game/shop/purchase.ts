import { Capacitor } from '@capacitor/core';
import { Purchases } from '@revenuecat/purchases-capacitor';
import type { PaidShopProduct } from './items';
import { auth } from '../../cloud/firebase';
import { createCheckoutSession } from '../../cloud/checkout';

export interface PurchaseResult {
  success: boolean;
}

const RC_KEYS = {
  android: 'goog_IwilcRsgHdtvpmaVGEXpjCfDPmZ',
  ios: 'appl_ohWrforBXxgopViIFWJMEdJeENu',
};

let rcInitialized = false;

export async function initRevenueCat(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (rcInitialized) return;

  const platform = Capacitor.getPlatform();
  const apiKey = platform === 'ios' ? RC_KEYS.ios : RC_KEYS.android;

  await Purchases.configure({ apiKey });
  rcInitialized = true;
}

async function completePurchaseNative(product: PaidShopProduct): Promise<PurchaseResult> {
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) {
      console.warn('[RC] No current offering');
      return { success: false };
    }

    // Find the package matching the product ID
    // Match either the RC package identifier or the underlying store product id,
    // so fulfillment works regardless of how packages are named in the RC dashboard.
    const pkg = current.availablePackages.find(
      (p: { identifier: string; storeProduct?: { identifier?: string } }) =>
        p.identifier === product.id || p.storeProduct?.identifier === product.id
    );
    if (!pkg) {
      console.warn('[RC] Package not found:', product.id);
      return { success: false };
    }

    // RevenueCat throws on failure and on user cancel (e.userCancelled, handled
    // below); reaching this line means the store completed the purchase. Do NOT
    // gate on entitlements.active: the timed-boost products are consumables,
    // which RevenueCat does not expose as active entitlements.
    await Purchases.purchasePackage({ aPackage: pkg });
    return { success: true };
  } catch (e: any) {
    if (e?.userCancelled) return { success: false };
    console.error('[RC] Purchase failed:', e);
    return { success: false };
  }
}

async function completePurchaseWeb(product: PaidShopProduct): Promise<PurchaseResult> {
  if (!auth) {
    console.warn('[purchase] blocked: auth unavailable');
    return { success: false };
  }
  const user = auth.currentUser;
  if (!user) {
    console.warn('[purchase] blocked: no user');
    return { success: false };
  }
  try {
    await createCheckoutSession(user.uid, product.id);
    return { success: false }; // Stripe redirects the page
  } catch (e) {
    console.error('[purchase] Checkout failed:', e);
    return { success: false };
  }
}

export async function completePurchase(product: PaidShopProduct): Promise<PurchaseResult> {
  if (Capacitor.isNativePlatform()) {
    return completePurchaseNative(product);
  }
  return completePurchaseWeb(product);
}

export async function completeMockPurchase(_product: PaidShopProduct): Promise<PurchaseResult> {
  return { success: true };
}

/**
 * Restore previously purchased non-consumables (Apple Guideline 3.1.1 requires
 * a restore mechanism). Returns the store product ids the account owns
 * (e.g. deep_space_storage). No-op on web — web fulfillment is server-side.
 */
export async function restorePurchases(): Promise<string[]> {
  if (!Capacitor.isNativePlatform()) return [];
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    const owned = new Set<string>(customerInfo?.allPurchasedProductIdentifiers ?? []);
    // Belt-and-suspenders: also include active entitlement product ids.
    const active = (customerInfo?.entitlements?.active ?? {}) as Record<
      string,
      { productIdentifier?: string }
    >;
    for (const ent of Object.values(active)) {
      if (ent.productIdentifier) owned.add(ent.productIdentifier);
    }
    return [...owned];
  } catch (e) {
    console.warn('[RC] restore failed:', e);
    return [];
  }
}
