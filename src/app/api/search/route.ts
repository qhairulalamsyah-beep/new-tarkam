import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const headers = new Headers();
  headers.set('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=15');
  headers.set('Surrogate-Key', 'search-data');

  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q')?.trim() || '';

  if (!q || q.length < 2) {
    return NextResponse.json({ players: [], clubs: [], tournaments: [] }, { headers });
  }

  const limit = 5;

  // Search Players — by gamertag or name (contains, case-insensitive)
  const players = await db.player.findMany({
    where: {
      isActive: true,
      registrationStatus: 'approved',
      OR: [
        { gamertag: { contains: q } },
        { name: { contains: q } },
      ],
    },
    include: {
      clubMembers: {
        where: { leftAt: null },
        include: {
          profile: {
            select: { id: true, name: true, logo: true },
          },
        },
        take: 1,
      },
    },
    orderBy: { points: 'desc' },
    take: limit,
  });

  // Search Clubs — by profile name (contains)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clubs: any = await db.clubProfile.findMany({
    where: {
      name: { contains: q },
    },
    include: {
      members: {
        where: { leftAt: null },
        select: { id: true },
      },
      seasonEntries: {
        take: 1,
        orderBy: { points: 'desc' } as const,
        select: {
          division: true,
          wins: true,
          losses: true,
          points: true,
          gameDiff: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // Search Tournaments — by name (contains)
  const tournaments = await db.tournament.findMany({
    where: {
      name: { contains: q },
    },
    include: {
      season: {
        select: { id: true, name: true, number: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // Format results
  const formattedPlayers = players.map(p => {
    const clubMember = p.clubMembers[0];
    return {
      id: p.id,
      gamertag: p.gamertag,
      name: p.name,
      division: p.division,
      tier: p.tier,
      points: p.points,
      totalWins: p.totalWins,
      totalMvp: p.totalMvp,
      avatar: p.avatar,
      club: clubMember?.profile ? { id: clubMember.profile.id, name: clubMember.profile.name, logo: clubMember.profile.logo } : null,
    };
  });

  const formattedClubs = clubs.map(c => {
    const latestEntry = c.seasonEntries[0];
    return {
      id: c.id,
      name: c.name,
      logo: c.logo,
      memberCount: c.members.length,
      division: latestEntry?.division || 'male',
      wins: latestEntry?.wins || 0,
      losses: latestEntry?.losses || 0,
      points: latestEntry?.points || 0,
    };
  });

  const formattedTournaments = tournaments.map(t => ({
    id: t.id,
    name: t.name,
    weekNumber: t.weekNumber,
    division: t.division,
    status: t.status,
    format: t.format,
    prizePool: t.prizePool,
    season: t.season,
  }));

  return NextResponse.json({
    players: formattedPlayers,
    clubs: formattedClubs,
    tournaments: formattedTournaments,
  }, { headers });
}
