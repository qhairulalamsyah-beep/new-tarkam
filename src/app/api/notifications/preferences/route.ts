import { db } from '@/lib/db';
import { verifyPlayer } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';

// ═══════════════════════════════════════════════════════
// GET /api/notifications/preferences — Get WA notification preferences
// ═══════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const player = await verifyPlayer(request);
  if (!player) {
    return NextResponse.json({ success: false, error: 'Login diperlukan' }, { status: 401 });
  }

  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    let preference = await db.notifPreference.findUnique({
      where: { accountId: player.id },
    });

    // Auto-create default preferences if not found
    if (!preference) {
      // Get WA number from player record
      const playerData = await db.player.findUnique({
        where: { id: player.playerId },
        select: { waNumber: true, phone: true },
      });

      preference = await db.notifPreference.create({
        data: {
          accountId: player.id,
          playerId: player.playerId,
          whatsapp: playerData?.waNumber || playerData?.phone || null,
          enableTournament: true,
          enableMatch: true,
          enableResult: true,
          enablePrize: true,
          enableSeason: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: preference.id,
        enableTournament: preference.enableTournament,
        enableMatch: preference.enableMatch,
        enableResult: preference.enableResult,
        enablePrize: preference.enablePrize,
        enableSeason: preference.enableSeason,
        whatsapp: preference.whatsapp,
      },
    }, { headers });
  } catch (error) {
    console.error('Get notification preferences error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════
// PUT /api/notifications/preferences — Update WA notification preferences
// ═══════════════════════════════════════════════════════

export async function PUT(request: NextRequest) {
  const player = await verifyPlayer(request);
  if (!player) {
    return NextResponse.json({ success: false, error: 'Login diperlukan' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { enableTournament, enableMatch, enableResult, enablePrize, enableSeason } = body;

    // Find or create preference
    let preference = await db.notifPreference.findUnique({
      where: { accountId: player.id },
    });

    const updateData: Record<string, unknown> = {};
    if (enableTournament !== undefined) updateData.enableTournament = enableTournament;
    if (enableMatch !== undefined) updateData.enableMatch = enableMatch;
    if (enableResult !== undefined) updateData.enableResult = enableResult;
    if (enablePrize !== undefined) updateData.enablePrize = enablePrize;
    if (enableSeason !== undefined) updateData.enableSeason = enableSeason;

    if (preference) {
      preference = await db.notifPreference.update({
        where: { id: preference.id },
        data: updateData,
      });
    } else {
      const playerData = await db.player.findUnique({
        where: { id: player.playerId },
        select: { waNumber: true, phone: true },
      });

      preference = await db.notifPreference.create({
        data: {
          accountId: player.id,
          playerId: player.playerId,
          whatsapp: playerData?.waNumber || playerData?.phone || null,
          enableTournament: enableTournament ?? true,
          enableMatch: enableMatch ?? true,
          enableResult: enableResult ?? true,
          enablePrize: enablePrize ?? true,
          enableSeason: enableSeason ?? true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: preference.id,
        enableTournament: preference.enableTournament,
        enableMatch: preference.enableMatch,
        enableResult: preference.enableResult,
        enablePrize: preference.enablePrize,
        enableSeason: preference.enableSeason,
        whatsapp: preference.whatsapp,
      },
    });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
