import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/matches/[id] — Detailed match data for the Match Detail modal
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const match = await db.match.findUnique({
      where: { id },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            weekNumber: true,
            division: true,
            status: true,
            defaultMatchFormat: true,
            season: {
              select: { id: true, name: true, number: true },
            },
          },
        },
        team1: {
          include: {
            teamPlayers: {
              include: {
                player: {
                  select: {
                    id: true,
                    gamertag: true,
                    name: true,
                    avatar: true,
                    division: true,
                    tier: true,
                    points: true,
                    totalWins: true,
                    totalMvp: true,
                    matches: true,
                    streak: true,
                    maxStreak: true,
                    clubMembers: {
                      where: { leftAt: null },
                      take: 1,
                      select: {
                        profile: {
                          select: { id: true, name: true, logo: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        team2: {
          include: {
            teamPlayers: {
              include: {
                player: {
                  select: {
                    id: true,
                    gamertag: true,
                    name: true,
                    avatar: true,
                    division: true,
                    tier: true,
                    points: true,
                    totalWins: true,
                    totalMvp: true,
                    matches: true,
                    streak: true,
                    maxStreak: true,
                    clubMembers: {
                      where: { leftAt: null },
                      take: 1,
                      select: {
                        profile: {
                          select: { id: true, name: true, logo: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        winner: { select: { id: true, name: true } },
        loser: { select: { id: true, name: true } },
        mvpPlayer: {
          select: {
            id: true,
            gamertag: true,
            name: true,
            avatar: true,
            division: true,
            tier: true,
            points: true,
            totalWins: true,
            totalMvp: true,
            matches: true,
            streak: true,
          },
        },
        pointRecords: {
          select: {
            id: true,
            playerId: true,
            amount: true,
            reason: true,
            description: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!match) {
      return NextResponse.json(
        { success: false, error: 'Match tidak ditemukan' },
        { status: 404 }
      );
    }

    // Build player detail helper
    const buildPlayerDetail = (team: typeof match.team1) => {
      if (!team) return null;
      const players = team.teamPlayers.map((tp) => {
        const p = tp.player;
        const club = p.clubMembers[0]?.profile ?? null;
        const winRate = p.matches > 0 ? Math.round((p.totalWins / p.matches) * 100) : 0;
        return {
          id: p.id,
          gamertag: p.gamertag,
          name: p.name,
          avatar: p.avatar,
          division: p.division,
          tier: p.tier,
          points: p.points,
          totalWins: p.totalWins,
          totalMvp: p.totalMvp,
          matches: p.matches,
          streak: p.streak,
          maxStreak: p.maxStreak,
          winRate,
          club: club ? { id: club.id, name: club.name, logo: club.logo } : null,
        };
      });
      return {
        id: team.id,
        name: team.name,
        players,
      };
    };

    const team1Detail = buildPlayerDetail(match.team1);
    const team2Detail = buildPlayerDetail(match.team2);

    // Head-to-head: find previous matches between the same two teams
    const team1Id = match.team1Id;
    const team2Id = match.team2Id;

    let headToHead: Array<{
      id: string;
      tournamentName: string;
      weekNumber: number;
      score1: number | null;
      score2: number | null;
      winnerId: string | null;
      completedAt: string | null;
      bracket: string;
      round: number;
    }> = [];

    if (team1Id && team2Id) {
      const h2hMatches = await db.match.findMany({
        where: {
          id: { not: id },
          status: 'completed',
          OR: [
            { team1Id, team2Id },
            { team1Id: team2Id, team2Id: team1Id },
          ],
        },
        include: {
          tournament: { select: { name: true, weekNumber: true } },
        },
        orderBy: { completedAt: 'desc' },
        take: 5,
      });

      headToHead = h2hMatches.map((m) => ({
        id: m.id,
        tournamentName: m.tournament.name,
        weekNumber: m.tournament.weekNumber,
        score1: m.score1,
        score2: m.score2,
        winnerId: m.winnerId,
        completedAt: m.completedAt?.toISOString() ?? null,
        bracket: m.bracket,
        round: m.round,
      }));
    }

    // Build timeline from point records if available
    const timeline = match.pointRecords.map((pr, idx) => ({
      order: idx + 1,
      playerId: pr.playerId,
      amount: pr.amount,
      reason: pr.reason,
      description: pr.description,
      createdAt: pr.createdAt.toISOString(),
    }));

    const result = {
      id: match.id,
      tournamentId: match.tournamentId,
      round: match.round,
      matchNumber: match.matchNumber,
      bracket: match.bracket,
      groupLabel: match.groupLabel,
      format: match.format,
      score1: match.score1,
      score2: match.score2,
      status: match.status,
      scheduledAt: match.scheduledAt?.toISOString() ?? null,
      completedAt: match.completedAt?.toISOString() ?? null,
      tournament: match.tournament,
      team1: team1Detail,
      team2: team2Detail,
      winnerId: match.winnerId,
      winner: match.winner ? { id: match.winner.id, name: match.winner.name } : null,
      loserId: match.loserId,
      mvpPlayer: match.mvpPlayer
        ? {
            id: match.mvpPlayer.id,
            gamertag: match.mvpPlayer.gamertag,
            name: match.mvpPlayer.name,
            avatar: match.mvpPlayer.avatar,
            division: match.mvpPlayer.division,
            tier: match.mvpPlayer.tier,
            points: match.mvpPlayer.points,
            totalWins: match.mvpPlayer.totalWins,
            totalMvp: match.mvpPlayer.totalMvp,
            matches: match.mvpPlayer.matches,
            streak: match.mvpPlayer.streak,
          }
        : null,
      timeline,
      headToHead,
    };

    const response = NextResponse.json({ success: true, data: result });
    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    response.headers.set('Surrogate-Key', 'league-data');
    return response;
  } catch (error) {
    console.error('Get match detail error:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
