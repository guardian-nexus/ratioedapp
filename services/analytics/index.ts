// PostHog Analytics with lazy initialization to prevent native module crashes
import { PostHog } from 'posthog-react-native';

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY || '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

// Track initialization state
let posthog: PostHog | null = null;
let isInitialized = false;

/**
 * Lazy initialization - only configures PostHog when first needed
 * This prevents native module crashes by deferring until app is fully mounted
 */
function ensureInitialized(): PostHog | null {
  if (isInitialized) return posthog;

  try {
    if (!POSTHOG_API_KEY) {
      if (__DEV__) {
        console.warn('PostHog API key not configured');
      }
      isInitialized = true;
      return null;
    }

    posthog = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
    });

    isInitialized = true;

    if (__DEV__) {
      console.log('PostHog initialized successfully');
    }

    return posthog;
  } catch (error) {
    if (__DEV__) {
      console.error('PostHog initialization failed:', error);
    }
    isInitialized = true;
    return null;
  }
}

/**
 * Initialize PostHog (call early in app lifecycle)
 */
export function initializeAnalytics(): PostHog | null {
  return ensureInitialized();
}

/**
 * Get PostHog instance
 */
export function getPostHog(): PostHog | null {
  return posthog;
}

/**
 * Identify a user
 */
export function identify(userId: string, properties?: Record<string, unknown>): void {
  const ph = ensureInitialized();
  if (!ph) {
    if (__DEV__) {
      console.log('[Analytics] identify:', userId, properties);
    }
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ph.identify(userId, properties as any);
  } catch (error) {
    if (__DEV__) {
      console.error('PostHog identify failed:', error);
    }
  }
}

/**
 * Track an event
 */
export function track(event: string, properties?: Record<string, unknown>): void {
  const ph = ensureInitialized();
  if (!ph) {
    if (__DEV__) {
      console.log('[Analytics]', event, properties);
    }
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ph.capture(event, properties as any);
  } catch (error) {
    if (__DEV__) {
      console.error('PostHog track failed:', error);
    }
  }
}

/**
 * Track a screen view
 */
export function screen(screenName: string, properties?: Record<string, unknown>): void {
  const ph = ensureInitialized();
  if (!ph) {
    if (__DEV__) {
      console.log('[Analytics] screen:', screenName, properties);
    }
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ph.screen(screenName, properties as any);
  } catch (error) {
    if (__DEV__) {
      console.error('PostHog screen failed:', error);
    }
  }
}

/**
 * Reset user identity (on logout)
 */
export function reset(): void {
  const ph = ensureInitialized();
  if (!ph) return;

  try {
    ph.reset();
  } catch (error) {
    if (__DEV__) {
      console.error('PostHog reset failed:', error);
    }
  }
}

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
