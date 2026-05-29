import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { buildCacheHeaders, CACHE_TIER_1 } from '@/lib/cache-tiers';

export async function GET(request: Request) {
  // ★ Time-aware cache headers — Tier 1 (stable): TTL adjusts based on WITA peak hours
  const headers = buildCacheHeaders(CACHE_TIER_1, 'league-data');
  headers.set('Vary', 'Accept-Encoding');

  const { searchParams } = new URL(request.url);
  const division = searchParams.get('division');

  try {
    const where: Prisma.SeasonWhereInput = {};
    if (division) where.division = division;

    const seasons = await db.season.findMany({
      where,
      include: {
        _count: {
          select: {
            tournaments: true,
            clubs: true,
          },
        },
      },
      orderBy: { number: 'desc' },
    });

    return NextResponse.json(seasons, { headers });
  } catch (error) {
    console.error('[GET /api/seasons] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch seasons' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await request.json();
  const { name, number, division, startDate, endDate } = body;

  if (!name || !number || !division) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    // Validate: only 1 active season per division at a time
    const existingActive = await db.season.findFirst({
      where: { division, status: 'active' },
      select: { id: true, name: true },
    });

    if (existingActive) {
      return NextResponse.json({
        error: `Sudah ada season aktif untuk divisi "${division}" (${existingActive.name}). Tutup season yang aktif terlebih dahulu sebelum membuat season baru.`,
      }, { status: 400 });
    }

    const season = await db.season.create({
      data: {
        name,
        number,
        division,
        status: 'active',
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    await createAuditLog({
      adminId: authResult.id,
      adminName: authResult.username,
      action: 'create',
      entity: 'season',
      entityId: season.id,
      details: `Membuat season "${season.name}"`,
    });

    return NextResponse.json(season, { status: 201 });
  } catch (error) {
    console.error('[POST /api/seasons] Error:', error);
    return NextResponse.json({ error: 'Failed to create season' }, { status: 500 });
  }
}
