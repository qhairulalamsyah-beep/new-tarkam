import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { NextResponse } from 'next/server';

// PATCH /api/prize-claims/[id] — Update claim status (admin: verify, process, complete, reject)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, notes } = body;

    const validStatuses = ['pending', 'verified', 'processing', 'shipped', 'completed', 'rejected'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: `Status harus salah satu: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    const existingClaim = await db.prizeClaim.findUnique({
      where: { id },
      include: {
        player: { select: { gamertag: true, name: true, division: true } },
      },
    });

    if (!existingClaim) {
      return NextResponse.json({ error: 'Klaim hadiah tidak ditemukan' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    // Set timestamps based on status
    if (status === 'verified') updateData.verifiedAt = new Date();
    if (status === 'completed') {
      updateData.completedAt = new Date();
      if (!existingClaim.verifiedAt) updateData.verifiedAt = new Date();
    }

    const claim = await db.prizeClaim.update({
      where: { id },
      data: updateData,
      include: {
        player: {
          select: {
            id: true,
            gamertag: true,
            name: true,
            division: true,
            avatar: true,
          },
        },
        account: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    // Create notification for the player if they have an account
    if (claim.accountId && status) {
      try {
        const statusMessages: Record<string, { title: string; body: string }> = {
          verified: { title: 'Klaim Diverifikasi! ✅', body: `Klaim hadiah kamu sudah diverifikasi. Tim akan memproses pengiriman.` },
          processing: { title: 'Hadiah Diproses 📦', body: `Hadiah kamu sedang diproses dan akan segera dikirim.` },
          shipped: { title: 'Hadiah Dikirim! 🚀', body: `Hadiah kamu sudah dikirim! Mohon tunggu.` },
          completed: { title: 'Hadiah Diterima! 🎉', body: `Klaim hadiah kamu telah selesai. Terima kasih!` },
          rejected: { title: 'Klaim Ditolak ❌', body: `Klaim hadiah kamu ditolak. ${notes || 'Hubungi admin untuk info lebih lanjut.'}` },
        };

        const msg = statusMessages[status];
        if (msg) {
          await db.notification.create({
            data: {
              type: 'prize_claim',
              title: msg.title,
              body: msg.body,
              accountId: claim.accountId,
              url: '/?tab=prizes',
            },
          });
        }
      } catch (notifError) {
        console.warn('[PRIZE_CLAIM_NOTIFICATION]', notifError);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Status klaim diperbarui ke "${status}"`,
      claim,
    });
  } catch (error) {
    console.error('[PRIZE_CLAIMS_PATCH]', error);
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}
