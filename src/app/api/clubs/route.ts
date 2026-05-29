import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { buildCacheHeaders, buildErrorCacheHeaders, CACHE_TIER_2 } from '@/lib/cache-tiers';

// Force dynamic — this route is never statically rendered
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // ★ Time-aware cache headers — Tier 2 (semi-stable): TTL adjusts based on WITA peak hours
  const headers = buildCacheHeaders(CACHE_TIER_2, 'league-data');
  headers.set('Vary', 'Accept-Encoding');

  const { searchParams } = new URL(request.url);
  const seasonId = searchParams.get('seasonId');
  const division = searchParams.get('division');
  const unified = searchParams.get('unified') === 'true';

  // ── Unified mode: return ALL clubs from ALL active seasons, deduplicated by name ──
  if (unified) {
    try {
      // Get active season IDs for filtering
      const activeSeasons = await db.season.findMany({
        where: { status: { in: ['active', 'completed'] } },
        select: { id: true, division: true, status: true },
      });

      const activeSeasonIds = new Set(activeSeasons.map(s => s.id));

      const clubProfiles = await db.clubProfile.findMany({
        include: {
          members: true,
          seasonEntries: true,
        },
        orderBy: { name: 'asc' },
      });

      const result = clubProfiles.map(profile => {
        const seasonEntries = profile.seasonEntries.filter(e => activeSeasonIds.has(e.seasonId));

        let totalWins = 0, totalLosses = 0, totalPoints = 0, totalGameDiff = 0;
        for (const entry of seasonEntries) {
          totalWins += entry.wins;
          totalLosses += entry.losses;
          totalPoints += entry.points;
          totalGameDiff += entry.gameDiff;
        }

        const activeMembers = profile.members.filter(m => m.leftAt === null);

        return {
          id: profile.id,
          name: profile.name,
          logo: profile.logo,
          bannerImage: profile.bannerImage,
          wins: totalWins,
          losses: totalLosses,
          points: totalPoints,
          gameDiff: totalGameDiff,
          memberCount: activeMembers.length,
          seasonRecords: seasonEntries.map(e => ({
            id: e.id,
            seasonId: e.seasonId,
            division: e.division,
            memberCount: activeMembers.length,
          })),
        };
      });

      return NextResponse.json(result, { headers });
    } catch (error) {
      console.error('[GET /api/clubs] Unified error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch unified clubs' },
        { status: 500, headers: Object.fromEntries(buildErrorCacheHeaders().entries()) }
      );
    }
  }

  // ── Original mode: filter by seasonId or division ──
  try {
    const where: Record<string, unknown> = {};
    if (seasonId) where.seasonId = seasonId;
    if (division) where.division = division;

    const clubs = await db.club.findMany({
      where,
      include: {
        profile: { select: { name: true, logo: true, bannerImage: true } },
        season: { select: { name: true, division: true } },
      },
      orderBy: { points: 'desc' },
    });

    // Sort by points desc, gameDiff desc (secondary sort)
    const sorted = clubs
      .sort((a, b) => {
        const pointsDiff = b.points - a.points;
        if (pointsDiff !== 0) return pointsDiff;
        return b.gameDiff - a.gameDiff;
      })
      .map(club => ({
        ...club,
        profile: club.profile,
        season: club.season,
      }));

    return NextResponse.json(sorted, { headers });
  } catch (error) {
    console.error('[GET /api/clubs] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clubs' },
      { status: 500, headers: Object.fromEntries(buildErrorCacheHeaders().entries()) }
    );
  }
}

export async function POST(request: Request) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await request.json();
  const { name, logo, seasonId } = body;

  if (!name) {
    return NextResponse.json({ error: 'Club name is required' }, { status: 400 });
  }

  try {
    // ── Find or create the persistent ClubProfile ──
    let profile = await db.clubProfile.findUnique({
      where: { name },
    });

    if (!profile) {
      profile = await db.clubProfile.create({
        data: { name, logo: logo || null },
      });
      console.log(`[POST /api/clubs] Created ClubProfile for "${name}"`);
    } else if (logo && !profile.logo) {
      // Update logo if provided and profile doesn't have one
      profile = await db.clubProfile.update({
        where: { id: profile.id },
        data: { logo },
      });
    }

    // ── Create Club season entries in ALL active seasons (both male & female) ──
    const activeSeasons = await db.season.findMany({
      where: { status: { in: ['active', 'completed'] } },
      select: { id: true, division: true },
    });

    const createdClubs: Array<{
      id: string;
      profileId: string;
      division: string;
      seasonId: string;
      wins: number;
      losses: number;
      points: number;
      gameDiff: number;
    }> = [];

    for (const season of activeSeasons) {
      // Check if club already exists in this season
      const existing = await db.club.findUnique({
        where: {
          profileId_seasonId_division: {
            profileId: profile.id,
            seasonId: season.id,
            division: season.division,
          },
        },
      });

      if (existing) {
        createdClubs.push(existing);
        continue;
      }

      const club = await db.club.create({
        data: {
          profileId: profile.id,
          division: season.division,
          seasonId: season.id,
        },
      });

      createdClubs.push(club);
      console.log(`[POST /api/clubs] Created "${name}" entry in ${season.division} season (${season.id})`);
    }

    // Invalidate cache
    revalidatePath('/');
    revalidatePath('/api/stats');
    revalidateTag('cms-content', 'max');
    revalidateTag('landing-stats', 'max');

    // ★ Pusher: notify all clients of new club
    try {
      const { pusherTrigger, PUSHER_CHANNELS, PUSHER_EVENTS } = await import('@/lib/pusher');
      void pusherTrigger(PUSHER_CHANNELS.LEADERBOARD, PUSHER_EVENTS.LEADERBOARD_UPDATED, {});
      void pusherTrigger(PUSHER_CHANNELS.FEED, PUSHER_EVENTS.CLUB_MEMBER_CHANGED, {
        type: 'club-created',
      });
    } catch { /* non-critical */ }

    const primaryClub = createdClubs[0];

    await createAuditLog({
      adminId: authResult.id,
      adminName: authResult.username,
      action: 'create',
      entity: 'club',
      entityId: primaryClub?.id,
      details: `Membuat club "${name}"`,
    });

    return NextResponse.json(primaryClub, { status: 201 });
  } catch (error) {
    console.error('[POST /api/clubs] Error:', error);
    return NextResponse.json({ error: 'Failed to create club' }, { status: 500 });
  }
}
