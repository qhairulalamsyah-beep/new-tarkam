import { NextResponse } from 'next/server';
import { requirePlayer } from '@/lib/api-auth';
import { db } from '@/lib/db';

// GET /api/referrals/stats — Get referral stats for current user
export async function GET(request: Request) {
  const player = await requirePlayer(request);
  if (player instanceof NextResponse) return player;

  try {
    const referralCode = await db.referralCode.findUnique({
      where: { accountId: player.id },
      include: {
        referrals: {
          orderBy: { createdAt: 'desc' },
          include: {
            referredAccount: {
              select: {
                id: true,
                player: {
                  select: { gamertag: true, avatar: true, division: true, tier: true },
                },
              },
            },
          },
        },
      },
    });

    if (!referralCode) {
      return NextResponse.json({
        code: null,
        stats: {
          total: 0,
          registered: 0,
          pending: 0,
          rewarded: 0,
          pointsEarned: 0,
        },
        referrals: [],
        currentTier: null,
        nextTier: { name: 'Networker', required: 3, current: 0 },
      });
    }

    const total = referralCode.referrals.length;
    const registered = referralCode.referrals.filter(r => r.status === 'registered' || r.status === 'rewarded').length;
    const pending = referralCode.referrals.filter(r => r.status === 'pending').length;
    const rewarded = referralCode.referrals.filter(r => r.status === 'rewarded').length;
    const pointsEarned = referralCode.referrals.reduce((sum, r) => sum + r.rewardPoints, 0);

    // Reward tiers
    const tiers = [
      { name: 'Starter', required: 1, points: 50, badge: null },
      { name: 'Networker', required: 3, points: 150, badge: 'Networker' },
      { name: 'Influencer', required: 5, points: 300, badge: 'Influencer' },
      { name: 'Legend', required: 10, points: 500, badge: 'Legend' },
    ];

    // Find current tier
    let currentTier = tiers[0];
    let nextTier = tiers[1];
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (registered >= tiers[i].required) {
        currentTier = tiers[i];
        nextTier = i < tiers.length - 1 ? tiers[i + 1] : null;
        break;
      }
    }

    // Calculate milestone bonus points earned
    let milestonePoints = 0;
    if (registered >= 3) milestonePoints += 100;
    if (registered >= 5) milestonePoints += 150;
    if (registered >= 10) milestonePoints += 250;

    // Format referral list (anonymize if not yet registered)
    const referralList = referralCode.referrals.map(r => ({
      id: r.id,
      status: r.status,
      rewardPoints: r.rewardPoints,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
      referredUser: r.referredAccount
        ? {
            gamertag: r.referredAccount.player.gamertag,
            avatar: r.referredAccount.player.avatar,
            division: r.referredAccount.player.division,
            tier: r.referredAccount.player.tier,
          }
        : null,
      referredEmail: r.referredEmail
        ? r.referredEmail.substring(0, 3) + '***' // Anonymize
        : null,
    }));

    return NextResponse.json({
      code: referralCode.code,
      uses: referralCode.uses,
      maxUses: referralCode.maxUses,
      createdAt: referralCode.createdAt,
      stats: {
        total,
        registered,
        pending,
        rewarded,
        pointsEarned,
        milestonePoints,
      },
      referrals: referralList,
      currentTier,
      nextTier,
      tiers,
    });
  } catch (error) {
    console.error('[referrals/stats] GET error:', error);
    return NextResponse.json({ error: 'Gagal mengambil statistik referral' }, { status: 500 });
  }
}
