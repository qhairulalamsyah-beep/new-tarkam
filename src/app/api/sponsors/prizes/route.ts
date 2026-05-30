import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';

// GET - List sponsored prizes with optional filters
export async function GET(request: NextRequest) {
  const headers = new Headers();
  headers.set('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=15');
  headers.set('Surrogate-Key', 'league-data');

  try {
    const { searchParams } = new URL(request.url);
    const sponsorId = searchParams.get('sponsorId');
    const tournamentId = searchParams.get('tournamentId');
    const activeOnly = searchParams.get('active') === 'true';

    const where: Record<string, unknown> = {};
    if (sponsorId) where.sponsorId = sponsorId;
    if (tournamentId) where.tournamentId = tournamentId;
    if (activeOnly) where.isActive = true;

    const prizes = await db.sponsoredPrize.findMany({
      where,
      include: {
        sponsor: { select: { id: true, name: true, logo: true, tier: true } },
        tournament: { select: { id: true, name: true, weekNumber: true, division: true } },
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ prizes }, { headers });
  } catch (error) {
    console.error('Error fetching sponsored prizes:', error);
    return NextResponse.json({ error: 'Failed to fetch sponsored prizes' }, { headers, status: 500 });
  }
}

// POST - Create new sponsored prize
export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;

    const body = await request.json();
    const { sponsorId, tournamentId, name, description, prizeType, value, quantity, position, imageUrl, isActive } = body;

    if (!sponsorId || !tournamentId || !name) {
      return NextResponse.json({ error: 'sponsorId, tournamentId, and name are required' }, { status: 400 });
    }

    // Use separate create + include calls for complex relations
    const prize = await db.sponsoredPrize.create({
      data: {
        sponsorId,
        tournamentId,
        name,
        description,
        prizeType: prizeType || 'voucher',
        value: value || 0,
        quantity: quantity || 1,
        position,
        imageUrl,
        isActive: isActive !== false,
      },
    });

    // Fetch with relations separately
    const prizeWithRelations = await db.sponsoredPrize.findUnique({
      where: { id: prize.id },
      include: {
        sponsor: { select: { id: true, name: true, logo: true, tier: true } },
        tournament: { select: { id: true, name: true, weekNumber: true, division: true } },
      },
    });

    return NextResponse.json({ prize: prizeWithRelations });
  } catch (error) {
    console.error('Error creating sponsored prize:', error);
    return NextResponse.json({ error: 'Failed to create sponsored prize' }, { status: 500 });
  }
}

// DELETE - Delete sponsored prize by id
export async function DELETE(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Prize ID is required' }, { status: 400 });
    }

    // Retry for Neon PostgreSQL connection drops
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await db.sponsoredPrize.delete({ where: { id } });
        return NextResponse.json({ success: true });
      } catch (err: unknown) {
        lastError = err;
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('Closed') || errMsg.includes('Timed out') || errMsg.includes('ECONNRESET') || errMsg.includes('Connection')) {
          console.warn(`[prizes DELETE] Retry ${attempt}/3 — connection error: ${errMsg}`);
          if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  } catch (error) {
    console.error('Error deleting sponsored prize:', error);
    return NextResponse.json({ error: 'Failed to delete sponsored prize' }, { status: 500 });
  }
}
