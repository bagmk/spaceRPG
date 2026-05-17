import type { PaidShopProduct } from './items';
import { auth } from '../../cloud/firebase';
import { createCheckoutSession } from '../../cloud/checkout';

export interface PurchaseResult {
  success: boolean;
}

/**
 * Initiates a Stripe Checkout session.
 * Redirects to Stripe — the page will reload on success/cancel.
 * Returns { success: false } if user is not logged in or if it fails to start.
 */
export async function completePurchase(product: PaidShopProduct): Promise<PurchaseResult> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    return { success: false };
  }

  try {
    await createCheckoutSession(user.uid, product.id);
    // If we reach here, the redirect hasn't happened yet (waiting for extension)
    // The page will redirect when the session URL is ready
    return { success: false }; // Don't apply locally yet — wait for webhook confirmation
  } catch (e) {
    console.error('[purchase] Checkout failed:', e);
    return { success: false };
  }
}

/**
 * Mock purchase for development/testing without Stripe extension.
 */
export async function completeMockPurchase(_product: PaidShopProduct): Promise<PurchaseResult> {
  return { success: true };
}
