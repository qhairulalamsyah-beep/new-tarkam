import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ★ Vercel serverless: heavy DB queries need more than default 10s timeout
export const maxDuration = 60;

export const dynamic = 'force-dynamic';

/**
 * GET /api/season-results?division=male
 * 
 * Returns all completed tournament match results for the active season,
 * grouped by week. Used by the Hasil section on the landing page.
 * 
 * This is a lightweight alternative to fetching the full /api/stats
 * when only match results are needed.
 */
export async function GET(request: NextRequest) {
  const headers = new Headers();
  // Tier 2 — Semi-Static: s-maxage=300 (5min CDN), stale-while-revalidate=600 (10min stale)
  headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  headers.set('Surrogate-Key', 'league-data');
  headers.set('Vary', 'Accept-Encoding');

  try {
    const { searchParams } = new URL(request.url);
    const division = searchParams.get('division') || 'male';

    // Find the active season for this division
    let activeSeason = await db.season.findFirst({
      where: { division, status: { in: ['active', 'upcoming'] } },
      orderBy: { number: 'desc' },
    });

    if (!activeSeason) {
      // Fallback: try any season for this division
      activeSeason = await db.season.findFirst({
        where: { division },
        orderBy: { number: 'desc' },
      });
      if (!activeSeason) {
        return NextResponse.json({ weeks: [] }, { headers });
      }
    }

    // Get all tournaments for this season
    const tournaments = await db.tournament.findMany({
      where: { seasonId: activeSeason.id },
      orderBy: { weekNumber: 'asc' },
      select: {
        id: true,
        name: true,
        weekNumber: true,
        status: true,
        format: true,
        prizePool: true,
      },
    });

    const tournamentIds = tournaments.map(t => t.id);

    // Get all matches for these tournaments (including pending/ready for predictions)
    // Only include matches from tournaments in main_event or later status
    const activeTournamentIds = tournaments
      .filter(t => ['main_event', 'finalization', 'completed'].includes(t.status))
      .map(t => t.id);

    const matches = activeTournamentIds.length > 0
      ? await db.match.findMany({
          where: {
            tournamentId: { in: activeTournamentIds },
          },
          include: {
            team1: {
              include: {
                teamPlayers: {
                  include: { player: { select: { id: true, gamertag: true } } },
                },
              },
            },
            team2: {
              include: {
                teamPlayers: {
                  include: { player: { select: { id: true, gamertag: true } } },
                },
              },
            },
            mvpPlayer: { select: { id: true, gamertag: true } },
            tournament: { select: { id: true, weekNumber: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    // Get league matches for this season (Tarkam: no league matches, empty array)
    const leagueMatches: any[] = [];

    // Group results by week
    type WeekResult = {
      weekNumber: number;
      tournamentName: string;
      tournamentStatus: string;
      hasTournament: boolean;
      tournamentMatches: Array<{
        id: string;
        round: number;
        bracket: string;
        groupLabel: string | null;
        score1: number | null;
        score2: number | null;
        format: string;
        status: string;
        winnerId: string | null;
        team1: { id: string; name: string } | null;
        team2: { id: string; name: string } | null;
        team1Players?: string;
        team2Players?: string;
        mvpPlayer: { id: string; gamertag: string } | null;
      }>;
      leagueMatches: Array<{
        id: string;
        week: number;
        score1: number | null;
        score2: number | null;
        format: string;
        club1: { id: string; name: string; logo: string | null };
        club2: { id: string; name: string; logo: string | null };
      }>;
    };

    const weekMap = new Map<number, WeekResult>();

    // Initialize weeks from tournaments
    for (const t of tournaments) {
      if (!weekMap.has(t.weekNumber)) {
        weekMap.set(t.weekNumber, {
          weekNumber: t.weekNumber,
          tournamentName: t.name,
          tournamentStatus: t.status,
          hasTournament: true,
          tournamentMatches: [],
          leagueMatches: [],
        });
      }
    }

    // Add tournament matches to their week
    for (const m of matches) {
      const week = m.tournament.weekNumber;
      if (!weekMap.has(week)) {
        weekMap.set(week, {
          weekNumber: week,
          tournamentName: m.tournament.name,
          tournamentStatus: 'completed',
          hasTournament: true,
          tournamentMatches: [],
          leagueMatches: [],
        });
      }
      weekMap.get(week)!.tournamentMatches.push({
        id: m.id,
        round: m.round,
        bracket: m.bracket || 'upper',
        groupLabel: m.groupLabel || null,
        score1: m.score1,
        score2: m.score2,
        format: m.format || 'BO1',
        status: m.status,
        winnerId: m.winnerId,
        team1: m.team1 ? { id: m.team1.id, name: m.team1.name } : null,
        team2: m.team2 ? { id: m.team2.id, name: m.team2.name } : null,
        // ★ Flatten team players into comma-separated gamertags for display
        team1Players: m.team1?.teamPlayers?.map((tp: any) => tp.player?.gamertag).filter(Boolean).join(', ') || undefined,
        team2Players: m.team2?.teamPlayers?.map((tp: any) => tp.player?.gamertag).filter(Boolean).join(', ') || undefined,
        mvpPlayer: m.mvpPlayer ? { id: m.mvpPlayer.id, gamertag: m.mvpPlayer.gamertag } : null,
      });
    }

    // Add league matches to their week
    for (const m of leagueMatches) {
      const week = m.week;
      if (!weekMap.has(week)) {
        weekMap.set(week, {
          weekNumber: week,
          tournamentName: '',
          tournamentStatus: '',
          hasTournament: false,
          tournamentMatches: [],
          leagueMatches: [],
        });
      }
      weekMap.get(week)!.leagueMatches.push({
        id: m.id,
        week: m.week,
        score1: m.score1,
        score2: m.score2,
        format: m.format || 'BO3',
        club1: { id: m.club1.id, name: m.club1.profile?.name || '', logo: m.club1.profile?.logo || null },
        club2: { id: m.club2.id, name: m.club2.profile?.name || '', logo: m.club2.profile?.logo || null },
      });
    }

    // Sort weeks descending (newest first)
    const weeks = Array.from(weekMap.values()).sort((a, b) => b.weekNumber - a.weekNumber);

    return NextResponse.json({
      season: {
        id: activeSeason.id,
        name: activeSeason.name,
        number: activeSeason.number,
        status: activeSeason.status,
      },
      weeks,
    }, { headers });
  } catch (error) {
    console.error('[API /season-results] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch season results' },
      { status: 500, headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10', 'Vary': 'Accept-Encoding' } }
    );
  }
}
