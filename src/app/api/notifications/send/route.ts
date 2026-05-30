import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { isPushConfigured, vapidPrivateKey, vapidSubject, vapidPublicKey } from '@/lib/push-config';

export async function POST(request: NextRequest) {
  try {
    // Admin-only endpoint
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;
    const admin = adminResult;

    if (!isPushConfigured()) {
      return NextResponse.json(
        { error: 'Push notifications not configured. Set VAPID keys in .env' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { type, title, body: notifBody, url, icon, accountId, sendToAll } = body as {
      type: string;
      title: string;
      body: string;
      url?: string;
      icon?: string;
      accountId?: string;
      sendToAll?: boolean;
    };

    if (!type || !title || !notifBody) {
      return NextResponse.json(
        { error: 'Missing required fields: type, title, body' },
        { status: 400 }
      );
    }

    // Store notification in DB
    if (sendToAll) {
      // Create notification for all accounts
      const accounts = await db.account.findMany({
        select: { id: true },
      });

      if (accounts.length > 0) {
        await db.notification.createMany({
          data: accounts.map((a) => ({
            type,
            title,
            body: notifBody,
            url: url || null,
            icon: icon || null,
            accountId: a.id,
          })),
        });
      }
    } else if (accountId) {
      await db.notification.create({
        data: {
          type,
          title,
          body: notifBody,
          url: url || null,
          icon: icon || null,
          accountId,
        },
      });
    } else {
      // No target — store as orphan notification (no accountId)
      await db.notification.create({
        data: {
          type,
          title,
          body: notifBody,
          url: url || null,
          icon: icon || null,
          accountId: null,
        },
      });
    }

    // Send push messages
    const pushPayload = JSON.stringify({
      title,
      body: notifBody,
      icon: icon || '/logo.webp',
      url: url || '/',
      tag: `idm-${type}-${Date.now()}`,
    });

    let pushSent = 0;
    let pushFailed = 0;

    // Get subscriptions to send to
    let subscriptions;
    if (sendToAll) {
      subscriptions = await db.pushSubscription.findMany();
    } else if (accountId) {
      subscriptions = await db.pushSubscription.findMany({
        where: { accountId },
      });
    } else {
      subscriptions = await db.pushSubscription.findMany();
    }

    // Send push to each subscription using web-push
    if (subscriptions.length > 0) {
      const webpush = await import('web-push');

      webpush.default.setVapidDetails(
        vapidSubject,
        vapidPublicKey,
        vapidPrivateKey
      );

      const pushPromises = subscriptions.map(async (sub) => {
        try {
          await webpush.default.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            pushPayload
          );
          pushSent++;
        } catch (err: any) {
          pushFailed++;
          // If subscription is expired/gone, remove it from DB
          if (err.statusCode === 410 || err.statusCode === 404) {
            try {
              await db.pushSubscription.delete({ where: { id: sub.id } });
            } catch {}
          }
          console.warn(`[PUSH] Failed to send to ${sub.endpoint.slice(0, 50)}...: ${err.statusCode || err.message}`);
        }
      });

      await Promise.allSettled(pushPromises);
    }

    return NextResponse.json({
      success: true,
      dbStored: true,
      pushSent,
      pushFailed,
      totalSubscriptions: subscriptions.length,
      sentBy: admin.username,
    });
  } catch (error) {
    console.error('[NOTIFICATIONS/SEND] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
