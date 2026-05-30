import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPlayer } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const player = await verifyPlayer(request);
    if (!player) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accountId = player.id;
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const markRead = searchParams.get('markRead') === 'true';

    // Build where clause
    const where: any = { accountId };
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
    }

    // If markRead, mark all unread notifications as read
    if (markRead) {
      await db.notification.updateMany({
        where: { accountId, isRead: false },
        data: { isRead: true },
      });
    }

    // Fetch notifications
    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // +1 for hasMore check
    });

    const hasMore = notifications.length > limit;
    const items = hasMore ? notifications.slice(0, limit) : notifications;

    // Get unread count
    const unreadCount = await db.notification.count({
      where: { accountId, isRead: false },
    });

    return NextResponse.json({
      notifications: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        url: n.url,
        icon: n.icon,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1].createdAt.toISOString() : null,
    });
  } catch (error) {
    console.error('[NOTIFICATIONS] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
