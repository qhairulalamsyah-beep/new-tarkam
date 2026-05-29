import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { recalculateAllPoints } from '@/lib/points';
import { NextResponse } from 'next/server';

// ★ Vercel serverless: heavy DB queries need more than default 10s timeout
export const maxDuration = 60;

// Force dynamic — this route is never statically rendered
export const dynamic = 'force-dynamic';

/**
 * GET /api/rankings
 * Query params:
 *   division: "male" | "female"
 *   detail: "full" — include point breakdown per player
 */
export async function GET(request: Request) {
  const headers = new Headers();
  headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  headers.set('Surrogate-Key', 'league-data');
  headers.set('Vary', 'Accept-Encoding');

  try {
  const { searchParams } = new URL(request.url);
  const division = searchParams.get('division');
  const detail = searchParams.get('detail');

  const where: Record<string, string> = {};
  if (division) where.division = division;

  const players = await db.player.findMany({
    where: { ...where, isActive: true, registrationStatus: 'approved' },
    orderBy: [{ points: 'desc' }, { totalWins: 'desc' }, { maxStreak: 'desc' }, { matches: 'asc' }],
    take: 100,
    select: {
      id: true,
      name: true,
      gamertag: true,
      division: true,
      tier: true,
      avatar: true,
      points: true,
      totalWins: true,
      totalMvp: true,
      streak: true,
      maxStreak: true,
      matches: true,
      clubMembers: {
        where: { leftAt: null },
        select: { profile: { select: { name: true } } },
        take: 1,
      },
      participations: {
        select: { status: true },
        where: { status: { in: ['approved', 'assigned'] } },
      },
    },
  });

  const rankings = players.map((p, idx) => {
    const club = (p.clubMembers as unknown as { profile: { name: string } }[])?.[0]?.profile?.name || null;

    return {
      rank: idx + 1,
      id: p.id,
      name: p.name,
      gamertag: p.gamertag,
      division: p.division,
      tier: p.tier,
      avatar: p.avatar,
      points: p.points,
      totalWins: p.totalWins,
      totalMvp: p.totalMvp,
      streak: p.streak,
      maxStreak: p.maxStreak,
      matches: p.matches,
      club,
      tournamentCount: p.participations.length,
    };
  });

  // Tier distribution summary
  const tierSummary = { S: 0, A: 0, B: 0 };
  for (const p of rankings) {
    const t = p.tier as keyof typeof tierSummary;
    if (t in tierSummary) tierSummary[t]++;
  }

  return NextResponse.json({
    rankings,
    tierSummary,
  }, { headers });
  } catch (error) {
    console.error('[GET /api/rankings]', error);
    return NextResponse.json(
      { error: 'Failed to fetch rankings' },
      { status: 500, headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10', 'Vary': 'Accept-Encoding' } }
    );
  }
}

/**
 * POST /api/rankings
 * Actions:
 *   action: "recalculate" — recalculate all points from audit trail
 *   action: "set_tier" — admin manually sets player tier (playerId + tier required)
 */
export async function POST(request: Request) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await request.json();
  const { action, division, playerId, tier } = body;

  if (action === 'recalculate') {
    const results = await recalculateAllPoints(division || undefined);
    const corrected = results.filter(r => r.diff !== 0);
    return NextResponse.json({ success: true, totalPlayers: results.length, corrected, correctionsCount: corrected.length });
  }

  if (action === 'set_tier' && playerId && tier) {
    const validTiers = ['S', 'A', 'B'];
    if (!validTiers.includes(tier)) {
      return NextResponse.json({ error: `Invalid tier. Must be one of: ${validTiers.join(', ')}` }, { status: 400 });
    }
    const player = await db.player.findUnique({ where: { id: playerId } });
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }
    const oldTier = player.tier;
    await db.player.update({ where: { id: playerId }, data: { tier } });
    return NextResponse.json({ success: true, playerId, fromTier: oldTier, toTier: tier });
  }

  if (action === 'sync_tiers') {
    // Sync player.tier from participation.tierOverride — one-time fix
    // Takes the highest tier assigned across all participations
    const participations = await db.participation.findMany({
      where: { tierOverride: { not: null } },
      select: { playerId: true, tierOverride: true },
    });

    // Group by playerId and find the highest tier
    const tierOrder = ['B', 'A', 'S'];
    const playerTierMap = new Map<string, string>();
    for (const p of participations) {
      const current = playerTierMap.get(p.playerId);
      const assigned = p.tierOverride!;
      if (!current || tierOrder.indexOf(assigned.toUpperCase()) > tierOrder.indexOf(current.toUpperCase())) {
        playerTierMap.set(p.playerId, assigned.toUpperCase());
      }
    }

    // Update each player's tier if it should be upgraded
    let updated = 0;
    for (const [playerId, newTier] of playerTierMap) {
      const player = await db.player.findUnique({ where: { id: playerId }, select: { tier: true } });
      if (player) {
        const currentIdx = tierOrder.indexOf(player.tier.toUpperCase());
        const newIdx = tierOrder.indexOf(newTier);
        if (newIdx > currentIdx) {
          await db.player.update({ where: { id: playerId }, data: { tier: newTier } });
          updated++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced tiers from participation data. ${updated} players updated.`,
      totalParticipationOverrides: participations.length,
      uniquePlayers: playerTierMap.size,
      updated,
    });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
