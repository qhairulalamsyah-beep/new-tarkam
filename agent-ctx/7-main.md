# Task 7 — Player Stats Charts

## Agent: main

## Task
Implement Player Stats Charts — detailed performance graphs showing player stats over time in the TARKAM IDM esports tournament website.

## Work Summary

### 1. API Route: `/src/app/api/players/[id]/performance/route.ts`
- GET endpoint with `?division=male|female` query param
- Returns 4 data arrays: weeklyPoints, winLossPerWeek, mvpPerWeek, rankProgress
- Points: aggregated from PlayerPoint records grouped by tournament weekNumber
- Win/Loss: calculated from TeamPlayer → Team → Match (completed, winnerId comparison)
- MVP: from Match.mvpPlayerId and Participation.isMvp
- Rank: computed by aggregating all division players' cumulative points per week and ranking
- CDN-cached (2min s-maxage)

### 2. Charts Component: `/src/components/idm/player-performance-charts.tsx`
- 'use client' with 4 tabs: Poin | Win Rate | MVP | Rank
- Points: AreaChart with division gradient fill, cumulative points
- Win Rate: ComposedChart with stacked bars (green/red) + win rate % line overlay
- MVP: BarChart with gold gradient fill
- Rank: LineChart with inverted Y-axis (rank 1 at top)
- Quick stats summary below each chart
- Loading/error/empty states
- Responsive, mobile-friendly, casino-card styling

### 3. Integration: `/src/components/idm/player-profile.tsx`
- Lazy loaded with `next/dynamic` (SSR disabled for Recharts)
- Placed below "Rincian Poin" (Points Breakdown) section
- Passes playerId + playerDivision

### Files Created
- `/src/app/api/players/[id]/performance/route.ts`
- `/src/components/idm/player-performance-charts.tsx`

### Files Modified
- `/src/components/idm/player-profile.tsx` — added dynamic import + PlayerPerformanceCharts component
- `/home/z/my-project/worklog.md` — appended task 7 work log

### Lint Status
- All new/modified files pass ESLint with zero errors
