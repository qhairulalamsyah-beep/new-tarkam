import { db } from '@/lib/db';
import { requireAdmin, verifyPlayer } from '@/lib/api-auth';
import { createAuditLog, createPlayerAuditLog } from '@/lib/audit';
import { pusherTrigger, PUSHER_CHANNELS, PUSHER_EVENTS } from '@/lib/pusher';
import { NextResponse } from 'next/server';
import { revalidateTag, revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';

// POST /api/donations — Submit a new donation (status: pending by default)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { donorName, amount, message, type, division, tournamentId, seasonId } = body;

    // Validate required fields
    if (!donorName || typeof donorName !== 'string' || !donorName.trim()) {
      return NextResponse.json({ error: 'Nama donatur wajib diisi' }, { status: 400 });
    }

    if (!amount || typeof amount !== 'number' || amount < 1000) {
      return NextResponse.json({ error: 'Jumlah minimal Rp 1.000' }, { status: 400 });
    }

    if (amount > 100_000_000) {
      return NextResponse.json({ error: 'Jumlah maksimal Rp 100.000.000' }, { status: 400 });
    }

    const donationType = type === 'season' ? 'season' : 'weekly';
    const donationDivision = division === 'female' ? 'female' : 'male';

    // Find active season for THIS division if not provided
    let resolvedSeasonId = seasonId;
    if (!resolvedSeasonId) {
      const activeSeason = await db.season.findFirst({
        where: { status: 'active', division: donationDivision },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      resolvedSeasonId = activeSeason?.id || null;
    }

    // Find tournament for weekly type if not provided
    let resolvedTournamentId = tournamentId;
    if (donationType === 'weekly' && !resolvedTournamentId && resolvedSeasonId) {
      const latestTournament = await db.tournament.findFirst({
        where: { seasonId: resolvedSeasonId },
        orderBy: { weekNumber: 'desc' },
        select: { id: true },
      });
      resolvedTournamentId = latestTournament?.id || null;
    }

    // ═══ Auto-approve logic ═══
    let isAdminManualAdd = false;
    if (body.source === 'admin') {
      const authCheck = await requireAdmin(request);
      if (!(authCheck instanceof NextResponse)) {
        isAdminManualAdd = true;
      }
    }

    const donation = await db.donation.create({
      data: {
        donorName: donorName.trim(),
        amount,
        message: message?.trim() || null,
        type: donationType,
        division: donationDivision,
        status: isAdminManualAdd ? 'approved' : 'pending',
        tournamentId: donationType === 'weekly' ? resolvedTournamentId : null,
        seasonId: resolvedSeasonId,
      },
    });

    // ═══ Auto-resolve playerId from donorName ↔ gamertag matching ═══
    try {
      const matchedPlayer = await db.player.findFirst({
        where: {
          gamertag: { equals: donorName.trim() },
          isActive: true,
        },
        select: { id: true },
      });

      if (matchedPlayer) {
        await db.donation.update({
          where: { id: donation.id },
          data: { playerId: matchedPlayer.id },
        });
      }
    } catch (matchError) {
      console.warn('[DONATIONS_PLAYER_MATCH] Failed:', matchError);
    }

    // ★ If auto-approved (admin manual add), trigger the same award logic as manual approval
    if (isAdminManualAdd && donation.status === 'approved' && donationType === 'weekly') {
      try {
        const { autoAwardSawerSkin } = await import('@/lib/sawer-auto-award');
        await autoAwardSawerSkin(donation.donorName);
      } catch (awardError) {
        console.warn('[SAWER_AUTO_AWARD] Failed on admin add:', awardError);
      }

      // Auto-award donor skin (Maroon Heart) to Sultan of the Week
      try {
        const donorPlayerId = donation.playerId || (await db.player.findFirst({
          where: { gamertag: { equals: donation.donorName } },
          select: { id: true },
        }))?.id;

        if (donorPlayerId) {
          const account = await db.account.findUnique({
            where: { playerId: donorPlayerId },
            select: { id: true },
          });

          if (account) {
            const donorSkin = await db.skin.findFirst({
              where: { type: 'donor' },
              select: { id: true },
            });

            if (donorSkin) {
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + 7);

              // Check for existing player skin
              const existingSkin = await db.playerSkin.findUnique({
                where: { accountId_skinId: { accountId: account.id, skinId: donorSkin.id } },
              });

              if (existingSkin) {
                await db.playerSkin.update({
                  where: { id: existingSkin.id },
                  data: {
                    expiresAt,
                    reason: 'Sultan of the Week — donasi skin extended',
                  },
                });
              } else {
                await db.playerSkin.create({
                  data: {
                    accountId: account.id,
                    skinId: donorSkin.id,
                    reason: 'Sultan of the Week — donasi skin awarded',
                    expiresAt,
                  },
                });
              }

              // Set donorBadgeCount to actual approved donation count
              const approvedCount = await db.donation.count({
                where: {
                  donorName: donation.donorName,
                  status: 'approved',
                  type: 'weekly',
                },
              });

              await db.account.update({
                where: { id: account.id },
                data: { donorBadgeCount: approvedCount },
              });
            }
          }
        }
      } catch (donorSkinError) {
        console.warn('[DONOR_SKIN_AWARD] Failed on admin add:', donorSkinError);
      }
    }

    // Pusher: Notify real-time clients about new donation
    void pusherTrigger(PUSHER_CHANNELS.FEED, PUSHER_EVENTS.FEED_UPDATED, {
      type: isAdminManualAdd ? 'donation-approved' : 'donation-created',
      donationId: donation.id,
      amount: donation.amount,
      donorName: donation.donorName,
    });

    // ★ Audit log: player donation (if player is authenticated)
    try {
      const playerSession = await verifyPlayer(request);
      if (playerSession && !(playerSession instanceof NextResponse)) {
        void createPlayerAuditLog({
          playerId: playerSession.playerId,
          playerName: playerSession.player.gamertag,
          action: 'donation',
          entity: 'donation',
          entityId: donation.id,
          details: `Donation Rp ${amount.toLocaleString('id-ID')} by ${donorName.trim()}`,
          metadata: { amount, type: donationType, division: donationDivision },
        });
      }
    } catch {
      // Player not authenticated — skip player audit log (donation from anonymous)
    }

    // Invalidate ISR cache for landing page stats (admin auto-approve)
    if (isAdminManualAdd) {
      try {
        revalidateTag('landing-stats', 'max');
        revalidatePath('/');
      } catch (e) {
        console.warn('[DONATION_AUTO_APPROVE] revalidateTag error (non-critical):', e);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Terima kasih atas dukungan Anda! 🎉 Silakan lakukan pembayaran.',
      donation: {
        id: donation.id,
        donorName: donation.donorName,
        amount: donation.amount,
        type: donation.type,
        status: donation.status,
        createdAt: donation.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[DONATIONS_POST]', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat memproses donasi' }, { status: 500 });
  }
}

// GET /api/donations — List donations (public: only approved; admin: all or filtered)
export async function GET(request: Request) {
  const headers = new Headers();
  headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  headers.set('Vary', 'Accept-Encoding');

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // "weekly" | "season"
    const seasonId = searchParams.get('seasonId');
    const tournamentId = searchParams.get('tournamentId');
    const status = searchParams.get('status'); // "pending" | "approved" | "rejected" | "all"
    const division = searchParams.get('division'); // "male" | "female"
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    const where: Prisma.DonationWhereInput = {};

    if (type) where.type = type;
    if (seasonId) where.seasonId = seasonId;
    if (tournamentId) where.tournamentId = tournamentId;
    if (division) where.division = division;

    // Public requests only see approved; admin can request specific status
    if (status && status !== 'approved') {
      // Any status other than 'approved' requires admin auth
      const authResult = await requireAdmin(request);
      if (authResult instanceof NextResponse) return authResult;

      if (status !== 'all') {
        where.status = status;
      }
    } else if (!status) {
      // Default: only approved for public
      where.status = 'approved';
    }

    const [donations, total] = await Promise.all([
      db.donation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          tournament: {
            select: { id: true, weekNumber: true, name: true, division: true },
          },
        },
      }),
      db.donation.count({ where }),
    ]);

    // Get total amount
    const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);

    return NextResponse.json({
      donations,
      total: {
        amount: totalAmount,
        count: total,
      },
    }, { headers });
  } catch (error) {
    console.error('[DONATIONS_GET]', error);
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { headers, status: 500 });
  }
}

