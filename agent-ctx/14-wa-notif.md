# Task 14 — WhatsApp Notifications

## Work Summary
Implemented WhatsApp Notifications feature for TARKAM IDM, enabling users to receive WA notifications for tournament events, match results, prizes, and season championships.

## Files Created
- `/home/z/my-project/src/lib/wa-notif.ts` — WA notification configuration, templates, rate limiting, phone utilities, bot integration
- `/home/z/my-project/src/app/api/notifications/whatsapp/route.ts` — POST (send WA notification) and GET (notification log) endpoints
- `/home/z/my-project/src/app/api/notifications/preferences/route.ts` — GET/PUT notification preferences endpoints
- `/home/z/my-project/src/app/api/notifications/test/route.ts` — POST send test notification endpoint
- `/home/z/my-project/src/components/idm/wa-notif-preferences.tsx` — WA notification preferences client component

## Files Modified
- `/home/z/my-project/prisma/schema.prisma` — Added NotifPreference and WaNotifLog models, added notifPreference relation to Account
- `/home/z/my-project/src/components/idm/player-profile.tsx` — Added WaNotifPreferences component import and rendering (only for own profile)
- `/home/z/my-project/src/lib/queries/misc.ts` — Added getWaNotifPreferences, updateWaNotifPreferences, sendTestWaNotification, sendWaNotification, getWaNotifLog query functions
- `/home/z/my-project/src/lib/hooks.ts` — Added useWaNotifPreferences and useWaNotifLog hooks, imported new query functions
- `/home/z/my-project/src/lib/queries/index.ts` — Re-exported new WA notification query functions

## Key Features
1. **5 Notification Types**: Tournament registration open, match starting, match result, prize available, season champion
2. **Rate Limiting**: Max 1 message per user per 5 minutes (in-memory tracker with periodic cleanup)
3. **User Preferences**: Toggle switches for each notification type, stored in NotifPreference model
4. **Phone Number Display**: Masked WA numbers (0812***5678) for privacy
5. **Test Button**: Send test notification to verify WA connectivity
6. **Notification Log**: WaNotifLog model tracks all sent/failed/pending notifications
7. **Bot Integration**: Integrates with existing WA Bot via WA_BOT_URL env var; gracefully degrades to "pending" status when bot is offline
8. **Indonesian Language**: All notification templates in Bahasa Indonesia

## Prisma Models Added
- **NotifPreference**: accountId, playerId, whatsapp, enableTournament/Match/Result/Prize/Season toggles
- **WaNotifLog**: type, targetId, waNumber, message, status (pending/sent/failed/rate_limited), error

## Integration
- WaNotifPreferences component rendered in PlayerProfile modal (only for logged-in user's own profile)
- Component shows WA number status, toggle switches, test button with animated feedback
- Green-themed casino-card styling consistent with the app design
