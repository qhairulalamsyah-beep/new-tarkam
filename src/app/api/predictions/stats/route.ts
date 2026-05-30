import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/predictions/stats — Get prediction stats for a specific match or leaderboard
// Query params: ?matchId= (match stats) | ?leaderboard=true (leaderboard)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');
    const leaderboard = searchParams.get('leaderboard') === 'true';
    const limit = parseInt(searchParams.get('limit') || '10');

    // Match-specific prediction stats
    if (matchId) {
      const predictions = await db.prediction.findMany({
        where: { matchId },
        include: {
          account: {
            select: {
              id: true,
              username: true,
              player: {
                select: { id: true, gamertag: true, avatar: true, division: true },
              },
            },
          },
        },
      });

      // Get match info for team names
      const match = await db.match.findUnique({
        where: { id: matchId },
        include: {
          team1: { select: { id: true, name: true } },
          team2: { select: { id: true, name: true } },
        },
      });

      const team1Id = match?.team1Id;
      const team2Id = match?.team2Id;

      const team1Count = predictions.filter(p => p.predictedWinnerId === team1Id).length;
      const team2Count = predictions.filter(p => p.predictedWinnerId === team2Id).length;
      const total = predictions.length;

      const team1Pct = total > 0 ? Math.round((team1Count / total) * 100) : 0;
      const team2Pct = total > 0 ? 100 - team1Pct : 0;

      return NextResponse.json({
        success: true,
        matchId,
        total,
        team1: {
          id: team1Id,
          name: match?.team1?.name || 'Team 1',
          count: team1Count,
          percentage: team1Pct,
        },
        team2: {
          id: team2Id,
          name: match?.team2?.name || 'Team 2',
          count: team2Count,
          percentage: team2Pct,
        },
        predictions,
      });
    }

    // Leaderboard — top predictors
    if (leaderboard) {
      // Aggregate prediction stats per account
      const predictionStats = await db.prediction.groupBy({
        by: ['accountId'],
        _count: { id: true },
        _sum: { pointsEarned: true },
        where: { isCorrect: { not: null } },
        orderBy: { _sum: { pointsEarned: 'desc' } },
        take: limit * 3,
      });

      // Get correct prediction counts
      const correctStats = await db.prediction.groupBy({
        by: ['accountId'],
        _count: { id: true },
        where: { isCorrect: true },
        orderBy: { _count: { id: 'desc' } },
        take: limit * 3,
      });

      const correctMap = new Map(correctStats.map(s => [s.accountId, s._count.id]));

      // Combine and sort by correct predictions
      const leaderboardData = predictionStats
        .map(stat => ({
          accountId: stat.accountId,
          total: stat._count.id,
          correct: correctMap.get(stat.accountId) || 0,
          points: stat._sum.pointsEarned || 0,
          accuracy: stat._count.id > 0
            ? Math.round(((correctMap.get(stat.accountId) || 0) / stat._count.id) * 100)
            : 0,
        }))
        .sort((a, b) => b.correct - a.correct || b.accuracy - a.accuracy)
        .slice(0, limit);

      // Enrich with player info
      const accountIds = leaderboardData.map(d => d.accountId);
      const accounts = await db.account.findMany({
        where: { id: { in: accountIds } },
        include: {
          player: {
            select: { id: true, gamertag: true, avatar: true, division: true },
          },
        },
      });

      const accountMap = new Map(accounts.map(a => [a.id, a]));

      const enriched = leaderboardData.map((d, idx) => {
        const acc = accountMap.get(d.accountId);
        return {
          rank: idx + 1,
          accountId: d.accountId,
          gamertag: acc?.player?.gamertag || 'Unknown',
          avatar: acc?.player?.avatar || null,
          division: acc?.player?.division || 'male',
          total: d.total,
          correct: d.correct,
          accuracy: d.accuracy,
          points: d.points,
        };
      });

      return NextResponse.json({ success: true, leaderboard: enriched });
    }

    return NextResponse.json({ error: 'Parameter tidak valid' }, { status: 400 });
  } catch (error) {
    console.error('Get prediction stats error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
