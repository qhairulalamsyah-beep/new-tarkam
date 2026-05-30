import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * GET /api/clubs/[id]/stats
 *
 * Returns detailed club statistics including aggregate member stats,
 * milestones, top performers, division breakdown, and recent matches.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = new Headers();
  headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
  headers.set('Surrogate-Key', 'league-data');

  try {
    const { id } = await params;

    // Resolve to ClubProfile
    let profileId = id;

    const profile = await db.clubProfile.findUnique({ where: { id } });

    if (!profile) {
      // Maybe it's a Club (season entry) ID — look up the profile
      const club = await db.club.findUnique({ where: { id } });
      if (!club) {
        return NextResponse.json({ error: 'Club tidak ditemukan' }, { headers, status: 404 });
      }
      profileId = club.profileId;
    }

    // Fetch full profile with members and season entries
    const fullProfile = await db.clubProfile.findUnique({
      where: { id: profileId },
      include: {
        members: {
          where: { leftAt: null },
          include: {
            player: {
              select: {
                id: true,
                gamertag: true,
                name: true,
                division: true,
                avatar: true,
                tier: true,
                points: true,
                totalWins: true,
                totalMvp: true,
                streak: true,
                maxStreak: true,
                matches: true,
                isActive: true,
                city: true,
              },
            },
          },
          orderBy: [
            { role: 'desc' },
            { player: { gamertag: 'asc' } },
          ],
        },
        seasonEntries: {
          include: {
            season: { select: { id: true, name: true, number: true, division: true, status: true } },
          },
        },
        championSeasons: {
          select: { id: true, name: true, number: true, division: true },
        },
      },
    });

    if (!fullProfile) {
      return NextResponse.json({ error: 'Club profile tidak ditemukan' }, { headers, status: 404 });
    }

    const members = fullProfile.members.filter(m => m.leftAt === null);
    const players = members.map(m => m.player);

    // ─── Aggregate member stats ───
    const totalMemberPoints = players.reduce((sum, p) => sum + p.points, 0);
    const totalMemberWins = players.reduce((sum, p) => sum + p.totalWins, 0);
    const totalMemberMvp = players.reduce((sum, p) => sum + p.totalMvp, 0);
    const totalMemberMatches = players.reduce((sum, p) => sum + p.matches, 0);
    const averagePoints = players.length > 0 ? Math.round(totalMemberPoints / players.length) : 0;
    const overallWinRate = totalMemberMatches > 0 ? Math.round((totalMemberWins / totalMemberMatches) * 100) : 0;

    // ─── Division breakdown ───
    const malePlayers = players.filter(p => p.division === 'male');
    const femalePlayers = players.filter(p => p.division === 'female');

    const maleStats = {
      memberCount: malePlayers.length,
      totalPoints: malePlayers.reduce((sum, p) => sum + p.points, 0),
      totalWins: malePlayers.reduce((sum, p) => sum + p.totalWins, 0),
      totalMvp: malePlayers.reduce((sum, p) => sum + p.totalMvp, 0),
      topPlayer: malePlayers.length > 0
        ? malePlayers.sort((a, b) => b.points - a.points)[0]
        : null,
    };

    const femaleStats = {
      memberCount: femalePlayers.length,
      totalPoints: femalePlayers.reduce((sum, p) => sum + p.points, 0),
      totalWins: femalePlayers.reduce((sum, p) => sum + p.totalWins, 0),
      totalMvp: femalePlayers.reduce((sum, p) => sum + p.totalMvp, 0),
      topPlayer: femalePlayers.length > 0
        ? femalePlayers.sort((a, b) => b.points - a.points)[0]
        : null,
    };

    // ─── Best tier among members ───
    const tierOrder: Record<string, number> = { S: 3, A: 2, B: 1 };
    const bestTier = players.length > 0
      ? players.reduce((best, p) => {
          const pOrder = tierOrder[p.tier] || 0;
          const bOrder = tierOrder[best] || 0;
          return pOrder > bOrder ? p.tier : best;
        }, 'B')
      : 'B';

    // ─── Season performance ───
    const seasonPerformance = fullProfile.seasonEntries.map(entry => ({
      seasonId: entry.seasonId,
      seasonName: entry.season?.name || '',
      seasonNumber: entry.season?.number || 0,
      division: entry.division,
      wins: entry.wins,
      losses: entry.losses,
      points: entry.points,
      gameDiff: entry.gameDiff,
    }));

    // ─── Milestones ───
    const milestones: Array<{
      id: string;
      icon: string;
      label: string;
      description: string;
      achievedAt: string | null;
      achieved: boolean;
    }> = [];

    // Season Champion milestones
    for (const cs of fullProfile.championSeasons) {
      milestones.push({
        id: `champion-${cs.id}`,
        icon: '🏆',
        label: `Juara Tarkam Season ${cs.number}`,
        description: `Menangkan liga Season ${cs.number}`,
        achievedAt: null, // We don't have the exact date easily
        achieved: true,
      });
    }

    // Member count milestones
    const memberMilestones = [
      { count: 5, icon: '👥', label: '5 Anggota', desc: 'Club dengan 5 anggota' },
      { count: 10, icon: '👥', label: '10 Anggota', desc: 'Club dengan 10 anggota' },
      { count: 15, icon: '👥', label: '15 Anggota', desc: 'Club dengan 15 anggota' },
      { count: 20, icon: '👥', label: '20 Anggota', desc: 'Club besar dengan 20+ anggota' },
    ];
    for (const m of memberMilestones) {
      milestones.push({
        id: `members-${m.count}`,
        icon: m.icon,
        label: m.label,
        description: m.desc,
        achievedAt: members.length >= m.count ? fullProfile.createdAt.toISOString() : null,
        achieved: members.length >= m.count,
      });
    }

    // Total wins milestones
    const winMilestones = [
      { count: 10, icon: '💯', label: '10 Total Win', desc: 'Gabungan 10 win dari semua anggota' },
      { count: 50, icon: '💯', label: '50 Total Win', desc: 'Gabungan 50 win dari semua anggota' },
      { count: 100, icon: '💯', label: '100 Total Win', desc: 'Gabungan 100 win dari semua anggota' },
      { count: 200, icon: '🔥', label: '200 Total Win', desc: 'Gabungan 200 win — dominan!' },
    ];
    for (const m of winMilestones) {
      milestones.push({
        id: `wins-${m.count}`,
        icon: m.icon,
        label: m.label,
        description: m.desc,
        achievedAt: totalMemberWins >= m.count ? fullProfile.createdAt.toISOString() : null,
        achieved: totalMemberWins >= m.count,
      });
    }

    // MVP milestones
    const mvpMilestones = [
      { count: 5, icon: '⭐', label: '5 Total MVP', desc: 'Gabungan 5 MVP dari semua anggota' },
      { count: 15, icon: '⭐', label: '15 Total MVP', desc: 'Gabungan 15 MVP — bintang tim!' },
    ];
    for (const m of mvpMilestones) {
      milestones.push({
        id: `mvp-${m.count}`,
        icon: m.icon,
        label: m.label,
        description: m.desc,
        achievedAt: totalMemberMvp >= m.count ? fullProfile.createdAt.toISOString() : null,
        achieved: totalMemberMvp >= m.count,
      });
    }

    // Club league wins milestones
    const clubWins = fullProfile.seasonEntries.reduce((sum, e) => sum + e.wins, 0);
    const clubLosses = fullProfile.seasonEntries.reduce((sum, e) => sum + e.losses, 0);
    const clubTotalMatches = clubWins + clubLosses;

    if (clubWins >= 1) {
      milestones.push({
        id: 'club-first-win',
        icon: '🏅',
        label: 'Win Pertama Club',
        description: 'Club memenangkan match liga pertama',
        achievedAt: null,
        achieved: true,
      });
    }
    if (clubLosses === 0 && clubWins >= 2) {
      milestones.push({
        id: 'club-undefeated',
        icon: '🔥',
        label: 'Tak Terkalahkan',
        description: 'Club tanpa kekalahan di liga',
        achievedAt: null,
        achieved: true,
      });
    }

    // ─── Top Performers (top 3 by points) ───
    const topPerformers = [...players]
      .sort((a, b) => b.points - a.points)
      .slice(0, 3)
      .map((p, i) => ({
        id: p.id,
        gamertag: p.gamertag,
        name: p.name,
        division: p.division,
        avatar: p.avatar,
        tier: p.tier,
        points: p.points,
        totalWins: p.totalWins,
        totalMvp: p.totalMvp,
        rank: i + 1,
      }));

    // ─── Recent Matches (last 5 league/playoff matches involving club) ───
    const clubIds = fullProfile.seasonEntries.map(e => e.id);
    const recentMatches: Array<{
      id: string;
      type: 'league' | 'playoff';
      club1Name: string;
      club2Name: string;
      score1: number | null;
      score2: number | null;
      week: number | null;
      round: string | null;
      status: string;
      isWin: boolean | null;
      seasonName: string;
      seasonNumber: number;
      division: string;
      completedAt: string | null;
    }> = [];

    if (clubIds.length > 0) {
      // Fetch league matches
      const leagueMatches = await db.leagueMatch.findMany({
        where: {
          OR: [
            { club1Id: { in: clubIds } },
            { club2Id: { in: clubIds } },
          ],
          status: 'completed',
        },
        include: {
          club1: { include: { profile: { select: { name: true } } } },
          club2: { include: { profile: { select: { name: true } } } },
          season: { select: { name: true, number: true, division: true } },
        },
        orderBy: { week: 'desc' },
        take: 5,
      });

      for (const m of leagueMatches) {
        const isClub1 = clubIds.includes(m.club1Id);
        const isClub2 = clubIds.includes(m.club2Id);
        const ourClubId = isClub1 ? m.club1Id : m.club2Id;
        const ourScore = isClub1 ? m.score1 : m.score2;
        const theirScore = isClub1 ? m.score2 : m.score1;
        const isWin = ourScore != null && theirScore != null ? ourScore > theirScore : null;

        recentMatches.push({
          id: m.id,
          type: 'league',
          club1Name: m.club1.profile?.name || 'Unknown',
          club2Name: m.club2.profile?.name || 'Unknown',
          score1: m.score1,
          score2: m.score2,
          week: m.week,
          round: null,
          status: m.status,
          isWin,
          seasonName: m.season?.name || '',
          seasonNumber: m.season?.number || 0,
          division: m.season?.division || '',
          completedAt: null,
        });
      }

      // Fetch playoff matches
      const playoffMatches = await db.playoffMatch.findMany({
        where: {
          OR: [
            { club1Id: { in: clubIds } },
            { club2Id: { in: clubIds } },
          ],
          status: 'completed',
        },
        include: {
          club1: { include: { profile: { select: { name: true } } } },
          club2: { include: { profile: { select: { name: true } } } },
          season: { select: { name: true, number: true, division: true } },
        },
        orderBy: { round: 'desc' },
        take: 5,
      });

      for (const m of playoffMatches) {
        const isClub1 = clubIds.includes(m.club1Id);
        const isClub2 = clubIds.includes(m.club2Id);
        const ourScore = isClub1 ? m.score1 : m.score2;
        const theirScore = isClub1 ? m.score2 : m.score1;
        const isWin = ourScore != null && theirScore != null ? ourScore > theirScore : null;

        recentMatches.push({
          id: m.id,
          type: 'playoff',
          club1Name: m.club1.profile?.name || 'Unknown',
          club2Name: m.club2.profile?.name || 'Unknown',
          score1: m.score1,
          score2: m.score2,
          week: null,
          round: m.round,
          status: m.status,
          isWin,
          seasonName: m.season?.name || '',
          seasonNumber: m.season?.number || 0,
          division: m.season?.division || '',
          completedAt: null,
        });
      }

      // Sort by season number desc and take top 5
      recentMatches.sort((a, b) => b.seasonNumber - a.seasonNumber);
      recentMatches.splice(5);
    }

    // ─── Build response ───
    return NextResponse.json({
      // Club identity
      id: profileId,
      name: fullProfile.name,

      // Aggregate member stats
      totalMembers: players.length,
      totalPoints: totalMemberPoints,
      averagePoints,
      totalWins: totalMemberWins,
      totalMvp: totalMemberMvp,
      totalMatches: totalMemberMatches,
      winRate: overallWinRate,
      bestTier,

      // Division breakdown
      maleStats: {
        memberCount: maleStats.memberCount,
        totalPoints: maleStats.totalPoints,
        totalWins: maleStats.totalWins,
        totalMvp: maleStats.totalMvp,
        topPlayer: maleStats.topPlayer ? {
          id: maleStats.topPlayer.id,
          gamertag: maleStats.topPlayer.gamertag,
          points: maleStats.topPlayer.points,
          tier: maleStats.topPlayer.tier,
          avatar: maleStats.topPlayer.avatar,
        } : null,
      },
      femaleStats: {
        memberCount: femaleStats.memberCount,
        totalPoints: femaleStats.totalPoints,
        totalWins: femaleStats.totalWins,
        totalMvp: femaleStats.totalMvp,
        topPlayer: femaleStats.topPlayer ? {
          id: femaleStats.topPlayer.id,
          gamertag: femaleStats.topPlayer.gamertag,
          points: femaleStats.topPlayer.points,
          tier: femaleStats.topPlayer.tier,
          avatar: femaleStats.topPlayer.avatar,
        } : null,
      },

      // League-level club stats
      clubWins,
      clubLosses,
      clubWinRate: clubTotalMatches > 0 ? Math.round((clubWins / clubTotalMatches) * 100) : 0,

      // Season performance
      seasonPerformance,

      // Milestones
      milestones,

      // Top performers
      topPerformers,

      // Recent matches
      recentMatches,
    }, { headers });

  } catch (error) {
    console.error('[GET /api/clubs/[id]/stats] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch club stats' }, { status: 500 });
  }
}
