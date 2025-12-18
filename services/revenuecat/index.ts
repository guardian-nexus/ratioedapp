// TEMPORARILY STUBBED - RevenueCat native module causing production crashes
// import Purchases, { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
// import { Platform } from 'react-native';

import { CreditPackage } from '@/types';

// Stub types
type PurchasesPackage = { identifier: string; product: { priceString: string; price: number } };
type CustomerInfo = { entitlements: { active: Record<string, unknown> } };

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

// Initialize RevenueCat - STUBBED
export async function initializePurchases(userId?: string): Promise<void> {
  if (__DEV__) {
    console.log('RevenueCat stubbed - initializePurchases called');
  }
}

// ALL FUNCTIONS STUBBED - RevenueCat will be re-enabled after fixing native module issues

export async function loginUser(_userId: string): Promise<void> {}
export async function logoutUser(): Promise<void> {}
export async function getPackages(): Promise<PurchasesPackage[]> { return []; }
export async function getCreditPackages(): Promise<CreditPackage[]> { return []; }
export async function purchasePackage(_packageId: string): Promise<{ success: boolean; credits?: number; isSubscription: boolean }> {
  return { success: false, isSubscription: false };
}
export async function restorePurchases(): Promise<{ isSubscribed: boolean; restoredCredits: number }> {
  return { isSubscribed: false, restoredCredits: 0 };
}
export async function checkSubscriptionStatus(): Promise<boolean> { return false; }
export async function getCustomerInfo(): Promise<CustomerInfo | null> { return null; }
export async function getProducts(): Promise<PurchasesPackage[]> { return []; }
export async function purchaseProduct(_productId: string): Promise<boolean> { return false; }
