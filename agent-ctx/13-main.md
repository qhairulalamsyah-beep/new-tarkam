# Task 13 — Badge/Achievement Showcase

## Summary
Implemented a comprehensive Achievement Showcase system that makes achievements prominent in the player profile.

## Files Created
- `/src/components/idm/achievement-showcase.tsx` — New 'use client' component with full showcase UI

## Files Modified
- `/src/components/idm/player-profile.tsx` — Added AchievementShowcase import, replaced old Achievements section, added inline badges next to gamertag

## Key Design Decisions
1. **Rarity System**: Maps DB tiers (bronze/silver/gold/platinum/diamond) to rarity labels (Biasa/Tidak Biasa/Langka/Legendaris) with distinct color coding
2. **Featured Section**: Top 3 achievements sorted by rarity then date, with special legendary effects (traveling spotlight, glow pulse)
3. **Progress Bars**: Computed from achievement criteria type + player stats, showing how close a player is to unlocking a locked achievement
4. **Category Breakdown**: Horizontal pills showing per-category progress (Turnamen, MVP, Poin, Klub)
5. **Inline Badges**: AchievementBadgesInline shows top 3 achievement icons next to the player's gamertag in the hero banner
6. **No New API**: Uses existing `/api/players/[id]/achievements` endpoint which already returns both earned achievements and available achievements with earned status

## Verification
- ESLint: No errors on modified files
- TypeScript: No new errors
- Dev server: Compiles successfully (only pre-existing DB URL errors)
