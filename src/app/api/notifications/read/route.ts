import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPlayer } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const player = await verifyPlayer(request);
    if (!player) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accountId = player.id;
    const body = await request.json();
    const { ids, markAll } = body as { ids?: string[]; markAll?: boolean };

    let updatedCount = 0;

    if (markAll) {
      const result = await db.notification.updateMany({
        where: { accountId, isRead: false },
        data: { isRead: true },
      });
      updatedCount = result.count;
    } else if (ids && Array.isArray(ids) && ids.length > 0) {
      const result = await db.notification.updateMany({
        where: {
          id: { in: ids },
          accountId, // Security: only mark own notifications
        },
        data: { isRead: true },
      });
      updatedCount = result.count;
    } else {
      return NextResponse.json(
        { error: 'Provide ids array or markAll: true' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, updatedCount });
  } catch (error) {
    console.error('[NOTIFICATIONS/READ] Error:', error);
    return NextResponse.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 }
    );
  }
}
