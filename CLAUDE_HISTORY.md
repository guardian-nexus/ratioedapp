# Ratioed Development History

Last Updated: December 26, 2025

## Project Overview

Ratioed is a mobile app that analyzes text conversation screenshots to show who's putting in more effort. Built with Expo SDK 54, React Native, Expo Router, Supabase, and Claude API.

**Target:** Young adults (18-30) in dating/situationships
**Platforms:** iOS (primary), Android (secondary)
**Status:** Pre-launch, invite-only

## Current Build Status

- **iOS TestFlight:** Version 23+ (needs new build for latest features)
- **GitHub:** https://github.com/guardian-nexus/ratioedapp
- **Bundle ID:** com.guardiannexus.ratioed

## Recent Session Work (Dec 26, 2025)

### Issues Fixed

1. **502 Errors / Image Too Large**
   - Root cause: Android scroll captures were 3.2MB, Claude API returned 400
   - Solution: Added two-pass image compression in `services/claude/index.ts`
     - First pass: 1200px width @ 70% JPEG
     - If still >1MB, second pass: 800px width @ 50% JPEG
   - Requires: `expo-image-manipulator` (native module)

2. **Compare History Not Linking**
   - Issue: When comparing from results, Person A didn't get `compare_id`
   - Solution: Added `updateScanCompareId()` function in `services/supabase/index.ts`
   - Now both scans get same `compare_id` and appear grouped in history

3. **Share Card Rendering Artifacts**
   - White diagonal line caused by shadow glow on score
   - Gray corners from improper ViewShot clipping
   - Solution: Removed shadow, added wrapper with `overflow: 'hidden'`

4. **Light Mode Color Issues**
   - Auth screen: text invisible (white on white)
   - Store/tokens: link text wrong color
   - Solution: Added inline `{ color: colors.text }` overrides throughout

### Features Added

**High Impact:**
1. **Haptic Feedback** (`utils/haptics.ts`)
   - Light tap on button presses
   - Success vibration on score reveal
   - Uses `expo-haptics`

2. **App Store Review Prompt** (`utils/storeReview.ts`)
   - Prompts after 3 successful scans
   - 60-day cooldown between prompts
   - Uses `expo-store-review` + `@react-native-async-storage/async-storage`

3. **Score Animation** - Already existed (count-up + pop effect)

**Nice-to-Have:**
1. **Trend Tracking** - Already existed, shows ↑ improving / ↓ declining for same-label scans

2. **Quick Re-scan** (`app/scan/results/[id].tsx`)
   - "Scan more of this convo" button
   - Navigates to upload with `prefillLabel` param

3. **Skeleton Loaders** (`components/SkeletonLoader.tsx`)
   - `SkeletonLoader` - base animated component
   - `ScanCardSkeleton` - for single scan cards
   - `HistoryListSkeleton` - 3-card placeholder for history

4. **Pattern Explainers** (`utils/patternExplainers.ts`)
   - Tap any pattern card for detailed explanation modal
   - Shows: What It Means, Why It Matters, Tip (if available)
   - 20+ pattern explanations defined

## Key Files Modified

```
app/scan/results/[id].tsx     - Quick re-scan, pattern explainer modals
app/scan/upload.tsx           - Handle prefillLabel param
app/scan/analyzing.tsx        - Compare linking fix, delay between calls
app/(tabs)/history.tsx        - Skeleton loader integration
app/auth.tsx                  - Light mode color fixes
app/store/tokens.tsx          - Light mode color fixes
app/share.tsx                 - Remove divider, fix capture wrapper

components/GradientButton.tsx - Haptic feedback on press
components/ShareCard.tsx      - Remove shadow glow artifact
components/SkeletonLoader.tsx - NEW: Skeleton loading components

services/claude/index.ts      - Two-pass image compression, IMAGE_ERROR handling
services/supabase/index.ts    - updateScanCompareId function

utils/haptics.ts              - NEW: Haptic feedback utilities
utils/storeReview.ts          - NEW: App Store review prompt logic
utils/patternExplainers.ts    - NEW: Pattern explanation database
```

## Native Dependencies Added

These require a new EAS build:
- `expo-haptics` - Tactile feedback
- `expo-store-review` - Native review prompt
- `expo-image-manipulator` - Image compression (added earlier)
- `@react-native-async-storage/async-storage` - Persistent storage

## Edge Function (Supabase)

Production version in `/root/projects/ratioed/ratioedapp/EDGE_FUNCTION_PROD.ts` (temp file, deploy to Supabase and delete)

Key features:
- Retry logic with exponential backoff (3 retries)
- Handles 400 as IMAGE_ERROR
- Handles 429/529 as rate limiting
- Token refund on failures

## Pending / Known Issues

1. **New Build Needed** - Native modules added, run:
   ```bash
   eas build --platform ios --profile production --auto-submit
   ```

2. **Android Purchases** - Need production RevenueCat key

3. **Debug Button in Store** - "Debug: Check Products" should be removed before launch

## Architecture Notes

### Theme System
- `theme/index.ts` - Defines `darkColors` and `lightColors`
- `hooks/useColors.ts` - Returns current theme colors
- Pattern: StyleSheet uses `defaultColors`, inline styles override with `colors`

### Token System
- Users start with 5 free tokens
- 1 token per scan, 2 tokens for compare mode (1 if comparing from existing)
- Server-side atomic deduction via Supabase RPC `decrement_token`
- Refund on failures via `refund_token`

### Compare Modes
1. **Fresh compare** - Upload Person A + Person B screenshots, analyze both
2. **Compare from results** - Use existing scan as Person A, only analyze Person B (1 token)

### Score System
- 0-39: One-sided (red) - "You're doing all the work"
- 40-59: Mixed (yellow) - "Some imbalance"
- 60-100: Balanced (green) - "Matched energy"

## Commands

```bash
# Development
npx expo start --dev-client --tunnel

# Type check
npx tsc --noEmit

# Build for TestFlight
eas build --platform ios --profile production --auto-submit

# Push to GitHub
git add -A && git commit -m "message" && git push origin main
```

## Brand Colors

- Gradient: `#ec4899` (pink) → `#f97316` (orange)
- Background: `#0a0a0a` (dark), `#ffffff` (light)
- Surface: `#1a1a1a` (dark), `#f5f5f5` (light)
- Score Green: `#22c55e`
- Score Yellow: `#eab308`
- Score Red: `#ef4444`
