import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { buildCacheHeaders, buildErrorCacheHeaders, CACHE_TIER_1 } from '@/lib/cache-tiers';

/**
 * GET /api/skins/holders
 * List all awarded skins with player info (admin auth required)
 * Returns all PlayerSkin records with account + player details
 */
export async function GET(request: Request) {
  // ★ Time-aware cache headers — Tier 1 (stable): TTL adjusts based on WITA peak hours
  const headers = buildCacheHeaders(CACHE_TIER_1, 'skins-data');

  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const playerSkins = await db.playerSkin.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        skin: {
          select: {
            id: true,
            type: true,
            displayName: true,
            icon: true,
            colorClass: true,
            priority: true,
            duration: true,
          },
        },
        account: {
          select: {
            id: true,
            donorBadgeCount: true,
            player: {
              select: {
                id: true,
                gamertag: true,
                name: true,
                division: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    // Filter out expired skins (but show recently expired ones too for admin visibility)
    const now = new Date();
    const holders = playerSkins.map((ps) => {
      const isExpired = ps.expiresAt ? new Date(ps.expiresAt) < now : false;
      return {
        id: ps.id,
        accountId: ps.accountId,
        skinId: ps.skinId,
        skinType: ps.skin.type,
        displayName: ps.skin.displayName,
        icon: ps.skin.icon,
        colorClass: JSON.parse(ps.skin.colorClass),
        priority: ps.skin.priority,
        duration: ps.skin.duration,
        reason: ps.reason,
        expiresAt: ps.expiresAt,
        isExpired,
        awardedBy: ps.awardedBy,
        createdAt: ps.createdAt,
        donorBadgeCount: ps.skin.type === 'donor' ? ps.account.donorBadgeCount : undefined,
        player: {
          id: ps.account.player.id,
          gamertag: ps.account.player.gamertag,
          name: ps.account.player.name,
          division: ps.account.player.division,
          avatar: ps.account.player.avatar,
        },
      };
    });

    return NextResponse.json({
      count: holders.length,
      activeCount: holders.filter((h) => !h.isExpired).length,
      holders,
    }, { headers });
  } catch (error) {
    console.error('List skin holders error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch skin holders' },
      { headers: Object.fromEntries(buildErrorCacheHeaders().entries()), status: 500 }
    );
  }
}
