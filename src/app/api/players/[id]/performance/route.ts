import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = new Headers();
  headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
  headers.set('Surrogate-Key', 'league-data');

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const division = searchParams.get('division') || undefined;

  // Verify player exists
  const player = await db.player.findUnique({
    where: { id },
    select: { id: true, gamertag: true, division: true, points: true },
  });

  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404, headers });
  }

  const effectiveDivision = division || player.division;

  // ═══ Fetch all tournaments the player participated in ═══
  // Get participations with tournament info (week number, season)
  const participations = await db.participation.findMany({
    where: {
      playerId: id,
      tournament: { division: effectiveDivision },
    },
    include: {
      tournament: {
        select: {
          id: true,
          weekNumber: true,
          name: true,
          division: true,
          seasonId: true,
          status: true,
        },
      },
    },
    orderBy: { tournament: { weekNumber: 'asc' } },
  });

  // ═══ Get player's point records grouped by tournament ═══
  const pointRecords = await db.playerPoint.findMany({
    where: {
      playerId: id,
      tournament: { division: effectiveDivision },
    },
    include: {
      tournament: {
        select: { id: true, weekNumber: true, name: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // ═══ Get player's match results (via TeamPlayer → Team → Match) ═══
  const teamPlayers = await db.teamPlayer.findMany({
    where: { playerId: id },
    include: {
      team: {
        include: {
          matchAsTeam1: {
            where: { status: 'completed' },
            select: {
              id: true,
              tournamentId: true,
              winnerId: true,
              mvpPlayerId: true,
            },
          },
          matchAsTeam2: {
            where: { status: 'completed' },
            select: {
              id: true,
              tournamentId: true,
              winnerId: true,
              mvpPlayerId: true,
            },
          },
          tournament: {
            select: { id: true, weekNumber: true },
          },
        },
      },
    },
  });

  // ═══ Build weekly data ═══
  // Map: weekNumber → { points, wins, losses, mvpCount }
  const weekMap = new Map<number, {
    week: number;
    points: number;
    wins: number;
    losses: number;
    mvpCount: number;
  }>();

  // Aggregate points per week from point records
  for (const pr of pointRecords) {
    if (!pr.tournament) continue;
    const week = pr.tournament.weekNumber;
    const existing = weekMap.get(week) || { week, points: 0, wins: 0, losses: 0, mvpCount: 0 };
    existing.points += pr.amount;
    weekMap.set(week, existing);
  }

  // Aggregate wins/losses per week from match results
  for (const tp of teamPlayers) {
    const team = tp.team;
    const allMatches = [...team.matchAsTeam1, ...team.matchAsTeam2];

    for (const match of allMatches) {
      // Find the tournament week for this match
      const tournament = team.tournament;
      if (!tournament) continue;
      // Find the match's tournament — it could be different from team's tournament
      // because teams play in specific tournaments. The match.tournamentId tells us.
      const matchTournament = participations.find(p => p.tournamentId === match.tournamentId);
      const week = matchTournament?.tournament?.weekNumber ?? tournament.weekNumber;

      const existing = weekMap.get(week) || { week, points: 0, wins: 0, losses: 0, mvpCount: 0 };

      if (match.winnerId === team.id) {
        existing.wins += 1;
      } else if (match.winnerId && match.winnerId !== team.id) {
        existing.losses += 1;
      }

      // Check if player was MVP in this match
      if (match.mvpPlayerId === id) {
        existing.mvpCount += 1;
      }

      weekMap.set(week, existing);
    }
  }

  // Also count MVP from participations (more reliable source)
  for (const p of participations) {
    const week = p.tournament.weekNumber;
    const existing = weekMap.get(week) || { week, points: 0, wins: 0, losses: 0, mvpCount: 0 };
    if (p.isMvp) {
      existing.mvpCount = Math.max(existing.mvpCount, 1);
    }
    if (p.isWinner) {
      // Participation record marks winners — use this as a more reliable source
      // Only increment if we don't already have win data from match records
    }
    weekMap.set(week, existing);
  }

  // Sort by week number
  const sortedWeeks = Array.from(weekMap.values()).sort((a, b) => a.week - b.week);

  // ═══ Build Weekly Points with cumulative ═══
  let cumulativePoints = 0;
  const weeklyPoints = sortedWeeks.map(w => {
    cumulativePoints += w.points;
    return {
      week: w.week,
      points: w.points,
      cumulativePoints,
    };
  });

  // ═══ Build Win/Loss per Week ═══
  const winLossPerWeek = sortedWeeks.map(w => ({
    week: w.week,
    wins: w.wins,
    losses: w.losses,
  }));

  // ═══ Build MVP per Week ═══
  const mvpPerWeek = sortedWeeks.map(w => ({
    week: w.week,
    mvpCount: w.mvpCount,
  }));

  // ═══ Build Rank Progress ═══
  // Calculate rank at each week based on cumulative points
  // We need all players' cumulative points at each week to determine ranking
  const allDivisionPointRecords = await db.playerPoint.findMany({
    where: {
      player: { division: effectiveDivision, isActive: true },
      tournament: { division: effectiveDivision },
    },
    include: {
      tournament: { select: { weekNumber: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Build cumulative points for all players at each week
  const allPlayerCumulative = new Map<string, Map<number, number>>(); // playerId → week → cumulative
  const allWeeks = new Set<number>();

  for (const pr of allDivisionPointRecords) {
    if (!pr.tournament) continue;
    const w = pr.tournament.weekNumber;
    allWeeks.add(w);

    if (!allPlayerCumulative.has(pr.playerId)) {
      allPlayerCumulative.set(pr.playerId, new Map());
    }
    const playerWeekMap = allPlayerCumulative.get(pr.playerId)!;
    const prev = playerWeekMap.get(w) || 0;
    playerWeekMap.set(w, prev + pr.amount);
  }

  // For each week, calculate running cumulative for each player
  const sortedAllWeeks = Array.from(allWeeks).sort((a, b) => a - b);
  // Propagate cumulative: week N cumulative = sum of all previous weeks' points
  const playerRunningTotals = new Map<string, number>(); // playerId → running total
  const weekRankMap = new Map<number, number>(); // week → this player's rank

  for (const week of sortedAllWeeks) {
    // Add this week's points to running totals
    for (const [playerId, weekMap2] of allPlayerCumulative) {
      const weekPts = weekMap2.get(week) || 0;
      const prev = playerRunningTotals.get(playerId) || 0;
      playerRunningTotals.set(playerId, prev + weekPts);
    }

    // Rank all players by cumulative points (descending)
    const ranked = Array.from(playerRunningTotals.entries())
      .sort((a, b) => b[1] - a[1]);

    const rank = ranked.findIndex(([pid]) => pid === id) + 1;
    if (rank > 0) {
      weekRankMap.set(week, rank);
    }
  }

  // Only include weeks where this player has data
  const rankProgress = sortedWeeks
    .filter(w => weekRankMap.has(w.week))
    .map(w => ({
      week: w.week,
      rank: weekRankMap.get(w.week)!,
    }));

  return NextResponse.json({
    player: {
      id: player.id,
      gamertag: player.gamertag,
      division: player.division,
    },
    weeklyPoints,
    winLossPerWeek,
    mvpPerWeek,
    rankProgress,
    totalWeeks: sortedWeeks.length,
  }, { headers });
}
