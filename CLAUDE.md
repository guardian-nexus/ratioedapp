# Ratioed Rebuild - Claude Code Context

## PRIORITY: GitHub Setup Needed
**User needs to set up a GitHub repo for the entire `/root/projects/ratioed` project.**
- No remote configured yet
- All files staged but not committed
- Ensure frequent pushes/backups after significant changes
- Remind user to commit and push periodically

---

## Project Overview
Mobile app that analyzes text conversation screenshots to show who's putting in more effort. Built with Expo SDK 54, React Native, Expo Router, Supabase, and Claude API.

**Bundle ID:** com.guardiannexus.ratioed
**EAS Project:** @dijitaljedi/ratioed

---

## Current State (as of Dec 18, 2025)

### What's Working
- iOS production build #13 on TestFlight
- App launches and works in production builds
- Auth flow (Apple Sign In, email/password)
- Scan flow (screenshot upload, analysis, results)
- Compare mode, chat export mode, group chat mode
- Supabase integration (profiles, scans, invites, promo codes)

### What's Stubbed (Needs Re-adding)
- **RevenueCat** (`react-native-purchases`) - removed from package.json, stubbed in `services/revenuecat/index.ts`
- **PostHog** (`posthog-react-native`) - removed from package.json, stubbed in `services/analytics/index.ts`
- Both caused production crashes due to native module initialization timing

### Key Fix Applied
**Production Crash Fix:** Supabase client was initializing at module load time before SecureStore was ready. Fixed with lazy initialization using Proxy pattern in `services/supabase/index.ts`.

---

## Architecture

### File Structure
```
app/
├── _layout.tsx          # Root layout with providers
├── index.tsx            # Entry point, routing logic, splash screen
├── onboarding.tsx       # 4-slide carousel
├── auth.tsx             # Login/Signup with invite code
├── (tabs)/              # Main tab navigator
│   ├── index.tsx        # Home screen
│   └── history.tsx      # Scan history
├── scan/
│   ├── upload.tsx       # Screenshot upload (1-8 images)
│   ├── compare.tsx      # Compare two convos
│   ├── analyzing.tsx    # Loading screen, calls Claude
│   ├── results/[id].tsx # Score and breakdown
│   └── group-results.tsx
└── store/tokens.tsx     # Purchase screen (stubbed)
```

### Services
- `services/supabase/` - Database, auth, profiles, scans, invites
- `services/claude/` - Calls Supabase edge functions for AI analysis
- `services/auth/` - AuthContext provider
- `services/revenuecat/` - STUBBED - purchases
- `services/analytics/` - STUBBED - PostHog tracking

### Supabase Edge Functions (deployed separately)
- `analyze-scan` - OCR and message extraction via Claude
- `interpret-patterns` - Generate taglines
- `deduct-token` - Atomic token deduction

---

## Environment Variables
Set in `eas.json` under `build.base.env`:
- `EXPO_PUBLIC_SUPABASE_URL` - https://kzpjdysofecbzpyeidyn.supabase.co
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - (JWT in eas.json)

---

## Common Commands

```bash
# Development with dev client
npx expo start --dev-client --tunnel

# Test production JS without rebuilding (requires dev client installed)
npx expo start --dev-client --no-dev --minify --tunnel

# Build for TestFlight
eas build --platform ios --profile production

# Submit to App Store Connect
eas submit --platform ios --latest

# Type check
npx tsc --noEmit
```

---

## Remaining Tasks

1. **SET UP GITHUB REPO (PRIORITY)**
   - Create repo for entire `/root/projects/ratioed` project
   - Add remote, commit, and push
   - Set up regular backup routine - push after significant changes

2. **Re-add RevenueCat properly**
   - Need lazy initialization like Supabase
   - Or defer init until after app is mounted

3. **Re-add PostHog properly**
   - Same lazy initialization approach

4. **Verify starting credits**
   - New users should get 5 tokens via Supabase trigger

---

## Error Handling

The app handles these error codes from edge functions:
- `NO_TOKENS` - User needs more credits
- `RATE_LIMITED` - High demand
- `API_UNAVAILABLE` / `MAINTENANCE` - Service down
- `API_CREDITS_EXHAUSTED` - Backend Claude credits depleted

See `services/claude/index.ts` for `getErrorMessage()` and `isMaintenanceError()`.

---

## Design System

**Brand gradient:** `#ec4899` (pink) → `#f97316` (orange)

**Score colors:**
- 0-39: Red (`#ef4444`) - One-sided
- 40-59: Yellow (`#f59e0b`) - Mixed
- 60-100: Green (`#22c55e`) - Balanced

**Backgrounds:** `#0a0a0a` (main), `#1a1a1a` (cards)
