import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// Force dynamic
export const dynamic = 'force-dynamic';

// ── POST: Batch create calendar events for a month ──
// Body: { seasonId, events: [{ date, division, weekNumber, title?, notes? }] }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { seasonId, events, createdBy } = body as {
      seasonId?: string;
      events?: Array<{ date: string; division: string; weekNumber: number; title?: string; notes?: string }>;
      createdBy?: string;
    };

    if (!seasonId || !events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: seasonId, events[]' },
        { status: 400 }
      );
    }

    // Validate season exists
    const season = await db.season.findUnique({ where: { id: seasonId } });
    if (!season) {
      return NextResponse.json({ error: 'Season not found' }, { status: 404 });
    }

    const created: Array<{ id: string; date: Date; division: string; weekNumber: number; title: string | null }> = [];
    const skipped: Array<{ date?: string; division?: string; weekNumber?: number; reason: string }> = [];

    for (const evt of events) {
      if (!evt.date || !evt.division || !evt.weekNumber) {
        skipped.push({ ...evt, reason: 'Missing required fields' });
        continue;
      }

      if (!['male', 'female'].includes(evt.division)) {
        skipped.push({ ...evt, reason: 'Invalid division' });
        continue;
      }

      const eventDate = new Date(evt.date);

      // Check for duplicate
      const existing = await db.calendarEvent.findFirst({
        where: {
          date: {
            gte: new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate()),
            lt: new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate() + 1),
          },
          division: evt.division,
          weekNumber: evt.weekNumber,
          seasonId,
        },
      });

      if (existing) {
        skipped.push({ ...evt, reason: 'Already exists' });
        continue;
      }

      const divisionLabel = evt.division === 'male' ? 'Cowo' : 'Cewe';
      const title = evt.title || `Tarkam ${divisionLabel} W${evt.weekNumber}`;

      const newEvent = await db.calendarEvent.create({
        data: {
          date: eventDate,
          division: evt.division,
          weekNumber: evt.weekNumber,
          seasonId,
          title,
          notes: evt.notes || null,
          createdBy: createdBy || null,
        },
        select: {
          id: true,
          date: true,
          division: true,
          weekNumber: true,
          title: true,
        },
      });

      created.push(newEvent);
    }

    return NextResponse.json({
      created: created.length,
      skipped: skipped.length,
      createdEvents: created,
      skippedEvents: skipped,
    }, { status: 201 });
  } catch (error) {
    console.error('[CalendarEvents/Batch] POST error:', error);
    return NextResponse.json({ error: 'Failed to batch create calendar events' }, { status: 500 });
  }
}
