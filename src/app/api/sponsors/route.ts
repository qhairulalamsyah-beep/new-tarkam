import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { buildCacheHeaders, buildErrorCacheHeaders, CACHE_TIER_1 } from '@/lib/cache-tiers';

// Force dynamic — this route is never statically rendered
export const dynamic = 'force-dynamic';

// GET - List all sponsors
export async function GET(request: NextRequest) {
  // ★ Time-aware cache headers — Tier 1 (stable): TTL adjusts based on WITA peak hours
  const headers = buildCacheHeaders(CACHE_TIER_1, 'sponsors-data');
  headers.set('Vary', 'Accept-Encoding');

  try {
    const { searchParams } = new URL(request.url);
    const tier = searchParams.get('tier');
    const activeOnly = searchParams.get('active') === 'true';

    const where: Record<string, unknown> = {};
    if (tier) where.tier = tier;
    if (activeOnly) where.isActive = true;

    const sponsors = await db.sponsor.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            tournamentSponsors: true,
            sponsoredPrizes: true,
            banners: true,
          },
        },
      },
    });

    return NextResponse.json({ sponsors }, { headers });
  } catch (error) {
    console.error('Error fetching sponsors:', error);
    return NextResponse.json({ error: 'Failed to fetch sponsors' }, {
      headers: Object.fromEntries(buildErrorCacheHeaders().entries()),
      status: 500
    });
  }
}

// POST - Create new sponsor
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  try {
    const body = await request.json();
    const { name, logo, website, description, tier } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const sponsor = await db.sponsor.create({
      data: {
        name,
        logo,
        website,
        description,
        tier: tier || 'bronze',
      },
    });

    return NextResponse.json({ sponsor });
  } catch (error) {
    console.error('Error creating sponsor:', error);
    return NextResponse.json({ error: 'Failed to create sponsor' }, { status: 500 });
  }
}

// PUT - Update sponsor
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Sponsor ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { name, logo, website, description, tier, isActive } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (logo !== undefined) updateData.logo = logo;
    if (website !== undefined) updateData.website = website;
    if (description !== undefined) updateData.description = description;
    if (tier !== undefined) updateData.tier = tier;
    if (isActive !== undefined) updateData.isActive = isActive;

    const sponsor = await db.sponsor.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ sponsor });
  } catch (error) {
    console.error('Error updating sponsor:', error);
    return NextResponse.json({ error: 'Failed to update sponsor' }, { status: 500 });
  }
}

// DELETE - Delete sponsor
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Sponsor ID is required' }, { status: 400 });
    }

    // Delete related records first
    await db.sponsorBanner.deleteMany({ where: { sponsorId: id } });
    await db.sponsoredPrize.deleteMany({ where: { sponsorId: id } });
    await db.tournamentSponsor.deleteMany({ where: { sponsorId: id } });

    // Then delete the sponsor
    await db.sponsor.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting sponsor:', error);
    return NextResponse.json({ error: 'Failed to delete sponsor' }, { status: 500 });
  }
}
