import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// Force dynamic — this route is never statically rendered
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const headers = new Headers();
  headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  headers.set('Surrogate-Key', 'league-data');

  const { searchParams } = new URL(request.url);
  const division = searchParams.get('division');
  const month = searchParams.get('month'); // "2026-06" format
  const seasonId = searchParams.get('seasonId');

  // ── Build where clause ──
  const where: Record<string, unknown> = {};
  if (division) where.division = division;
  if (seasonId) where.seasonId = seasonId;

  // ── Fetch current active/upcoming seasons ──
  const activeSeasons = await db.season.findMany({
    where: { status: { in: ['active', 'upcoming'] } },
    orderBy: { number: 'desc' },
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

  // ── Fetch tournaments ──
  // Get upcoming and in-progress tournaments (not completed)
  const tournaments = await db.tournament.findMany({
    where: {
      ...where,
      status: { notIn: ['completed'] },
    },
    orderBy: [{ weekNumber: 'asc' }],
    include: {
      season: {
        select: {
          id: true,
          name: true,
          number: true,
          division: true,
          status: true,
          startDate: true,
          endDate: true,
        },
      },
      _count: {
        select: {
          teams: true,
          participations: true,
        },
      },
    },
  });

  // Also fetch completed tournaments for the current month context
  const completedTournaments = await db.tournament.findMany({
    where: {
      ...where,
      status: 'completed',
    },
    orderBy: [{ weekNumber: 'desc' }],
    take: 10,
    include: {
      season: {
        select: {
          id: true,
          name: true,
          number: true,
          division: true,
          status: true,
          startDate: true,
          endDate: true,
        },
      },
      _count: {
        select: {
          teams: true,
          participations: true,
        },
      },
    },
  });

  // ── Compute inferred dates from season/week data ──
  // If a tournament doesn't have scheduledAt, infer from season startDate + weekNumber
  const computeInferredDate = (tournament: typeof tournaments[0]) => {
    // Use scheduledAt if available
    if (tournament.scheduledAt) {
      return {
        startAt: tournament.scheduledAt,
        endAt: null,
        registrationDeadline: null,
      };
    }

    // Infer from season: Week N = season.startDate + (N-1) * 7 days
    const seasonStart = tournament.season?.startDate;
    if (seasonStart) {
      const weekOffset = (tournament.weekNumber - 1) * 7;
      const startAt = new Date(seasonStart);
      startAt.setDate(startAt.getDate() + weekOffset);
      // Tournament typically runs for 1 day (the day of the week)
      const endAt = new Date(startAt);
      endAt.setDate(endAt.getDate() + 1);
      // Registration deadline = start of the tournament day
      const registrationDeadline = new Date(startAt);
      registrationDeadline.setHours(20, 30, 0, 0); // 20:30 WIB

      return { startAt, endAt, registrationDeadline };
    }

    return { startAt: null, endAt: null, registrationDeadline: null };
  };

  // ── Format tournament data ──
  const formatTournament = (t: typeof tournaments[0]) => {
    const dates = computeInferredDate(t);

    // Determine registration status
    let registrationStatus: 'open' | 'closed' | 'upcoming' | 'live' = 'upcoming';
    if (t.status === 'registration') {
      registrationStatus = 'open';
    } else if (t.status === 'main_event' || t.status === 'finalization') {
      registrationStatus = 'live';
    } else if (['approval', 'team_generation', 'bracket_generation'].includes(t.status)) {
      registrationStatus = 'closed';
    } else if (t.status === 'setup') {
      registrationStatus = 'upcoming';
    } else if (t.status === 'completed') {
      registrationStatus = 'closed';
    }

    return {
      id: t.id,
      name: t.name,
      weekNumber: t.weekNumber,
      division: t.division,
      status: t.status,
      registrationStatus,
      format: t.format,
      defaultMatchFormat: t.defaultMatchFormat,
      prizePool: t.prizePool,
      scheduledAt: t.scheduledAt?.toISOString() ?? null,
      startAt: dates.startAt?.toISOString() ?? null,
      endAt: dates.endAt?.toISOString() ?? null,
      registrationDeadline: dates.registrationDeadline?.toISOString() ?? null,
      participantCount: t._count.participations,
      teamCount: t._count.teams,
      season: {
        id: t.season.id,
        name: t.season.name,
        number: t.season.number,
        division: t.season.division,
        status: t.season.status,
      },
    };
  };

  // ── Group tournaments by month ──
  const allTournaments = [...tournaments, ...completedTournaments].map(formatTournament);

  const byMonth: Record<string, typeof allTournaments> = {};
  for (const t of allTournaments) {
    const dateStr = t.startAt || t.scheduledAt;
    if (dateStr) {
      const d = new Date(dateStr);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(t);
    } else {
      // No date — put in "unscheduled" bucket
      if (!byMonth['unscheduled']) byMonth['unscheduled'] = [];
      byMonth['unscheduled'].push(t);
    }
  }

  // ── Upcoming tournaments (not completed, sorted by date) ──
  const upcoming = allTournaments
    .filter(t => t.status !== 'completed')
    .sort((a, b) => {
      const aDate = a.startAt || a.scheduledAt || '';
      const bDate = b.startAt || b.scheduledAt || '';
      return aDate.localeCompare(bDate);
    });

  // ── Current season info ──
  const currentSeason = activeSeasons[0] || null;

  return NextResponse.json({
    currentSeason,
    seasons: activeSeasons,
    tournaments: allTournaments,
    upcoming,
    byMonth,
    meta: {
      totalTournaments: allTournaments.length,
      upcomingCount: upcoming.length,
      month: month || null,
    },
  }, { headers });
}
