import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPlayer } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    // Verify player session (optional — allow anonymous subscriptions too)
    const player = await verifyPlayer(request);
    const accountId = player && 'id' in player ? player.id : null;

    const body = await request.json();
    const { endpoint, keys, userAgent } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: 'Missing required subscription fields (endpoint, keys.p256dh, keys.auth)' },
        { status: 400 }
      );
    }

    // Upsert: update if endpoint already exists, create otherwise
    const subscription = await db.pushSubscription.upsert({
      where: { endpoint },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
        accountId: accountId || undefined,
        userAgent: userAgent || undefined,
        updatedAt: new Date(),
      },
      create: {
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        accountId: accountId || undefined,
        userAgent: userAgent || undefined,
      },
    });

    return NextResponse.json({ success: true, id: subscription.id });
  } catch (error) {
    console.error('[NOTIFICATIONS/SUBSCRIBE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save push subscription' },
      { status: 500 }
    );
  }
}

// DELETE — unsubscribe
export async function DELETE(request: NextRequest) {
  try {
    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Missing endpoint' },
        { status: 400 }
      );
    }

    await db.pushSubscription.deleteMany({
      where: { endpoint },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[NOTIFICATIONS/SUBSCRIBE/DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to remove push subscription' },
      { status: 500 }
    );
  }
}
