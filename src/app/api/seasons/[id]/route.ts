import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const { id } = await params;

    // Fetch season base data
    const season = await db.season.findUnique({
      where: { id },
    });

    if (!season) {
      return NextResponse.json({ error: 'Season not found' }, { headers, status: 404 });
    }

    // Fetch related data in parallel
    const [tournaments, clubs, donations, championPlayer, sultanPlayer] = await Promise.all([
      db.tournament.findMany({
        where: { seasonId: id },
        orderBy: { weekNumber: 'asc' },
      }),
      db.club.findMany({
        where: { seasonId: id },
        include: { profile: { select: { id: true, name: true, logo: true } } },
      }),
      db.donation.findMany({
        where: { seasonId: id },
        orderBy: { createdAt: 'desc' },
      }),
      season.championPlayerId
        ? db.player.findUnique({
            where: { id: season.championPlayerId },
            select: { id: true, gamertag: true, division: true, avatar: true, points: true },
          })
        : Promise.resolve(null),
      season.sultanPlayerId
        ? db.player.findUnique({
            where: { id: season.sultanPlayerId },
            select: { id: true, gamertag: true, division: true, avatar: true, points: true, tier: true, totalWins: true, totalMvp: true, streak: true, maxStreak: true, matches: true },
          })
        : Promise.resolve(null),
    ]);

    // Sort clubs by points desc
    const sortedClubs = [...clubs].sort((a, b) => b.points - a.points);

    // Build response
    const response: Record<string, unknown> = {
      ...season,
      tournaments,
      clubs: sortedClubs,
      donations,
      championPlayer,
      sultanPlayer,
      _count: {
        tournaments: tournaments.length,
        clubs: clubs.length,
        donations: donations.length,
      },
    };

    // For completed seasons, use PlayerSeasonStats for accurate historical data
    let seasonPlayers: Array<{ id: string; gamertag: string; division: string; avatar: string | null; points: number; rank: number | null; tier: string; club: string | null; tournamentCount: number }> = [];

    if (season.status === 'completed') {
      const statsRecords = await db.playerSeasonStats.findMany({
        where: { seasonId: id },
        orderBy: { points: 'desc' },
      });

      if (statsRecords.length > 0) {
        // Fetch player details for each stat record
        const playerIds = statsRecords.map(s => s.playerId);
        const playersData = await db.player.findMany({
          where: { id: { in: playerIds } },
          include: {
            clubMembers: {
              where: { leftAt: null },
              include: { profile: { select: { name: true } } },
            },
          },
        });

        const playerMap = new Map(playersData.map(p => [p.id, p]));

        seasonPlayers = statsRecords.map((stat, idx) => {
          const player = playerMap.get(stat.playerId);
          const activeMember = player?.clubMembers.find(m => m.leftAt === null);
          const clubProfile = activeMember?.profile;

          return {
            id: player?.id || stat.playerId,
            gamertag: player?.gamertag || '',
            division: player?.division || '',
            avatar: player?.avatar || null,
            points: stat.points,
            rank: stat.rank || idx + 1,
            tier: stat.tier,
            club: clubProfile?.name || null,
            tournamentCount: 0,
          };
        });
      }
    } else {
      // Active/upcoming seasons — use live participation data
      const tournamentIds = tournaments.map(t => t.id);

      if (tournamentIds.length > 0) {
        const seasonParticipations = await db.participation.findMany({
          where: {
            tournamentId: { in: tournamentIds },
            status: { in: ['approved', 'assigned'] },
          },
          include: {
            player: {
              select: {
                id: true,
                gamertag: true,
                division: true,
                avatar: true,
                points: true,
                tier: true,
                clubMembers: {
                  where: { leftAt: null },
                  include: { profile: { select: { name: true } } },
                },
              },
            },
          },
        });

        const playerMap = new Map<string, { id: string; gamertag: string; division: string; avatar: string | null; points: number; tier: string; club: string | null; tournamentCount: number }>();
        for (const p of seasonParticipations) {
          const player = p.player;
          const activeMember = player.clubMembers.find(m => m.leftAt === null);
          const clubProfile = activeMember?.profile;

          const existing = playerMap.get(player.id);
          if (existing) {
            existing.tournamentCount++;
          } else {
            playerMap.set(player.id, {
              id: player.id,
              gamertag: player.gamertag,
              division: player.division,
              avatar: player.avatar,
              points: player.points,
              tier: player.tier || 'B',
              club: clubProfile?.name || null,
              tournamentCount: 1,
            });
          }
        }
        seasonPlayers = Array.from(playerMap.values())
          .sort((a, b) => b.points - a.points)
          .map((p) => ({ ...p, rank: null, tier: 'B' }));
      }
    }

    // Parse JSON string fields
    if (response.championSquad && typeof response.championSquad === 'string') {
      try {
        response.championSquad = JSON.parse(response.championSquad as string);
      } catch {
        response.championSquad = null;
      }
    }
    if (response.championPlayerSnapshot && typeof response.championPlayerSnapshot === 'string') {
      try {
        response.championPlayerSnapshot = JSON.parse(response.championPlayerSnapshot as string);
      } catch {
        response.championPlayerSnapshot = null;
      }
    }
    // Add players for seasons
    if (seasonPlayers.length > 0) {
      response.players = seasonPlayers;
    }

    return NextResponse.json(response, { headers });
  } catch (error: unknown) {
    console.error('[GET /api/seasons/[id]] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/seasons/[id] — Update season (status, championPlayerId, endDate, name)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, status, championPlayerId, championPlayerPoints, championSquad, endDate, sultanPlayerId } = body;

    // Find existing season
    const season = await db.season.findUnique({ where: { id } });

    if (!season) {
      return NextResponse.json({ error: 'Season tidak ditemukan' }, { status: 404 });
    }

    // Validate championPlayerId if provided
    if (championPlayerId !== undefined && championPlayerId !== null) {
      const player = await db.player.findUnique({ where: { id: championPlayerId } });
      if (!player) {
        return NextResponse.json({ error: 'Player champion tidak ditemukan' }, { status: 400 });
      }
    }

    // Validate sultanPlayerId if provided
    if (sultanPlayerId !== undefined && sultanPlayerId !== null) {
      const player = await db.player.findUnique({ where: { id: sultanPlayerId } });
      if (!player) {
        return NextResponse.json({ error: 'Sultan of Season tidak ditemukan' }, { status: 400 });
      }
    }

    // Validate championSquad if provided — must be array with max 5 members
    if (championSquad !== undefined) {
      if (championSquad !== null && !Array.isArray(championSquad)) {
        return NextResponse.json({ error: 'championSquad harus berupa array' }, { status: 400 });
      }
      if (Array.isArray(championSquad) && championSquad.length > 5) {
        return NextResponse.json({ error: 'championSquad maksimal 5 anggota' }, { status: 400 });
      }
    }

    // Validate status transition
    if (status && !['active', 'completed', 'upcoming'].includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (status !== undefined) updateData.status = status;
    if (championPlayerId !== undefined) updateData.championPlayerId = championPlayerId || null;
    if (sultanPlayerId !== undefined) updateData.sultanPlayerId = sultanPlayerId || null;
    if (championPlayerPoints !== undefined) updateData.championPlayerPoints = championPlayerPoints || null;
    if (championSquad !== undefined) updateData.championSquad = championSquad ? JSON.stringify(championSquad) : null;
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

    // When status is set to completed and no endDate, set now
    if (status === 'completed' && !endDate && !season.endDate) {
      updateData.endDate = new Date();
    }

    // ===== SNAPSHOT CHAMPION DATA when manually setting champion + completing season =====
    const willBeCompleted = status === 'completed' || (status === undefined && season.status === 'completed');

    // Snapshot champion player
    if (championPlayerId && willBeCompleted) {
      const player = await db.player.findUnique({
        where: { id: championPlayerId },
        select: { id: true, gamertag: true, avatar: true, tier: true, points: true, totalWins: true, totalMvp: true, streak: true, maxStreak: true, matches: true, division: true },
      });

      if (player) {
        // Get active club membership
        const clubMembers = await db.clubMember.findMany({
          where: { playerId: championPlayerId, leftAt: null },
          include: { profile: { select: { id: true, name: true, logo: true } } },
        });

        const activeMember = clubMembers[0];
        const activeClub = activeMember?.profile;
        const activeClubName = activeClub?.name || null;

        let perSeasonPoints = championPlayerPoints;
        if (!perSeasonPoints) {
          const seasonPoints = await db.playerPoint.findMany({
            where: { playerId: championPlayerId, seasonId: id },
            select: { amount: true },
          });
          perSeasonPoints = seasonPoints.reduce((sum, p) => sum + p.amount, 0);
        }

        updateData.championPlayerSnapshot = JSON.stringify({
          gamertag: player.gamertag,
          avatar: player.avatar,
          tier: player.tier,
          points: perSeasonPoints,
          totalWins: player.totalWins,
          totalMvp: player.totalMvp,
          streak: player.streak,
          maxStreak: player.maxStreak,
          matches: player.matches,
          club: activeClubName ? { id: activeClub?.id, name: activeClubName, logo: activeClub?.logo || null } : null,
          division: player.division,
        });
      }
    }

    // Clear snapshots when removing champion
    if (championPlayerId === null) {
      updateData.championPlayerSnapshot = null;
    }

    // Perform the update
    await db.season.update({
      where: { id },
      data: updateData,
    });

    // Fetch updated season with related data
    const updated = await db.season.findUnique({ where: { id } });

    // Fetch champion and sultan players if set
    const [championResult, sultanResult, tournamentCount, clubCount] = await Promise.all([
      updated?.championPlayerId
        ? db.player.findUnique({
            where: { id: updated.championPlayerId },
            select: { id: true, gamertag: true, division: true, avatar: true, points: true },
          })
        : Promise.resolve(null),
      updated?.sultanPlayerId
        ? db.player.findUnique({
            where: { id: updated.sultanPlayerId },
            select: { id: true, gamertag: true, division: true, avatar: true, points: true, tier: true, totalWins: true, totalMvp: true, streak: true, maxStreak: true, matches: true },
          })
        : Promise.resolve(null),
      db.tournament.count({ where: { seasonId: id } }),
      db.club.count({ where: { seasonId: id } }),
    ]);

    const updatedResponse: Record<string, unknown> = { ...(updated || {}) };
    updatedResponse.championPlayer = championResult;
    updatedResponse.sultanPlayer = sultanResult;
    updatedResponse._count = {
      tournaments: tournamentCount,
      clubs: clubCount,
    };

    // Parse JSON string fields
    if (updatedResponse.championSquad && typeof updatedResponse.championSquad === 'string') {
      try {
        updatedResponse.championSquad = JSON.parse(updatedResponse.championSquad as string);
      } catch {
        updatedResponse.championSquad = null;
      }
    }
    if (updatedResponse.championPlayerSnapshot && typeof updatedResponse.championPlayerSnapshot === 'string') {
      try {
        updatedResponse.championPlayerSnapshot = JSON.parse(updatedResponse.championPlayerSnapshot as string);
      } catch {
        updatedResponse.championPlayerSnapshot = null;
      }
    }

    // Invalidate Next.js server cache so landing page shows updated champion data
    revalidatePath('/');
    revalidateTag('landing-stats', 'max');

    await createAuditLog({
      adminId: authResult.id,
      adminName: authResult.username,
      action: 'update',
      entity: 'season',
      entityId: id,
      details: `Update season "${season.name}"`,
    });

    return NextResponse.json(updatedResponse);
  } catch (error: unknown) {
    console.error('[PUT /api/seasons/[id]] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/seasons/[id] — Delete season (cascade handled by database FK)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;

    const season = await db.season.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!season) {
      return NextResponse.json({ error: 'Season tidak ditemukan' }, { status: 404 });
    }

    // Cascade deletes handled by database FK (ON DELETE CASCADE)
    await db.season.delete({ where: { id } });

    await createAuditLog({
      adminId: authResult.id,
      adminName: authResult.username,
      action: 'delete',
      entity: 'season',
      entityId: id,
      details: `Menghapus season "${season.name}"`,
    });

    return NextResponse.json({ success: true, message: 'Season berhasil dihapus' });
  } catch (error: unknown) {
    console.error('[DELETE /api/seasons/[id]] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
