import { db } from '@/lib/db';
import { requirePlayer } from '@/lib/api-auth';
import { NextResponse } from 'next/server';

// GET /api/prize-claims/my — Get current player's prize claims
export async function GET(request: Request) {
  const authResult = await requirePlayer(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const claims = await db.prizeClaim.findMany({
      where: { playerId: authResult.playerId },
      orderBy: { claimedAt: 'desc' },
      include: {
        account: {
          select: { id: true, username: true },
        },
      },
    });

    // Enrich claims with prize info
    const enrichedClaims = await Promise.all(
      claims.map(async (claim) => {
        let prizeInfo: Record<string, unknown> | null = null;
        let tournamentInfo: Record<string, unknown> | null = null;

        try {
          if (claim.prizeType === 'tournament_prize') {
            const prize = await db.tournamentPrize.findUnique({
              where: { id: claim.prizeId },
              include: {
                tournament: {
                  select: { id: true, name: true, weekNumber: true, division: true },
                },
              },
            });
            if (prize) {
              prizeInfo = {
                id: prize.id,
                label: prize.label,
                position: prize.position,
                prizeAmount: prize.prizeAmount,
                pointsPerPlayer: prize.pointsPerPlayer,
                recipientCount: prize.recipientCount,
              };
              tournamentInfo = prize.tournament;
            }
          } else if (claim.prizeType === 'sponsored_prize') {
            const prize = await db.sponsoredPrize.findUnique({
              where: { id: claim.prizeId },
              include: {
                tournament: {
                  select: { id: true, name: true, weekNumber: true, division: true },
                },
              },
            });
            if (prize) {
              prizeInfo = {
                id: prize.id,
                name: prize.name,
                description: prize.description,
                prizeType: prize.prizeType,
                value: prize.value,
                imageUrl: prize.imageUrl,
              };
              tournamentInfo = prize.tournament;
            }
          }
        } catch {
          // Prize might have been deleted
        }

        return {
          ...claim,
          prize: prizeInfo,
          tournament: tournamentInfo,
        };
      })
    );

    return NextResponse.json({
      claims: enrichedClaims,
      total: enrichedClaims.length,
    });
  } catch (error) {
    console.error('[PRIZE_CLAIMS_MY_GET]', error);
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}
