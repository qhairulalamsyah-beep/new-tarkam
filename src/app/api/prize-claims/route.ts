import { db } from '@/lib/db';
import { requireAdmin, requirePlayer, verifyPlayer } from '@/lib/api-auth';
import { NextResponse } from 'next/server';

// GET /api/prize-claims — List prize claims
// Admin: can see all with filters; Player: sees only their own
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const division = searchParams.get('division');
    const tournamentId = searchParams.get('tournamentId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Check if admin or player
    const admin = await requireAdmin(request);
    const isAdmin = !(admin instanceof NextResponse);

    const player = await verifyPlayer(request);
    const isPlayer = !!player;

    if (!isAdmin && !isPlayer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Build where clause
    const where: Record<string, unknown> = {};

    if (!isAdmin && isPlayer) {
      // Players can only see their own claims
      where.playerId = player!.playerId;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (tournamentId) {
      where.tournamentId = tournamentId;
    }

    // Division filter — need to filter by player's division
    if (division && isAdmin) {
      where.player = { division };
    }

    const [claims, total] = await Promise.all([
      db.prizeClaim.findMany({
        where,
        orderBy: { claimedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          player: {
            select: {
              id: true,
              gamertag: true,
              name: true,
              division: true,
              avatar: true,
              phone: true,
            },
          },
          account: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      }),
      db.prizeClaim.count({ where }),
    ]);

    // Enrich claims with prize info
    const enrichedClaims = await Promise.all(
      claims.map(async (claim) => {
        let prizeInfo: Record<string, unknown> | null = null;
        let tournamentInfo: Record<string, unknown> | null = null;

        if (claim.prizeType === 'tournament_prize') {
          const prize = await db.tournamentPrize.findUnique({
            where: { id: claim.prizeId },
            include: {
              tournament: {
                select: { id: true, name: true, weekNumber: true, division: true, status: true },
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
                select: { id: true, name: true, weekNumber: true, division: true, status: true },
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

        return {
          ...claim,
          prize: prizeInfo,
          tournament: tournamentInfo,
        };
      })
    );

    return NextResponse.json({
      claims: enrichedClaims,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[PRIZE_CLAIMS_GET]', error);
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}

// POST /api/prize-claims — Submit a new prize claim (player)
export async function POST(request: Request) {
  const authResult = await requirePlayer(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { prizeId, prizeType, contactInfo, claimMethod } = body;

    if (!prizeId || typeof prizeId !== 'string') {
      return NextResponse.json({ error: 'Prize ID wajib diisi' }, { status: 400 });
    }

    const resolvedPrizeType = prizeType === 'sponsored_prize' ? 'sponsored_prize' : 'tournament_prize';

    // Verify the prize exists
    let tournamentId: string | null = null;
    if (resolvedPrizeType === 'tournament_prize') {
      const prize = await db.tournamentPrize.findUnique({ where: { id: prizeId } });
      if (!prize) {
        return NextResponse.json({ error: 'Hadiah tidak ditemukan' }, { status: 404 });
      }
      tournamentId = prize.tournamentId;
    } else {
      const prize = await db.sponsoredPrize.findUnique({ where: { id: prizeId } });
      if (!prize) {
        return NextResponse.json({ error: 'Hadiah sponsor tidak ditemukan' }, { status: 404 });
      }
      tournamentId = prize.tournamentId;
    }

    // Check for duplicate claim
    const existingClaim = await db.prizeClaim.findFirst({
      where: {
        prizeId,
        playerId: authResult.playerId,
        status: { notIn: ['rejected'] },
      },
    });

    if (existingClaim) {
      return NextResponse.json({
        error: 'Kamu sudah mengklaim hadiah ini',
        existingClaim: {
          id: existingClaim.id,
          status: existingClaim.status,
        },
      }, { status: 409 });
    }

    // Verify player is a winner in the tournament
    if (tournamentId) {
      const participation = await db.participation.findUnique({
        where: {
          playerId_tournamentId: {
            playerId: authResult.playerId,
            tournamentId,
          },
        },
      });

      if (!participation?.isWinner) {
        // Also check if player was on a winning team
        const winningTeam = await db.teamPlayer.findFirst({
          where: {
            playerId: authResult.playerId,
            team: {
              tournamentId,
              isWinner: true,
            },
          },
        });

        if (!winningTeam) {
          return NextResponse.json({ error: 'Kamu tidak eligible untuk mengklaim hadiah ini' }, { status: 403 });
        }
      }
    }

    const claim = await db.prizeClaim.create({
      data: {
        prizeId,
        prizeType: resolvedPrizeType,
        tournamentId,
        playerId: authResult.playerId,
        accountId: authResult.id,
        claimMethod: claimMethod || 'whatsapp',
        contactInfo: contactInfo || authResult.player.gamertag,
        status: 'pending',
      },
      include: {
        player: {
          select: {
            id: true,
            gamertag: true,
            name: true,
            division: true,
            avatar: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Klaim hadiah berhasil diajukan! Tim kami akan memverifikasi.',
      claim,
    }, { status: 201 });
  } catch (error) {
    console.error('[PRIZE_CLAIMS_POST]', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengajukan klaim' }, { status: 500 });
  }
}
