import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';

// GET - List banners by placement
export async function GET(request: NextRequest) {
  const headers = new Headers();
  headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  headers.set('Surrogate-Key', 'league-data');

  try {
    const { searchParams } = new URL(request.url);
    const placement = searchParams.get('placement');
    const activeOnly = searchParams.get('active') === 'true';

    const where: any = {};
    if (placement) where.placement = placement;
    if (activeOnly) {
      where.isActive = true;
      const now = new Date();
      where.AND = [
        { OR: [
          { startDate: null, endDate: null },
          { startDate: null, endDate: { gte: now } },
          { startDate: { lte: now }, endDate: null },
          { startDate: { lte: now }, endDate: { gte: now } },
        ] },
      ];
    }

    const banners = await db.sponsorBanner.findMany({
      where,
      include: {
        sponsor: {
          select: { id: true, name: true, logo: true },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ banners }, { headers });
  } catch (error) {
    console.error('Error fetching banners:', error);
    return NextResponse.json({ error: 'Failed to fetch banners' }, { headers,  status: 500 });
  }
}

// POST - Create new banner
export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;

    const body = await request.json();
    const { sponsorId, placement, imageUrl, linkUrl, width, height, displayOrder, startDate, endDate } = body;

    if (!sponsorId || !placement || !imageUrl) {
      return NextResponse.json({ error: 'sponsorId, placement, and imageUrl are required' }, { status: 400 });
    }

    // Use separate create + include calls for complex relations
    const banner = await db.sponsorBanner.create({
      data: {
        sponsorId,
        placement,
        imageUrl,
        linkUrl: linkUrl || null,
        width: width || null,
        height: height || null,
        displayOrder: displayOrder || 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    // Fetch with sponsor relation separately
    const bannerWithSponsor = await db.sponsorBanner.findUnique({
      where: { id: banner.id },
      include: {
        sponsor: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ banner: bannerWithSponsor });
  } catch (error) {
    console.error('Error creating banner:', error);
    return NextResponse.json({ error: 'Failed to create banner' }, { status: 500 });
  }
}

// PUT - Update banner (toggle active, etc.)
export async function PUT(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Banner ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { isActive, displayOrder, linkUrl, startDate, endDate } = body;

    const banner = await db.sponsorBanner.update({
      where: { id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(displayOrder !== undefined && { displayOrder }),
        ...(linkUrl !== undefined && { linkUrl: linkUrl || null }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      },
    });

    // Fetch with sponsor relation separately
    const bannerWithSponsor = await db.sponsorBanner.findUnique({
      where: { id },
      include: {
        sponsor: { select: { id: true, name: true, logo: true } },
      },
    });

    return NextResponse.json({ banner: bannerWithSponsor });
  } catch (error) {
    console.error('Error updating banner:', error);
    return NextResponse.json({ error: 'Failed to update banner' }, { status: 500 });
  }
}

// DELETE - Delete banner by id
export async function DELETE(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Banner ID is required' }, { status: 400 });
    }

    // Retry for Neon PostgreSQL connection drops
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await db.sponsorBanner.delete({ where: { id } });
        return NextResponse.json({ success: true });
      } catch (err: unknown) {
        lastError = err;
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('Closed') || errMsg.includes('Timed out') || errMsg.includes('ECONNRESET') || errMsg.includes('Connection')) {
          console.warn(`[banners DELETE] Retry ${attempt}/3 — connection error: ${errMsg}`);
          if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  } catch (error) {
    console.error('Error deleting banner:', error);
    return NextResponse.json({ error: 'Failed to delete banner' }, { status: 500 });
  }
}
