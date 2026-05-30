# Task 3 - Prize Claim System

## Agent: main
## Task ID: 3

## Summary
Implemented a complete Prize Claim System for the TARKAM IDM esports tournament website, allowing tournament winners to claim their prizes through a structured flow.

## Files Created
1. `src/app/api/prize-claims/route.ts` — GET + POST for prize claims
2. `src/app/api/prize-claims/[id]/route.ts` — PATCH for updating claim status
3. `src/app/api/prize-claims/my/route.ts` — GET for player's own claims
4. `src/components/idm/prize-claim-modal.tsx` — Player-facing claim modal
5. `src/components/idm/admin/tabs/admin-prize-claims-tab.tsx` — Admin management tab

## Files Modified
1. `prisma/schema.prisma` — Added PrizeClaim model + relations to Player and Account
2. `src/components/idm/admin-panel.tsx` — Added "Klaim Hadiah" tab under Keuangan
3. `src/components/idm/landing/tournament-prize-section.tsx` — Added claim button for winners

## Key Decisions
- Used `prizeId` as a string field without direct FK relation (flexible for both TournamentPrize and SponsoredPrize)
- Added `prizeType` discriminator field to determine which model to query
- Added `tournamentId` convenience field to avoid extra joins
- Claims are enriched with prize+tournament info via separate queries (avoids complex polymorphic relations)
- Player eligibility checked via Participation.isWinner OR TeamPlayer on winning team
- Notifications created for players on status changes (via existing Notification model)
- Status flow: pending → verified → processing → shipped → completed (with reject at any point)
