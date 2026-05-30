import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

// POST /api/predictions/resolve — Resolve predictions for completed matches
// Can be called by admin or cron
// Body: { matchId?: string } — resolve specific match, or all unresolved completed matches
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;

    const body = await request.json();
    const { matchId } = body;

    // Find completed matches with unresolved predictions
    const completedMatches = await db.match.findMany({
      where: {
        status: 'completed',
        winnerId: { not: null },
        ...(matchId ? { id: matchId } : {}),
      },
      include: {
        predictions: {
          where: { isCorrect: null }, // Only unresolved predictions
        },
      },
    });

    let totalResolved = 0;
    let totalCorrect = 0;
    const achievementAwards: Array<{
      playerId: string;
      gamertag: string;
      correctCount: number;
      badge: string;
    }> = [];

    for (const match of completedMatches) {
      if (!match.winnerId) continue;

      for (const prediction of match.predictions) {
        const isCorrect = prediction.predictedWinnerId === match.winnerId;
        const pointsEarned = isCorrect ? 10 : 0;

        // Update the prediction
        await db.prediction.update({
          where: { id: prediction.id },
          data: {
            isCorrect,
            pointsEarned,
          },
        });

        totalResolved++;
        if (isCorrect) totalCorrect++;

        // Check prediction achievement badges for this user
        if (isCorrect) {
          const totalCorrectForUser = await db.prediction.count({
            where: {
              accountId: prediction.accountId,
              isCorrect: true,
            },
          });

          // 🎯 5 correct = "Ramalan Awal" badge
          if (totalCorrectForUser === 5) {
            await awardPredictionBadge(prediction.accountId, 'ramalan_awal', 5);
            const account = await db.account.findUnique({
              where: { id: prediction.accountId },
              include: { player: { select: { id: true, gamertag: true } } },
            });
            if (account) {
              achievementAwards.push({
                playerId: account.playerId,
                gamertag: account.player.gamertag,
                correctCount: 5,
                badge: '🎯 Ramalan Awal',
              });
            }
          }

          // 🔮 10 correct = "Dukun Tarkam" badge
          if (totalCorrectForUser === 10) {
            await awardPredictionBadge(prediction.accountId, 'dukun_tarkam', 10);
            const account = await db.account.findUnique({
              where: { id: prediction.accountId },
              include: { player: { select: { id: true, gamertag: true } } },
            });
            if (account) {
              achievementAwards.push({
                playerId: account.playerId,
                gamertag: account.player.gamertag,
                correctCount: 10,
                badge: '🔮 Dukun Tarkam',
              });
            }
          }

          // ⭐ 25 correct = "Oracle" badge
          if (totalCorrectForUser === 25) {
            await awardPredictionBadge(prediction.accountId, 'oracle', 25);
            const account = await db.account.findUnique({
              where: { id: prediction.accountId },
              include: { player: { select: { id: true, gamertag: true } } },
            });
            if (account) {
              achievementAwards.push({
                playerId: account.playerId,
                gamertag: account.player.gamertag,
                correctCount: 25,
                badge: '⭐ Oracle',
              });
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      resolved: totalResolved,
      correct: totalCorrect,
      achievementAwards,
    });
  } catch (error) {
    console.error('Resolve predictions error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

/**
 * Award a prediction achievement badge to a player
 */
async function awardPredictionBadge(
  accountId: string,
  achievementName: string,
  correctCount: number
) {
  try {
    // Get the account's player
    const account = await db.account.findUnique({
      where: { id: accountId },
      select: { playerId: true },
    });
    if (!account) return;

    // Find or create the achievement
    let achievement = await db.achievement.findUnique({
      where: { name: achievementName },
    });

    if (!achievement) {
      const badgeConfig: Record<string, {
        displayName: string;
        description: string;
        tier: string;
        icon: string;
      }> = {
        ramalan_awal: {
          displayName: 'Ramalan Awal',
          description: `Menebak dengan benar ${correctCount} pertandingan`,
          tier: 'bronze',
          icon: '🎯',
        },
        dukun_tarkam: {
          displayName: 'Dukun Tarkam',
          description: `Menebak dengan benar ${correctCount} pertandingan`,
          tier: 'silver',
          icon: '🔮',
        },
        oracle: {
          displayName: 'Oracle',
          description: `Menebak dengan benar ${correctCount} pertandingan`,
          tier: 'gold',
          icon: '⭐',
        },
      };

      const config = badgeConfig[achievementName];
      if (!config) return;

      achievement = await db.achievement.create({
        data: {
          name: achievementName,
          displayName: config.displayName,
          description: config.description,
          category: 'prediction',
          icon: config.icon,
          tier: config.tier,
          criteria: JSON.stringify({ type: 'prediction_correct', count: correctCount }),
          rewardPoints: 0,
        },
      });
    }

    // Check if player already has this achievement
    const existing = await db.playerAchievement.findUnique({
      where: {
        playerId_achievementId: {
          playerId: account.playerId,
          achievementId: achievement.id,
        },
      },
    });

    if (!existing) {
      await db.playerAchievement.create({
        data: {
          playerId: account.playerId,
          achievementId: achievement.id,
          context: JSON.stringify({ correctPredictions: correctCount }),
        },
      });

      // Create notification for the user
      await db.notification.create({
        data: {
          type: 'prediction',
          title: 'Badge Prediksi Baru! 🏆',
          body: `Kamu mendapatkan badge "${achievement.displayName}" — ${achievement.description}`,
          accountId,
          icon: achievement.icon,
        },
      });
    }
  } catch (err) {
    console.error('Award prediction badge error:', err);
  }
}
