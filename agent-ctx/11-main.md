# Task 11 - Historical Leaderboard Implementation

## Agent: main
## Status: Completed

### Summary
Implemented a Historical Leaderboard feature for the TARKAM IDM esports tournament website — a snapshot of rankings per week/season.

### Files Created/Modified

1. **API Route: `/src/app/api/leaderboard/history/route.ts`** (NEW)
   - GET endpoint returning historical leaderboard snapshots
   - Query params: `?seasonId=&division=male|female&weekNumber=`
   - Calculates leaderboard at specific point in time by:
     - Querying PlayerPoint records up to the specified week via tournament associations
     - Including season-level points not tied to specific tournaments
     - Grouping by player and summing points
     - Ranking players by total cumulative points
   - Compares with previous week to compute position changes (↑/↓ arrows)
   - Returns: `{ seasonInfo, weekNumber, maxWeek, availableWeeks, players: [{ rank, gamertag, avatar, points, club, division, rankChange, prevRank }] }`
   - Uses CACHE_TIER_2 (semi-stable) cache headers

2. **Query Function: `/src/lib/queries/misc.ts`** (MODIFIED)
   - Added `getLeaderboardHistory(params)` function
   - Delegates to `/api/leaderboard/history` endpoint

3. **React Query Hook: `/src/lib/hooks.ts`** (MODIFIED)
   - Added `getLeaderboardHistory` import from misc queries
   - Added `useLeaderboardHistory(params, options)` hook
   - Query key: `['leaderboard-history', seasonId, division, weekNumber]`
   - staleTime: 120s (Tier 2 — semi-stable)
   - placeholderData for smooth transitions

4. **HistoricalLeaderboard Component: `/src/components/idm/historical-leaderboard.tsx`** (NEW)
   - 'use client' component with casino-card styling
   - **Season Selector**: Select dropdown to pick season (auto-selects active season)
   - **Division Filter**: Pills for Semua / Cowo / Cewe (matching existing pattern)
   - **Week Slider**: Slider component with left/right arrow buttons
     - Week markers (W1, W2, etc.) below the slider for quick navigation
     - Current week badge showing `weekNumber / maxWeek`
     - Completed week indicators
   - **Top 3 Podium**: Visual podium display (2nd-1st-3rd order)
     - Animated with framer-motion (spring animations)
     - Crown for #1, gold/silver/bronze color scheme
     - Avatar with division-colored ring borders
     - Podium blocks with gradient backgrounds
   - **Leaderboard Table**: Card-per-row design matching CommunityLeaderboard
     - Rank badge (gold/silver/bronze gradient for top 3)
     - Avatar with ring borders
     - Gamertag + Position Change indicator
     - Division badge (🕺 Cowo / 💃 Cewe)
     - Club name
     - Points display
     - Animated transitions via AnimatePresence + framer-motion layout
   - **Position Changes**: ↑/↓ arrows with color coding
     - Green ArrowUp for rank improvement
     - Red ArrowDown for rank decline
     - Gray Minus for no change
   - Loading skeleton, empty state, responsive design
   - Uses useQuery from @tanstack/react-query

5. **PeringkatPage Integration: `/src/components/idm/peringkat-page.tsx`** (MODIFIED)
   - Added "Saat Ini" / "Riwayat" toggle in page header
     - Award icon for "Saat Ini" (current), Clock icon for "Riwayat" (history)
     - Gold-warm styled toggle matching existing patterns
   - Dynamic import of HistoricalLeaderboard component (lazy loaded, ssr: false)
   - When "Riwayat" is active, shows HistoricalLeaderboard with padding
   - When "Saat Ini" is active, shows existing PeringkatSection
   - Updated subtitle text based on active view mode

### Technical Details
- No database schema changes required — leverages existing PlayerPoint, Tournament, Season models
- Historical points calculated by aggregating PlayerPoint records linked to tournaments within the season up to the specified week
- Position changes computed by comparing current week ranking against previous week ranking
- The API falls back to maxWeek when weekNumber is not specified or exceeds maxWeek
- All new code follows existing patterns: casino-card styling, idm-gold-warm theme, division-themed badges
