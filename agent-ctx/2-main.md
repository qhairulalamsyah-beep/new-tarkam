# Task 2 - Tournament Calendar Feature

## Summary
Implemented Tournament Calendar feature for TARKAM IDM esports tournament website.

## Files Created
- `/src/app/api/tournaments/calendar/route.ts` — API endpoint for calendar data
- `/src/components/idm/calendar-page.tsx` — Calendar page component

## Files Modified
- `/src/lib/store.ts` — Added 'calendar' to AppView type
- `/src/components/idm/landing-page.tsx` — Added "Kalender" nav (desktop + mobile)
- `/src/components/idm/app-shell.tsx` — Added CalendarPage dynamic import + view rendering
- `/src/components/idm/public-page-layout.tsx` — Added "Kalender" nav (desktop + mobile)

## Feature Details
- **API**: GET /api/tournaments/calendar returns tournament schedule with inferred dates, registration status, month grouping
- **Calendar Grid**: Navigable month view with division-colored dots (blue=male, pink=female)
- **Upcoming List**: Right sidebar with tournament cards showing countdown timers, status badges, division badges
- **Division Filter**: Semua / ♂ Cowo / ♀ Cewe pills
- **Styling**: Consistent casino-card (rounded-[28px], border-idm-gold-warm/10, bg-card/60)
- **Data Fetching**: useQuery with smartRefetchInterval, 5min staleTime, placeholderData
