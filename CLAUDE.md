# Ratioed Rebuild - Claude Code Context

## Working Style

**Communication Preferences**
- Direct and practical - Skip the corporate speak, get to the point
- Slightly dark humor welcome - Honesty with a side of "this is a mess but we'll figure it out"
- Don't assume, ask - If direction is unclear, clarify don't guess
- No hand-holding - Collaborator not tutor

**Technical Standards**
- TypeScript strict mode - Production-ready and secure
- File headers required - Path and filename commented at top of every file
- Consistency matters - Review prior work before creating new; don't reinvent wheels

**Project Management**
- Progress tracking - Running context limit indicator (50%, 75%, 99%)
- Comprehensive handoffs - Full breakdown when hitting limits
- File tracking - Always report exact paths of created/modified files

**Testing Flow**
- Test on Android first (no iPhone currently)
- Once verified on Android, push to Apple/TestFlight
- Will switch to iPhone-only testing once device is available

---

## GitHub
**Repo:** https://github.com/guardian-nexus/ratioedapp
- Push after significant changes

---

## Session Notes (Dec 18, 2025)

### Completed This Session
1. ✅ **Compare flow improvement** - Results screen → "Compare to another convo?" now:
   - Shows confirmation dialog ("This will use 1 scan credit")
   - Pre-fills Person A as locked/already scanned
   - Only charges 1 token (not 2) since Person A already analyzed

2. ✅ **GitHub repo setup** - https://github.com/guardian-nexus/ratioedapp

3. ✅ **Apple Sign In fixed** - Added bundle ID `com.ratioed.app` to Supabase Apple provider

4. ✅ **expo-file-system deprecation fix** - Migrated from `readAsStringAsync` to new `File` API

5. ✅ **Edge function timeout** - Increased from 40000 to 60000ms

6. ✅ **Dynamic wait message** - Shows different messages based on screenshot count (1-2, 3-5, 6-8)

7. ✅ **RevenueCat re-added** - With lazy initialization to prevent native module crashes

8. ✅ **PostHog re-added** - With lazy initialization to prevent native module crashes

9. ✅ **New user starting credits** - Supabase trigger gives 5 tokens on signup

10. ✅ **Security hardening (OWASP MASVS)**:
    - Atomic token deduction with FOR UPDATE lock (prevents race conditions)
    - Input validation on count parameter (1-10 only)
    - CORS restricted to mobile app origins
    - ErrorBoundary component added
    - ESLint v9 config added

### Still TODO
1. **New native build required** - Added RevenueCat and PostHog packages
2. **Test purchases in TestFlight sandbox**
3. **Testing needed:**
   - Auth flow (signup with invite code, Apple Sign In, login, logout)
   - Scan flow (upload 1-8 screenshots, analyze, view results)
   - Compare mode (2 conversations side-by-side)
   - Token deduction (verify balance decreases correctly)
   - Token purchase flow (RevenueCat sandbox)
   - Edge cases (no tokens, invalid invite code, network errors)
   - Share functionality

### Pre-Launch (Do Right Before Launch)
1. **PostHog alerts** - Set up webhook/notification for `waitlist_joined` events
2. **Welcome email** - Send confirmation email to waitlist signups
3. **Waitlist table columns** - Run SQL to add `source` and `referrer` columns:
   ```sql
   ALTER TABLE waitlist
   ADD COLUMN IF NOT EXISTS source TEXT,
   ADD COLUMN IF NOT EXISTS referrer TEXT;
   ```

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

### Key Fixes Applied
- **Supabase:** Lazy initialization using Proxy pattern (prevents SecureStore timing crash)
- **RevenueCat:** Lazy initialization on first use (prevents native module crash)
- **PostHog:** Lazy initialization on first track call (prevents native module crash)

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
- `services/revenuecat/` - RevenueCat purchases (lazy init)
- `services/analytics/` - PostHog tracking (lazy init)

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
