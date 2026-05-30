import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildCacheHeaders, buildErrorCacheHeaders, CACHE_TIER_2 } from '@/lib/cache-tiers';

export const maxDuration = 60;

/**
 * GET /api/leaderboard/history
 *
 * Returns historical leaderboard snapshots — ranking of players at a specific point in time.
 *
 * Query params:
 *   seasonId: string — required, the season to query
 *   division: "male" | "female" — filter by division (defaults to season's division)
 *   weekNumber: number — the week number within the season (1-based)
 *                      If omitted, returns the latest week's snapshot
 *
 * How it works:
 *   1. Find all tournaments in the season up to the specified weekNumber
 *   2. Aggregate PlayerPoint records from those tournaments
 *   3. Also include season-level points that don't belong to a specific tournament
 *   4. Rank players by total cumulative points
 *   5. Compare with previous week to compute position changes (↑/↓)
 */
export async function GET(request: NextRequest) {
  const headers = buildCacheHeaders(CACHE_TIER_2, 'leaderboard-history');

  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');
    const division = searchParams.get('division');
    const weekNumberStr = searchParams.get('weekNumber');

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'seasonId is required' },
        { status: 400, headers }
      );
    }

    // ── Fetch season info ──
    const season = await db.season.findUnique({
      where: { id: seasonId },
      select: {
        id: true,
        name: true,
        number: true,
        division: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!season) {
      return NextResponse.json(
        { success: false, error: 'Season tidak ditemukan' },
        { status: 404, headers }
      );
    }

    const effectiveDivision = division || season.division;

    // ── Get all tournaments for this season & division, ordered by week ──
    const allTournaments = await db.tournament.findMany({
      where: {
        seasonId,
        division: effectiveDivision,
      },
      select: {
        id: true,
        name: true,
        weekNumber: true,
        status: true,
      },
      orderBy: { weekNumber: 'asc' },
    });

    if (allTournaments.length === 0) {
      return NextResponse.json({
        success: true,
        seasonInfo: {
          id: season.id,
          name: season.name,
          number: season.number,
          division: effectiveDivision,
          status: season.status,
          startDate: season.startDate,
          endDate: season.endDate,
        },
        weekNumber: 0,
        maxWeek: 0,
        availableWeeks: [],
        players: [],
      }, { headers });
    }

    const maxWeek = Math.max(...allTournaments.map(t => t.weekNumber));
    const weekNumber = weekNumberStr ? parseInt(weekNumberStr) : maxWeek;

    // Validate weekNumber
    if (weekNumber < 1 || weekNumber > maxWeek) {
      return NextResponse.json(
        { success: false, error: `weekNumber harus antara 1 dan ${maxWeek}` },
        { status: 400, headers }
      );
    }

    // ── Get tournament IDs up to the specified week ──
    const tournamentsUpToWeek = allTournaments.filter(t => t.weekNumber <= weekNumber);
    const tournamentIdsUpToWeek = tournamentsUpToWeek.map(t => t.id);

    // ── Get tournament IDs up to the PREVIOUS week (for position changes) ──
    const tournamentIdsPrevWeek = allTournaments
      .filter(t => t.weekNumber < weekNumber)
      .map(t => t.id);

    // ── Aggregate points for the current week ──
    // Points from tournaments up to this week
    const currentWeekPointsRaw = tournamentIdsUpToWeek.length > 0
      ? await db.playerPoint.groupBy({
          by: ['playerId'],
          where: {
            seasonId,
            tournamentId: { in: tournamentIdsUpToWeek },
          },
          _sum: { amount: true },
        })
      : [];

    // Also get season-level points not tied to a specific tournament
    const seasonLevelPoints = await db.playerPoint.groupBy({
      by: ['playerId'],
      where: {
        seasonId,
        tournamentId: null,
      },
      _sum: { amount: true },
    });

    // Merge tournament + season-level points
    const currentPointsMap = new Map<string, number>();
    for (const p of currentWeekPointsRaw) {
      currentPointsMap.set(p.playerId, (currentPointsMap.get(p.playerId) || 0) + (p._sum.amount || 0));
    }
    for (const p of seasonLevelPoints) {
      currentPointsMap.set(p.playerId, (currentPointsMap.get(p.playerId) || 0) + (p._sum.amount || 0));
    }

    // ── Aggregate points for the previous week ──
    const prevWeekPointsRaw = tournamentIdsPrevWeek.length > 0
      ? await db.playerPoint.groupBy({
          by: ['playerId'],
          where: {
            seasonId,
            tournamentId: { in: tournamentIdsPrevWeek },
          },
          _sum: { amount: true },
        })
      : [];

    const prevPointsMap = new Map<string, number>();
    for (const p of prevWeekPointsRaw) {
      prevPointsMap.set(p.playerId, (prevPointsMap.get(p.playerId) || 0) + (p._sum.amount || 0));
    }
    // Also add season-level points for prev week (same season-level points)
    for (const p of seasonLevelPoints) {
      prevPointsMap.set(p.playerId, (prevPointsMap.get(p.playerId) || 0) + (p._sum.amount || 0));
    }

    // ── Rank previous week ──
    const prevRanked = [...prevPointsMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([playerId], idx) => ({ playerId, prevRank: idx + 1 }));

    const prevRankMap = new Map(prevRanked.map(r => [r.playerId, r.prevRank]));

    // ── Get player details ──
    const playerIds = [...currentPointsMap.keys()];
    const players = await db.player.findMany({
      where: {
        id: { in: playerIds },
        isActive: true,
        registrationStatus: 'approved',
        division: effectiveDivision,
      },
      select: {
        id: true,
        gamertag: true,
        avatar: true,
        division: true,
        tier: true,
        clubMembers: {
          where: { leftAt: null },
          select: {
            profile: {
              select: { name: true },
            },
          },
          take: 1,
        },
      },
    });

    const playerMap = new Map(players.map(p => [p.id, p]));

    // ── Build leaderboard ──
    const leaderboard = [...currentPointsMap.entries()]
      .map(([playerId, points]) => {
        const player = playerMap.get(playerId);
        if (!player) return null;

        const prevRank = prevRankMap.get(playerId);
        const currentRank = 0; // will be set after sorting
        const club = player.clubMembers[0]?.profile?.name || null;

        return {
          playerId,
          gamertag: player.gamertag,
          avatar: player.avatar,
          division: player.division,
          tier: player.tier,
          club,
          points,
          prevRank: prevRank || null,
          rankChange: prevRank ? 0 : null, // computed after ranking
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (b!.points !== a!.points) return b!.points - a!.points;
        return a!.gamertag.localeCompare(b!.gamertag);
      })
      .map((player, index) => {
        const currentRank = index + 1;
        const prevRank = player!.prevRank;
        let rankChange: number | null = null;
        if (prevRank !== null) {
          rankChange = prevRank - currentRank; // positive = moved up, negative = moved down
        }
        return {
          ...player!,
          rank: currentRank,
          rankChange,
        };
      });

    // ── Available weeks ──
    const availableWeeks = allTournaments.map(t => ({
      weekNumber: t.weekNumber,
      tournamentName: t.name,
      status: t.status,
    }));

    return NextResponse.json({
      success: true,
      seasonInfo: {
        id: season.id,
        name: season.name,
        number: season.number,
        division: effectiveDivision,
        status: season.status,
        startDate: season.startDate,
        endDate: season.endDate,
      },
      weekNumber,
      maxWeek,
      availableWeeks,
      players: leaderboard,
    }, { headers });
  } catch (error) {
    console.error('[GET /api/leaderboard/history] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500, headers: Object.fromEntries(buildErrorCacheHeaders().entries()) }
    );
  }
}
