import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { SEASON_TOTAL_WEEKS } from '@/lib/constants';
import { pusherTrigger, PUSHER_CHANNELS, PUSHER_EVENTS } from '@/lib/pusher';
import { createAuditLog } from '@/lib/audit';
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { wibToUTC } from '@/lib/utils';

// ★ Vercel serverless: tournament queries with deep includes need more than default 10s
export const maxDuration = 60;

// Force dynamic — this route is never statically rendered
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const headers = new Headers();
  // Tier 2 — Semi-Static: s-maxage=300 (5min CDN), stale-while-revalidate=600 (10min stale)
  headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  headers.set('Surrogate-Key', 'league-data');
  headers.set('Vary', 'Accept-Encoding');

  const { searchParams } = new URL(request.url);
  const division = searchParams.get('division');
  const seasonId = searchParams.get('seasonId');
  const status = searchParams.get('status');

  const where: Record<string, unknown> = {};
  if (division) where.division = division;
  if (seasonId) where.seasonId = seasonId;
  if (status) where.status = status;

  const tournaments = await db.tournament.findMany({
    where,
    orderBy: { weekNumber: 'desc' },
    include: {
      _count: { select: { teams: true, participations: true, matches: true, prizes: true } },
      season: { select: { name: true, number: true } },
      teams: { where: { isWinner: true }, select: { id: true, name: true, isWinner: true } },
      prizes: { orderBy: { position: 'asc' } },
      participations: {
        include: { player: { select: { id: true, gamertag: true, name: true, tier: true, points: true, division: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  // ★ Add match status breakdown for main_event tournaments (lightweight aggregation)
  const mainEventIds = tournaments.filter((t: any) => t.status === 'main_event').map((t: any) => t.id);
  const matchStats: Record<string, { live: number; ready: number; completed: number; pending: number; total: number }> = {};

  if (mainEventIds.length > 0) {
    const statusCounts = await db.match.groupBy({
      by: ['tournamentId', 'status'],
      where: { tournamentId: { in: mainEventIds } },
      _count: { status: true },
    });

    for (const row of statusCounts) {
      const tid = row.tournamentId;
      if (!matchStats[tid]) matchStats[tid] = { live: 0, ready: 0, completed: 0, pending: 0, total: 0 };
      const count = row._count.status;
      if (row.status === 'live' || row.status === 'main_event') matchStats[tid].live += count;
      else if (row.status === 'ready') matchStats[tid].ready += count;
      else if (row.status === 'completed') matchStats[tid].completed += count;
      else matchStats[tid].pending += count;
      matchStats[tid].total += count;
    }
  }

  // Merge matchStats into tournament objects
  const result = tournaments.map((t: any) => ({
    ...t,
    matchStats: matchStats[t.id] || null,
  }));

  return NextResponse.json(result, { headers });
}

export async function POST(request: Request) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await request.json();
  const { name, weekNumber, division, seasonId, prizePool, format, defaultMatchFormat, bpm, location, scheduledAt } = body;

  if (!name || !weekNumber || !division || !seasonId) {
    return NextResponse.json({ error: 'Missing required fields: name, weekNumber, division, seasonId' }, { status: 400 });
  }

  const validFormats = ['single_elimination', 'group_stage', 'swiss', 'swiss_se', 'upper_semi'];
  const validMatchFormats = ['BO1', 'BO3', 'BO5'];

  if (format && !validFormats.includes(format)) {
    return NextResponse.json({ error: 'Invalid format. Use: single_elimination, group_stage, swiss, upper_semi' }, { status: 400 });
  }

  if (defaultMatchFormat && !validMatchFormats.includes(defaultMatchFormat)) {
    return NextResponse.json({ error: 'Invalid match format. Use: BO1, BO3, BO5' }, { status: 400 });
  }

  // ── Validate: 1 season = max 10 weeks ──
  // Check the season's current tournament count
  const season = await db.season.findUnique({
    where: { id: seasonId },
    include: { _count: { select: { tournaments: true } } },
  });

  if (!season) {
    return NextResponse.json({ error: 'Season tidak ditemukan' }, { status: 404 });
  }

  if (season.status === 'completed') {
    return NextResponse.json({ error: `Season ${season.name} sudah selesai (completed). Buat season baru untuk melanjutkan.` }, { status: 400 });
  }

  // Count completed + in-progress tournaments for this season
  const existingTournaments = await db.tournament.count({
    where: { seasonId },
  });

  if (existingTournaments >= SEASON_TOTAL_WEEKS) {
    return NextResponse.json({
      error: `Season ${season.name} sudah penuh (${SEASON_TOTAL_WEEKS} weeks). Week berikutnya harus masuk ke season baru.`,
      hint: 'Buat season baru terlebih dahulu, lalu assign tournament ke season tersebut.',
    }, { status: 400 });
  }

  // Auto-correct weekNumber if it exceeds the max for this season
  // The weekNumber should be the next available slot (existingTournaments + 1)
  const correctedWeekNumber = weekNumber > existingTournaments + 1 ? existingTournaments + 1 : weekNumber;

  // Check for duplicate weekNumber+division+seasonId combination
  const existingWeek = await db.tournament.findUnique({
    where: { weekNumber_division_seasonId: { weekNumber: correctedWeekNumber, division, seasonId } },
  });

  if (existingWeek) {
    return NextResponse.json({
      error: `Week ${correctedWeekNumber} (${division}) di season ini sudah ada! Hapus turnamen lama atau gunakan week lain.`,
      hint: `Turnamen yang bentrok: "${existingWeek.name}" (status: ${existingWeek.status})`,
    }, { status: 409 });
  }

  let tournament;
  try {
    tournament = await db.tournament.create({
      data: {
        name,
        weekNumber: correctedWeekNumber,
        division,
        seasonId,
        status: 'setup',
        format: format || 'single_elimination',
        defaultMatchFormat: defaultMatchFormat || 'BO1',
        prizePool: prizePool || 0,
        location: location || 'Online',
        bpm: bpm || null,
        scheduledAt: scheduledAt ? wibToUTC(scheduledAt) : null,
      },
    });
  } catch (e: unknown) {
    const error = e as Error;
    console.error('[Tournament Create Error]', error);
    if (error.message?.includes('Unique') || error.message?.includes('unique')) {
      return NextResponse.json({
        error: `Week ${correctedWeekNumber} (${division}) di season ini sudah ada! Hapus turnamen lama atau gunakan week lain.`,
      }, { status: 409 });
    }
    return NextResponse.json({ error: 'Gagal membuat turnamen. Coba lagi.' }, { status: 500 });
  }

  // ── Sync: Link matching CalendarEvent to this tournament ──
  // When admin creates a tournament, find any CalendarEvent with same division+weekNumber+seasonId
  // and link it. If the tournament has a different date than the calendar event, update the tournament date.
  try {
    const matchingEvent = await db.calendarEvent.findFirst({
      where: {
        division: tournament.division,
        weekNumber: tournament.weekNumber,
        seasonId: tournament.seasonId,
        tournamentId: null, // Not yet linked
      },
    });

    if (matchingEvent) {
      // Link the calendar event to this tournament
      await db.calendarEvent.update({
        where: { id: matchingEvent.id },
        data: {
          tournamentId: tournament.id,
          // If tournament doesn't have scheduledAt, use the calendar event date
          ...(tournament.scheduledAt ? {} : { date: tournament.scheduledAt || matchingEvent.date }),
        },
      });

      // If tournament doesn't have a scheduledAt, use the calendar event's date
      if (!tournament.scheduledAt) {
        await db.tournament.update({
          where: { id: tournament.id },
          data: { scheduledAt: matchingEvent.date },
        });
      }
    }
  } catch (syncError) {
    // Non-critical: don't fail the tournament creation if sync fails
    console.error('[Tournament Calendar Sync Error]', syncError);
  }

  // Pusher: Notify real-time clients about tournament creation
  void pusherTrigger(PUSHER_CHANNELS.TOURNAMENT, PUSHER_EVENTS.TOURNAMENT_STATUS_CHANGED, {
    tournamentId: tournament.id, division: tournament.division, weekNumber: tournament.weekNumber, status: tournament.status,
  });
  void pusherTrigger(PUSHER_CHANNELS.FEED, PUSHER_EVENTS.FEED_UPDATED, {
    type: 'tournament-created', tournamentId: tournament.id, division: tournament.division, weekNumber: tournament.weekNumber,
  });

  await createAuditLog({
    adminId: authResult.id,
    adminName: authResult.username,
    action: 'create',
    entity: 'tournament',
    entityId: tournament.id,
    details: `Create tournament: ${tournament.name}`,
  });

  // Purge CDN cache so dashboard shows the new tournament
  revalidateTag('league-data', 'max');

  return NextResponse.json(tournament, { status: 201 });
}
