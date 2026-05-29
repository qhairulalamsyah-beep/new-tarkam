import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, createPlayerSessionToken, isSessionInvalidated } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 });
    }

    // ─── Step 1: Find account by username ───
    const account = await db.account.findUnique({
      where: { username },
      include: {
        player: {
          select: {
            id: true,
            gamertag: true,
            name: true,
            division: true,
            tier: true,
            avatar: true,
            points: true,
            totalWins: true,
            totalMvp: true,
            matches: true,
            streak: true,
            city: true,
          },
        },
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
    }

    // ─── Step 2: Verify password ───
    const isValid = await verifyPassword(password, account.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
    }

    // ─── Step 3: Check session invalidation ───
    if (isSessionInvalidated(Date.now(), (account as any).sessionInvalidatedAt)) {
      return NextResponse.json({ error: 'Sesi telah kadaluarsa, silakan login ulang' }, { status: 401 });
    }

    // ─── Step 4: Create session cookie ───
    const token = createPlayerSessionToken(account.id, account.playerId);

    // ─── Step 5: Get active skins ───
    let skinsData: Array<{
      type: string;
      icon: string;
      displayName: string;
      colorClass: string;
      priority: number;
      duration: string;
      reason: string | null;
      expiresAt: string | null;
      donorBadgeCount?: number;
    }> = [];

    try {
      const playerSkins = await db.playerSkin.findMany({
        where: {
          accountId: account.id,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        include: {
          skin: { select: { id: true, type: true, displayName: true, icon: true, colorClass: true, priority: true, duration: true } },
        },
        orderBy: { skin: { priority: 'desc' } },
      });

      skinsData = playerSkins.map(ps => ({
        type: ps.skin.type,
        icon: ps.skin.icon,
        displayName: ps.skin.displayName,
        colorClass: ps.skin.colorClass,
        priority: ps.skin.priority,
        duration: ps.skin.duration,
        reason: ps.reason,
        expiresAt: ps.expiresAt?.toISOString() ?? null,
        donorBadgeCount: ps.skin.type === 'donor' ? account.donorBadgeCount : undefined,
      }));
    } catch (skinError) {
      console.error('[auth/player-login] Skin fetch error (non-critical):', skinError);
    }

    // If player has donor badges but no active donor skin, add virtual donor_badge entry
    if (account.donorBadgeCount > 0 && !skinsData.some(s => s.type === 'donor')) {
      skinsData.push({
        type: 'donor_badge',
        icon: '❤️',
        displayName: account.donorBadgeCount >= 5 ? 'Heart Badge ★' : 'Heart Badge',
        colorClass: '{"frame":"#fb7185","name":"#fb7185|#ef4444|#f472b6","badge":"rgba(244,63,94,0.2)|#fda4af","border":"#f43f5e|#ef4444|#f472b6","glow":"rgba(244,63,94,0.35)"}',
        priority: 0,
        duration: 'permanent',
        reason: `${account.donorBadgeCount}x donasi`,
        expiresAt: null,
        donorBadgeCount: account.donorBadgeCount,
      });
    }

    // ─── Step 6: Update lastLoginAt ───
    db.account.update({
      where: { id: account.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => {});

    // ─── Step 7: Return success with session data ───
    const response = NextResponse.json({
      success: true,
      authenticated: true,
      account: {
        id: account.id,
        username: account.username,
        donorBadgeCount: account.donorBadgeCount,
        skins: skinsData,
        player: account.player,
      },
    });

    // Set session cookie
    response.cookies.set('idm-player-session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[auth/player-login] Error:', error);
    return NextResponse.json({ error: 'Login gagal' }, { status: 500 });
  }
}
