import { db } from '@/lib/db';
import { verifyPlayer, requireAdmin } from '@/lib/api-auth';
import { formatWaMessage, checkRateLimit, maskPhoneNumber, sendWaMessage, isWaBotConfigured, type WaNotifType } from '@/lib/wa-notif';
import { NextRequest, NextResponse } from 'next/server';

// ═══════════════════════════════════════════════════════
// POST /api/notifications/whatsapp — Send WA notification
// ═══════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, targetId, targetIds, data } = body;

    // Validate notification type
    const validTypes: WaNotifType[] = ['tournament', 'match', 'result', 'prize', 'season', 'test'];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid notification type. Valid types: ' + validTypes.join(', ') },
        { status: 400 }
      );
    }

    // Resolve target IDs (single or bulk)
    const ids: string[] = targetIds || (targetId ? [targetId] : []);
    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'targetId or targetIds is required' },
        { status: 400 }
      );
    }

    if (ids.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Maximum 50 targets per request' },
        { status: 400 }
      );
    }

    // For test notifications, require player auth
    if (type === 'test') {
      const player = await verifyPlayer(request);
      if (!player) {
        return NextResponse.json({ success: false, error: 'Login diperlukan untuk test notifikasi' }, { status: 401 });
      }
    } else {
      // For other types, require admin auth
      const adminResult = await requireAdmin(request);
      if (adminResult instanceof NextResponse) return adminResult;
    }

    // Format the message
    const message = formatWaMessage(type, data || {});

    const results: Array<{ id: string; status: string; waNumber?: string; error?: string }> = [];

    // Process each target
    for (const id of ids) {
      // Find the player/account and their WA number + preferences
      // Try as playerId first, then as accountId
      let waNumber: string | null = null;
      let accountId: string | null = null;
      let playerId: string | null = null;
      let preferences: { enableTournament: boolean; enableMatch: boolean; enableResult: boolean; enablePrize: boolean; enableSeason: boolean } | null = null;

      // Try player lookup
      const player = await db.player.findUnique({
        where: { id },
        include: { account: true },
      });

      if (player) {
        playerId = player.id;
        waNumber = player.waNumber || player.phone || null;
        accountId = player.account?.id || null;
      } else {
        // Try account lookup
        const account = await db.account.findUnique({
          where: { id },
          include: { player: true },
        });

        if (account) {
          accountId = account.id;
          playerId = account.playerId;
          waNumber = account.player.waNumber || account.player.phone || account.phone || null;
        }
      }

      if (!waNumber) {
        // No WA number found — log as pending
        await db.waNotifLog.create({
          data: {
            type,
            targetId: id,
            waNumber: null,
            message,
            status: 'pending',
            error: 'No WhatsApp number found',
          },
        });
        results.push({ id, status: 'pending', error: 'No WA number' });
        continue;
      }

      // Check preferences
      if (accountId) {
        const pref = await db.notifPreference.findUnique({
          where: { accountId },
        });
        if (pref) {
          preferences = pref;
          const typeToPrefKey: Record<string, keyof typeof pref> = {
            tournament: 'enableTournament',
            match: 'enableMatch',
            result: 'enableResult',
            prize: 'enablePrize',
            season: 'enableSeason',
            test: 'enableTournament', // test uses tournament toggle
          };
          const prefKey = typeToPrefKey[type];
          if (prefKey && !pref[prefKey]) {
            results.push({ id, status: 'disabled', waNumber: maskPhoneNumber(waNumber) });
            continue;
          }
        }
      }

      // Check rate limit
      if (!checkRateLimit(id)) {
        await db.waNotifLog.create({
          data: {
            type,
            targetId: id,
            waNumber,
            message,
            status: 'rate_limited',
            error: 'Rate limited: max 1 message per 5 minutes',
          },
        });
        results.push({ id, status: 'rate_limited', waNumber: maskPhoneNumber(waNumber) });
        continue;
      }

      // Try to send via WA bot
      const sendResult = await sendWaMessage(waNumber, message);

      // Log the result
      await db.waNotifLog.create({
        data: {
          type,
          targetId: id,
          waNumber,
          message,
          status: sendResult.success ? 'sent' : 'failed',
          error: sendResult.error,
        },
      });

      results.push({
        id,
        status: sendResult.success ? 'sent' : 'pending',
        waNumber: maskPhoneNumber(waNumber),
        error: sendResult.success ? undefined : sendResult.error,
      });
    }

    const sentCount = results.filter(r => r.status === 'sent').length;
    const pendingCount = results.filter(r => r.status === 'pending').length;
    const failedCount = results.filter(r => r.status === 'failed' || r.status === 'rate_limited').length;
    const disabledCount = results.filter(r => r.status === 'disabled').length;

    return NextResponse.json({
      success: true,
      summary: { total: ids.length, sent: sentCount, pending: pendingCount, failed: failedCount, disabled: disabledCount },
      results,
      waBotAvailable: isWaBotConfigured(),
    });
  } catch (error) {
    console.error('WhatsApp notification error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════
// GET /api/notifications/whatsapp — Get WA notification log/history
// ═══════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      db.waNotifLog.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      db.waNotifLog.count({ where }),
    ]);

    // Mask phone numbers in response
    const maskedLogs = logs.map(log => ({
      ...log,
      waNumber: log.waNumber ? maskPhoneNumber(log.waNumber) : null,
    }));

    return NextResponse.json({
      success: true,
      data: maskedLogs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      waBotAvailable: isWaBotConfigured(),
    }, { headers });
  } catch (error) {
    console.error('Get WhatsApp notification log error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