// PATCH /api/donations — Admin approve/reject donation
export async function PATCH(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ID donasi wajib diisi' }, { status: 400 });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Status harus "approved" atau "rejected"' }, { status: 400 });
    }

    const donation = await db.donation.update({
      where: { id },
      data: { status },
    });

    // Auto-award sawer skin when a weekly donation is approved
    if (status === 'approved' && donation.type === 'weekly') {
      try {
        const { autoAwardSawerSkin } = await import('@/lib/sawer-auto-award');
        await autoAwardSawerSkin(donation.donorName);
      } catch (awardError) {
        console.warn('[SAWER_AUTO_AWARD] Failed:', awardError);
      }

      // ═══ Auto-award donor skin (Maroon Heart) to Sultan of the Week ═══
      try {
        const donorPlayerId = donation.playerId || (await db.player.findFirst({
          where: { gamertag: { equals: donation.donorName } },
          select: { id: true },
        }))?.id;

        if (donorPlayerId) {
          const account = await db.account.findUnique({
            where: { playerId: donorPlayerId },
            select: { id: true },
          });

          if (account) {
            const donorSkin = await db.skin.findFirst({
              where: { type: 'donor' },
              select: { id: true },
            });

            if (donorSkin) {
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + 7);

              const existingSkin = await db.playerSkin.findUnique({
                where: { accountId_skinId: { accountId: account.id, skinId: donorSkin.id } },
              });

              if (existingSkin) {
                await db.playerSkin.update({
                  where: { id: existingSkin.id },
                  data: {
                    expiresAt,
                    reason: 'Sultan of the Week — donasi skin extended',
                  },
                });
              } else {
                await db.playerSkin.create({
                  data: {
                    accountId: account.id,
                    skinId: donorSkin.id,
                    reason: 'Sultan of the Week — donasi skin awarded',
                    expiresAt,
                  },
                });
              }

              // Set donorBadgeCount to actual approved donation count
              const approvedCount = await db.donation.count({
                where: {
                  donorName: donation.donorName,
                  status: 'approved',
                  type: 'weekly',
                },
              });

              await db.account.update({
                where: { id: account.id },
                data: { donorBadgeCount: approvedCount },
              });
            }
          }
        }
      } catch (donorSkinError) {
        console.warn('[DONOR_SKIN_AWARD] Failed:', donorSkinError);
      }
    }

    // Trigger real-time event so marquee updates instantly for all users
    try {
      const { pusherTrigger, PUSHER_CHANNELS, PUSHER_EVENTS } = await import('@/lib/pusher');
      await pusherTrigger(PUSHER_CHANNELS.FEED, PUSHER_EVENTS.FEED_UPDATED, {
        type: status === 'approved' ? 'donation-approved' : 'donation-rejected',
        donation: {
          id: donation.id,
          donorName: donation.donorName,
          amount: donation.amount,
          type: donation.type,
          status: donation.status,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (pusherError) {
      console.warn('[Pusher] Failed to trigger feed event:', pusherError);
    }

    // Invalidate ISR cache for landing page stats
    if (status === 'approved') {
      try {
        revalidateTag('landing-stats', 'max');
        revalidatePath('/');
      } catch (e) {
        console.warn('[DONATION_APPROVE] revalidateTag error (non-critical):', e);
      }
    }

    return NextResponse.json({
      success: true,
      message: status === 'approved' ? 'Donasi berhasil disetujui ✅' : 'Donasi ditolak ❌',
      donation: {
        id: donation.id,
        donorName: donation.donorName,
        amount: donation.amount,
        type: donation.type,
        status: donation.status,
      },
    });
  } catch (error) {
    console.error('[DONATIONS_PATCH]', error);
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}

// DELETE /api/donations — Admin delete donation
export async function DELETE(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  try {
    const body = await request.json();
    const { id } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ID donasi wajib diisi' }, { status: 400 });
    }

    await db.donation.delete({ where: { id } });

    await createAuditLog({
      adminId: admin.id,
      adminName: admin.username,
      action: 'delete',
      entity: 'donation',
      entityId: id,
    });

    return NextResponse.json({ success: true, message: 'Donasi berhasil dihapus' });
  } catch (error) {
    console.error('[DONATIONS_DELETE]', error);
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}
