// RevenueCat with lazy initialization to prevent native module crashes
import { Platform } from 'react-native';
import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL,
  PurchasesEntitlementInfo,
} from 'react-native-purchases';

import { CreditPackage } from '@/types';
import { addTokens } from '@/services/supabase';

const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS || '';
const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID || '';

// Product identifiers (must match RevenueCat dashboard & App Store Connect)
export const PRODUCT_IDS = {
  SCANS_10: 'ratioed_scans_10',
  SCANS_30: 'ratioed_scans_30',
  SCANS_100: 'ratioed_scans_100',
  UNLIMITED_MONTHLY: 'ratioed_unlimited_monthly',
} as const;

// Alias for store screen compatibility
export const PRODUCTS = {
  SCANS_10: PRODUCT_IDS.SCANS_10,
  SCANS_30: PRODUCT_IDS.SCANS_30,
  SCANS_100: PRODUCT_IDS.SCANS_100,
  UNLIMITED: PRODUCT_IDS.UNLIMITED_MONTHLY,
} as const;

// Credit amounts for each package
const CREDIT_AMOUNTS: Record<string, number> = {
  [PRODUCT_IDS.SCANS_10]: 10,
  [PRODUCT_IDS.SCANS_30]: 30,
  [PRODUCT_IDS.SCANS_100]: 100,
};

// Entitlement identifier for unlimited subscription
const UNLIMITED_ENTITLEMENT = 'unlimited';

// Track initialization state
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Lazy initialization - only configures RevenueCat when first needed
 * This prevents native module crashes by deferring until app is fully mounted
 */
async function ensureInitialized(): Promise<void> {
  if (isInitialized) return;

  // If already initializing, wait for it
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;

      if (!apiKey) {
        if (__DEV__) {
          console.warn('RevenueCat API key not configured');
        }
        return;
      }

      // Skip initialization for test keys in release builds (prevents crash)
      // Test keys start with 'test_' - only production keys (appl_, goog_) should be used in releases
      if (apiKey.startsWith('test_')) {
        if (__DEV__) {
          console.warn('RevenueCat: Skipping init - test API key detected. Use production key for releases.');
        }
        return;
      }

      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }

      await Purchases.configure({ apiKey });
      isInitialized = true;

      if (__DEV__) {
        console.log('RevenueCat initialized successfully');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('RevenueCat initialization failed:', error);
      }
      // Don't throw - allow app to continue without purchases
    }
  })();

  return initializationPromise;
}

/**
 * Initialize RevenueCat with user ID (call after auth)
 */
export async function initializePurchases(userId?: string): Promise<void> {
  await ensureInitialized();

  if (!isInitialized) return;

  try {
    if (userId) {
      await Purchases.logIn(userId);
    }
  } catch (error) {
    if (__DEV__) {
      console.error('RevenueCat login failed:', error);
    }
  }
}

/**
 * Log in user to RevenueCat
 */
export async function loginUser(userId: string): Promise<void> {
  await ensureInitialized();

  if (!isInitialized) return;

  try {
    await Purchases.logIn(userId);
  } catch (error) {
    if (__DEV__) {
      console.error('RevenueCat login failed:', error);
    }
  }
}

/**
 * Log out user from RevenueCat
 */
export async function logoutUser(): Promise<void> {
  if (!isInitialized) return;

  try {
    await Purchases.logOut();
  } catch (error) {
    if (__DEV__) {
      console.error('RevenueCat logout failed:', error);
    }
  }
}

/**
 * Get available packages from RevenueCat
 */
export async function getPackages(): Promise<PurchasesPackage[]> {
  await ensureInitialized();

  if (!isInitialized) return [];

  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages || [];
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to get packages:', error);
    }
    return [];
  }
}

/**
 * Get credit packages formatted for UI
 */
export async function getCreditPackages(): Promise<CreditPackage[]> {
  const packages = await getPackages();

  return packages
    .filter((pkg) => CREDIT_AMOUNTS[pkg.identifier])
    .map((pkg) => ({
      id: pkg.identifier,
      name: pkg.product.title,
      credits: CREDIT_AMOUNTS[pkg.identifier] || 0,
      price: pkg.product.priceString,
      priceNumber: pkg.product.price,
      isBestValue: pkg.identifier === PRODUCT_IDS.SCANS_30,
    }));
}

/**
 * Get all products (packages)
 */
export async function getProducts(): Promise<PurchasesPackage[]> {
  return getPackages();
}

/**
 * Purchase a product by ID
 */
export async function purchaseProduct(productId: string): Promise<boolean> {
  await ensureInitialized();

  if (!isInitialized) {
    if (__DEV__) {
      console.warn('RevenueCat not initialized, cannot purchase');
    }
    return false;
  }

  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages.find(
      (p) => p.identifier === productId || p.product.identifier === productId
    );

    if (!pkg) {
      if (__DEV__) {
        console.error('Package not found:', productId);
      }
      return false;
    }

    const { customerInfo } = await Purchases.purchasePackage(pkg);

    // Check if this was a credit purchase (not subscription)
    const credits = CREDIT_AMOUNTS[productId];
    if (credits) {
      // Add credits to user's account
      await addTokens(credits);
    }

    return true;
  } catch (error: unknown) {
    // Check if user cancelled
    if (error && typeof error === 'object' && 'userCancelled' in error && error.userCancelled) {
      return false;
    }

    if (__DEV__) {
      console.error('Purchase failed:', error);
    }
    throw error;
  }
}

/**
 * Purchase a package directly
 */
export async function purchasePackage(
  packageId: string
): Promise<{ success: boolean; credits?: number; isSubscription: boolean }> {
  await ensureInitialized();

  if (!isInitialized) {
    return { success: false, isSubscription: false };
  }

  try {
    const success = await purchaseProduct(packageId);
    const credits = CREDIT_AMOUNTS[packageId];
    const isSubscription = packageId === PRODUCT_IDS.UNLIMITED_MONTHLY;

    return {
      success,
      credits: credits || undefined,
      isSubscription,
    };
  } catch (error) {
    return { success: false, isSubscription: false };
  }
}

/**
 * Restore previous purchases
 */
export async function restorePurchases(): Promise<{ isSubscribed: boolean; restoredCredits: number }> {
  await ensureInitialized();

  if (!isInitialized) {
    return { isSubscribed: false, restoredCredits: 0 };
  }

  try {
    const customerInfo = await Purchases.restorePurchases();
    const isSubscribed = !!customerInfo.entitlements.active[UNLIMITED_ENTITLEMENT];

    // Note: Credits from one-time purchases can't be easily restored
    // They should be tracked server-side via webhooks
    return { isSubscribed, restoredCredits: 0 };
  } catch (error) {
    if (__DEV__) {
      console.error('Restore failed:', error);
    }
    return { isSubscribed: false, restoredCredits: 0 };
  }
}

/**
 * Check if user has active unlimited subscription
 */
export async function checkSubscriptionStatus(): Promise<boolean> {
  await ensureInitialized();

  if (!isInitialized) return false;

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return !!customerInfo.entitlements.active[UNLIMITED_ENTITLEMENT];
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to check subscription:', error);
    }
    return false;
  }
}

/**
 * Get customer info
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  await ensureInitialized();

  if (!isInitialized) return null;

  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to get customer info:', error);
    }
    return null;
  }
}
