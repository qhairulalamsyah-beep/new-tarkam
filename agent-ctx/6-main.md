# Task 6 — Global Search Feature

## Summary
Implemented a complete Global Search feature for the TARKAM IDM esports tournament website, enabling users to search for players, clubs, and tournaments from anywhere in the app.

## Files Created
- `/src/app/api/search/route.ts` — Global search API endpoint
- `/src/components/idm/global-search.tsx` — Command palette search component

## Files Modified
- `/src/components/idm/landing-page.tsx` — Added search trigger in nav, search modal, and keyboard shortcut

## Key Design Decisions
- Used shadcn/ui CommandDialog as the base for the command palette
- Custom search input instead of CommandInput for better control over debounce behavior
- Debounce set to 300ms to avoid excessive API calls
- Results grouped by type (Players, Clubs, Tournaments) with distinct icons and badges
- Each group limited to 5 results for a clean UI
- Division badges color-coded (blue for male, pink for female)
- Result selection opens the appropriate profile/modal or navigates to the correct view
- Global Ctrl+K / Cmd+K shortcut registered both in LandingPage (always active) and GlobalSearchTrigger (when loaded)

## API Details
- `GET /api/search?q=<query>` — searches players (gamertag/name), clubs (name), tournaments (name)
- Minimum query length: 2 characters
- CDN-cached with 5s s-maxage, 15s stale-while-revalidate
- Returns: `{ players: [...], clubs: [...], tournaments: [...] }`
