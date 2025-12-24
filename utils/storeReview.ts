// utils/storeReview.ts
// App Store review prompt logic

import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SCAN_COUNT_KEY = '@ratioed_scan_count';
const LAST_PROMPT_KEY = '@ratioed_last_review_prompt';
const SCANS_BEFORE_PROMPT = 3;
const MIN_DAYS_BETWEEN_PROMPTS = 60; // Don't ask again for 60 days

export async function trackScanAndMaybePromptReview(): Promise<void> {
  try {
    // Get current scan count
    const countStr = await AsyncStorage.getItem(SCAN_COUNT_KEY);
    const count = countStr ? parseInt(countStr, 10) : 0;
    const newCount = count + 1;

    // Save new count
    await AsyncStorage.setItem(SCAN_COUNT_KEY, newCount.toString());

    // Check if we should prompt for review
    if (newCount >= SCANS_BEFORE_PROMPT) {
      await maybePromptReview();
    }
  } catch (error) {
    // Silent fail - don't let review tracking break the app
    if (__DEV__) {
      console.warn('Store review tracking error:', error);
    }
  }
}

async function maybePromptReview(): Promise<void> {
  try {
    // Check if we've prompted recently
    const lastPromptStr = await AsyncStorage.getItem(LAST_PROMPT_KEY);
    if (lastPromptStr) {
      const lastPrompt = new Date(lastPromptStr);
      const daysSince = (Date.now() - lastPrompt.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince < MIN_DAYS_BETWEEN_PROMPTS) {
        return; // Too soon to ask again
      }
    }

    // Check if store review is available
    const isAvailable = await StoreReview.isAvailableAsync();
    if (!isAvailable) {
      return;
    }

    // Request review
    await StoreReview.requestReview();

    // Record that we prompted
    await AsyncStorage.setItem(LAST_PROMPT_KEY, new Date().toISOString());
  } catch (error) {
    // Silent fail
    if (__DEV__) {
      console.warn('Store review prompt error:', error);
    }
  }
}

// Reset for testing (call from dev menu if needed)
export async function resetReviewTracking(): Promise<void> {
  await AsyncStorage.removeItem(SCAN_COUNT_KEY);
  await AsyncStorage.removeItem(LAST_PROMPT_KEY);
}
