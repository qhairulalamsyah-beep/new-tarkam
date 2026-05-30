import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

// Force dynamic
export const dynamic = 'force-dynamic';

// ── GET: List calendar events ──
export async function GET(request: Request) {
  const headers = new Headers();
  headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

  const { searchParams } = new URL(request.url);
  const division = searchParams.get('division');
  const seasonId = searchParams.get('seasonId');
  const month = searchParams.get('month'); // "2026-06" format

  const where: Record<string, unknown> = {};
  if (division) where.division = division;
  if (seasonId) where.seasonId = seasonId;
  if (month) {
    const [y, m] = month.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    where.date = { gte: start, lt: end };
  }

  try {
    const events = await db.calendarEvent.findMany({
      where,
      orderBy: [{ date: 'asc' }, { division: 'asc' }],
      include: {
        season: {
          select: { id: true, name: true, number: true, division: true, status: true },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            status: true,
            scheduledAt: true,
            weekNumber: true,
            division: true,
            _count: { select: { participations: true, teams: true } },
          },
        },
      },
    });

    return NextResponse.json({ events }, { headers });
  } catch (error) {
    console.error('[CalendarEvents] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar events' }, { status: 500 });
  }
}

// ── POST: Create a calendar event (admin only) ──
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, division, weekNumber, seasonId, title, notes, createdBy } = body;

    // Validate required fields
    if (!date || !division || !weekNumber || !seasonId) {
      return NextResponse.json(
        { error: 'Missing required fields: date, division, weekNumber, seasonId' },
        { status: 400 }
      );
    }

    if (!['male', 'female'].includes(division)) {
      return NextResponse.json(
        { error: 'Division must be "male" or "female"' },
        { status: 400 }
      );
    }

    // Check for duplicate
    const eventDate = new Date(date);
    const existing = await db.calendarEvent.findFirst({
      where: {
        date: { gte: new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate()), lt: new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate() + 1) },
        division,
        weekNumber,
        seasonId,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Calendar event already exists for this date, division, and week' },
        { status: 409 }
      );
    }

    // Auto-generate title if not provided
    const divisionLabel = division === 'male' ? 'Cowo' : 'Cewe';
    const eventTitle = title || `Tarkam ${divisionLabel} W${weekNumber}`;

    const event = await db.calendarEvent.create({
      data: {
        date: eventDate,
        division,
        weekNumber,
        seasonId,
        title: eventTitle,
        notes: notes || null,
        createdBy: createdBy || null,
      },
      include: {
        season: {
          select: { id: true, name: true, number: true, division: true, status: true },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            status: true,
            scheduledAt: true,
            weekNumber: true,
            division: true,
            _count: { select: { participations: true, teams: true } },
          },
        },
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error('[CalendarEvents] POST error:', error);
    return NextResponse.json({ error: 'Failed to create calendar event' }, { status: 500 });
  }
}

// ── PUT: Update a calendar event (admin only) ──
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, date, division, weekNumber, seasonId, title, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing event ID' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (date !== undefined) updateData.date = new Date(date);
    if (division !== undefined) updateData.division = division;
    if (weekNumber !== undefined) updateData.weekNumber = weekNumber;
    if (seasonId !== undefined) updateData.seasonId = seasonId;
    if (title !== undefined) updateData.title = title;
    if (notes !== undefined) updateData.notes = notes;

    const event = await db.calendarEvent.update({
      where: { id },
      data: updateData,
      include: {
        season: {
          select: { id: true, name: true, number: true, division: true, status: true },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            status: true,
            scheduledAt: true,
            weekNumber: true,
            division: true,
            _count: { select: { participations: true, teams: true } },
          },
        },
      },
    });

    // If there's a linked tournament and the date changed, sync tournament.scheduledAt
    if (date !== undefined && event.tournamentId && event.tournament) {
      await db.tournament.update({
        where: { id: event.tournamentId },
        data: { scheduledAt: new Date(date) },
      });
    }

    return NextResponse.json({ event });
  } catch (error) {
    console.error('[CalendarEvents] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update calendar event' }, { status: 500 });
  }
}

// ── DELETE: Delete a calendar event (admin only) ──
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing event ID' }, { status: 400 });
    }

    // Retry logic for Neon connection resilience
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await db.calendarEvent.delete({ where: { id } });
        return NextResponse.json({ success: true });
      } catch (err) {
        lastError = err;
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    }

    console.error('[CalendarEvents] DELETE error after retries:', lastError);
    return NextResponse.json({ error: 'Failed to delete calendar event' }, { status: 500 });
  } catch (error) {
    console.error('[CalendarEvents] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete calendar event' }, { status: 500 });
  }
}
