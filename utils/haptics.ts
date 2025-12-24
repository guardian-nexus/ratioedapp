// utils/haptics.ts
// Haptic feedback utilities for key user interactions

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Light tap - for button presses, selections
export function tapLight() {
  if (Platform.OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

// Medium tap - for confirmations, toggles
export function tapMedium() {
  if (Platform.OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
}

// Heavy tap - for important actions, deletions
export function tapHeavy() {
  if (Platform.OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
}

// Success - for completed actions (scan complete, save success)
export function success() {
  if (Platform.OS === 'ios') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}

// Warning - for alerts, confirmations
export function warning() {
  if (Platform.OS === 'ios') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
}

// Error - for failures
export function error() {
  if (Platform.OS === 'ios') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
}

// Selection change - for pickers, sliders
export function selection() {
  if (Platform.OS === 'ios') {
    Haptics.selectionAsync();
  }
}
