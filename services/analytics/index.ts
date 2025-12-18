// TEMPORARILY STUBBED - PostHog native module causing production crashes
// import PostHog from 'posthog-react-native';

// Stub type
type PostHog = unknown;

let posthog: PostHog | null = null;

// ALL FUNCTIONS STUBBED
export function initializeAnalytics(): PostHog | null { return null; }
export function getPostHog(): PostHog | null { return null; }
export function identify(_userId: string, _properties?: Record<string, unknown>): void {}
export function track(event: string, properties?: Record<string, unknown>): void {
  if (__DEV__) {
    console.log('[Analytics - Stubbed]', event, properties);
  }
}
export function screen(_screenName: string, _properties?: Record<string, unknown>): void {}
export function reset(): void {}

// Predefined events from spec
export const Events = {
  // App lifecycle
  APP_OPEN: 'app_open',

  // Scan flow
  SCREENSHOT_ADDED: 'screenshot_added',
  SCAN_STARTED: 'scan_started',
  SCAN_COMPLETED: 'scan_completed',
  SCAN_FAILED: 'scan_failed',
  RESULTS_VIEWED: 'results_viewed',

  // Share
  SHARE_TAPPED: 'share_tapped',
  SHARE_COMPLETED: 'share_completed',

  // Purchases
  PURCHASE_STARTED: 'purchase_started',
  PURCHASE_COMPLETED: 'purchase_completed',
  PURCHASE_FAILED: 'purchase_failed',
  CREDITS_DEPLETED: 'credits_depleted',

  // Features
  COMPARE_MODE_USED: 'compare_mode_used',
  ROAST_MODE_TOGGLED: 'roast_mode_toggled',

  // Invite system
  INVITE_CODE_SHARED: 'invite_code_shared',
  INVITE_CODE_USED: 'invite_code_used',

  // Promo codes
  PROMO_CODE_REDEEMED: 'promo_code_redeemed',

  // Waitlist
  WAITLIST_JOINED: 'waitlist_joined',

  // Auth
  SIGN_UP: 'sign_up',
  SIGN_IN: 'sign_in',
  SIGN_OUT: 'sign_out',
  ACCOUNT_DELETED: 'account_deleted',

  // Errors
  ERROR_OCCURRED: 'error_occurred',
} as const;

// Helper functions for common tracking patterns
export function trackScanStarted(imageCount: number, roastMode: boolean): void {
  track(Events.SCAN_STARTED, { image_count: imageCount, roast_mode: roastMode });
}

export function trackScanCompleted(score: number, roastMode: boolean): void {
  track(Events.SCAN_COMPLETED, { score, roast_mode: roastMode });
}

export function trackPurchaseStarted(productId: string, price: number): void {
  track(Events.PURCHASE_STARTED, { product_id: productId, price });
}

export function trackPurchaseCompleted(productId: string, credits: number): void {
  track(Events.PURCHASE_COMPLETED, { product_id: productId, credits });
}

export function trackError(errorType: string, errorMessage: string): void {
  track(Events.ERROR_OCCURRED, { error_type: errorType, error_message: errorMessage });
}

export default posthog;
