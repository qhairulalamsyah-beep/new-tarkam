import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { buildCacheHeaders, buildErrorCacheHeaders, CACHE_TIER_1 } from '@/lib/cache-tiers';

/**
 * GET /api/skins
 * List all available skins (public, no auth needed)
 * Returns all active skins ordered by priority desc
 */
export async function GET() {
  // ★ Time-aware cache headers — Tier 1 (stable): TTL adjusts based on WITA peak hours
  const headers = buildCacheHeaders(CACHE_TIER_1, 'skins-data');

  try {
    const skins = await db.skin.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    return NextResponse.json({
      count: skins.length,
      skins: skins.map(skin => ({
        id: skin.id,
        type: skin.type,
        displayName: skin.displayName,
        description: skin.description,
        icon: skin.icon,
        colorClass: JSON.parse(skin.colorClass),
        priority: skin.priority,
        duration: skin.duration,
        isActive: skin.isActive,
      })),
    }, { headers });
  } catch (error) {
    console.error('List skins error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch skins' },
      { headers: Object.fromEntries(buildErrorCacheHeaders().entries()), status: 500 }
    );
  }
}

/**
 * POST /api/skins
 * Create a new skin (admin auth required)
 * Body: { type, displayName, description, icon, colorClass, priority?, duration?, isActive? }
 */
export async function POST(request: Request) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { type, displayName, description, icon, colorClass, priority, duration, isActive } = body;

    if (!type || !displayName || !icon) {
      return NextResponse.json(
        { error: 'type, displayName, and icon are required' },
        { status: 400 }
      );
    }

    const skin = await db.skin.create({
      data: {
        type,
        displayName,
        description: description || '',
        icon,
        colorClass: typeof colorClass === 'string' ? colorClass : JSON.stringify(colorClass || {}),
        priority: priority ?? 0,
        duration: duration || 'permanent',
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json({
      success: true,
      skin: {
        ...skin,
        colorClass: JSON.parse(skin.colorClass),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Create skin error:', error);
    return NextResponse.json(
      { error: 'Failed to create skin' },
      { status: 500 }
    );
  }
}
