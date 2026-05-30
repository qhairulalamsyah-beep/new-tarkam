# Task 10 — Match Prediction Game

## Summary
Fixed critical bugs in the Match Prediction feature and extended it to work properly across the entire app.

## Key Changes

### 1. Fixed Critical Import Bug (hooks.ts)
- `getClubStats` was imported from `@/lib/queries/misc` instead of `@/lib/queries/clubs`
- This caused the entire app to return 500 errors
- Moved the import to the correct module

### 2. Added Missing Prisma Relations
- Added `match Match @relation(...)` to Prediction model
- Added `predictions Prediction[]` to Match model
- These are required by the resolve API route's `include: { predictions: ... }` query
- Ran `bun run db:push` successfully

### 3. Extended Season Results API
- Changed from `status: 'completed'` only to all statuses (pending, ready, live, completed)
- Added `status` and `winnerId` fields to the response
- This enables prediction UI on upcoming matches

### 4. Enhanced HasilSection Integration
- Added MatchPrediction to Third Place and Grand Final match rows (were missing)
- Updated all match rows to pass `m.status` and `m.winnerId` props
- Prediction now shows on both upcoming (submit) and completed (results) matches

## Files Modified
- `src/lib/hooks.ts` — Fixed getClubStats import
- `prisma/schema.prisma` — Added Prediction ↔ Match relations
- `src/app/api/season-results/route.ts` — Added all statuses + winnerId/status fields
- `src/components/idm/landing/hasil-section.tsx` — Integrated MatchPrediction on all match types

## Pre-existing Files (verified working)
- `src/components/idm/match-prediction.tsx` — Component already existed
- `src/app/api/predictions/route.ts` — GET + POST already existed
- `src/app/api/predictions/stats/route.ts` — GET stats already existed
- `src/app/api/predictions/resolve/route.ts` — POST resolve already existed
- `src/lib/queries/misc.ts` — Query functions already existed
- `src/lib/hooks.ts` — Hooks (useMyPredictions, useMatchPredictionStats, usePredictionLeaderboard) already existed
