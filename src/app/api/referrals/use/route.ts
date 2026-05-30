import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/referrals/use — Use a referral code during registration
// No auth required — called during registration before account exists
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, referredAccountId, referredEmail } = body;

    if (!code) {
      return NextResponse.json({ error: 'Kode referral diperlukan' }, { status: 400 });
    }

    // Find the referral code
    const referralCode = await db.referralCode.findUnique({
      where: { code },
      include: { account: { include: { player: { select: { gamertag: true } } } } },
    });

    if (!referralCode) {
      return NextResponse.json({ error: 'Kode referral tidak valid' }, { status: 404 });
    }

    // Check if code has remaining uses
    if (referralCode.uses >= referralCode.maxUses) {
      return NextResponse.json({ error: 'Kode referral sudah mencapai batas penggunaan' }, { status: 400 });
    }

    // Prevent self-referral
    if (referredAccountId && referredAccountId === referralCode.accountId) {
      return NextResponse.json({ error: 'Tidak bisa menggunakan kode referral sendiri' }, { status: 400 });
    }

    // Check if this account was already referred
    if (referredAccountId) {
      const existingReferral = await db.referral.findFirst({
        where: { referredAccountId },
      });
      if (existingReferral) {
        return NextResponse.json({ error: 'Akun ini sudah menggunakan kode referral sebelumnya' }, { status: 400 });
      }
    }

    // Create referral record
    const referral = await db.referral.create({
      data: {
        referrerCodeId: referralCode.id,
        referredAccountId: referredAccountId || null,
        referredEmail: referredEmail || null,
        status: referredAccountId ? 'registered' : 'pending',
      },
    });

    // Increment uses on the referral code
    await db.referralCode.update({
      where: { id: referralCode.id },
      data: { uses: { increment: 1 } },
    });

    // If the referred account exists, award points to the referrer
    if (referredAccountId && referralCode.accountId) {
      // Calculate reward points based on total successful referrals
      const totalSuccessfulReferrals = await db.referral.count({
        where: {
          referrerCodeId: referralCode.id,
          status: { in: ['registered', 'rewarded'] },
        },
      });

      // Reward tier logic
      let rewardPoints = 50; // Base reward per referral
      const referrerAccountId = referralCode.accountId;
      const referrerPlayerId = referralCode.account.playerId;

      // Award points to the referrer
      await db.$transaction([
        db.referral.update({
          where: { id: referral.id },
          data: { rewardPoints, status: 'rewarded', completedAt: new Date() },
        }),
        // Add points to the player
        db.player.update({
          where: { id: referrerPlayerId },
          data: { points: { increment: rewardPoints } },
        }),
        // Record the point transaction
        db.playerPoint.create({
          data: {
            playerId: referrerPlayerId,
            amount: rewardPoints,
            reason: 'referral_reward',
            description: `Bonus referral: ${referralCode.account.player.gamertag} mengajak teman bergabung`,
          },
        }),
      ]);

      // Check for tier milestones
      if (totalSuccessfulReferrals + 1 === 3 || totalSuccessfulReferrals + 1 === 5 || totalSuccessfulReferrals + 1 === 10) {
        let bonusPoints = 0;
        let badgeName = '';
        if (totalSuccessfulReferrals + 1 === 3) {
          bonusPoints = 100; // Extra 100 on top of the 3x50 = 150, total 150 + 100 = 250
          badgeName = 'Networker';
        } else if (totalSuccessfulReferrals + 1 === 5) {
          bonusPoints = 150; // Extra 150 on top of the 5x50 = 250, total 250 + 150 = 400
          badgeName = 'Influencer';
        } else if (totalSuccessfulReferrals + 1 === 10) {
          bonusPoints = 250; // Extra 250 on top of the 10x50 = 500, total 500 + 250 = 750
          badgeName = 'Legend';
        }

        if (bonusPoints > 0) {
          await db.$transaction([
            db.player.update({
              where: { id: referrerPlayerId },
              data: { points: { increment: bonusPoints } },
            }),
            db.playerPoint.create({
              data: {
                playerId: referrerPlayerId,
                amount: bonusPoints,
                reason: 'referral_milestone',
                description: `Bonus milestone referral ${badgeName}: ${totalSuccessfulReferrals + 1} teman diajak`,
              },
            }),
          ]);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: referredAccountId
        ? 'Kode referral berhasil digunakan! Referrer mendapat bonus poin.'
        : 'Kode referral tercatat. Bonus akan diberikan setelah registrasi selesai.',
      referral: {
        id: referral.id,
        status: referral.status,
        referrer: referralCode.account.player.gamertag,
      },
    });
  } catch (error) {
    console.error('[referrals/use] POST error:', error);
    return NextResponse.json({ error: 'Gagal menggunakan kode referral' }, { status: 500 });
  }
}
