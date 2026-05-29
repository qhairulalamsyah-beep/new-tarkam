import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, createPlayerSessionToken, hashPassword, isBcryptHash } from '@/lib/auth';
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitHeaders } from '@/lib/rate-limit';
import { createPlayerAuditLog } from '@/lib/audit';

const PLAYER_SESSION_COOKIE = 'idm-player-session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 login attempts per 15 minutes per IP
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(clientIp, RATE_LIMITS.PLAYER_LOGIN);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)), ...rateLimitHeaders(rateLimit) } }
      );
    }

    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username dan password harus diisi' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // ═══════════════════════════════════════════════════════════
    // Custom cookie-based auth
    // ═══════════════════════════════════════════════════════════
    const accountLookup = await db.account.findUnique({
      where: { username },
      include: {
        player: {
          select: {
            id: true, gamertag: true, name: true, division: true,
            tier: true, avatar: true, points: true, totalWins: true,
            totalMvp: true, matches: true, streak: true, city: true,
          },
        },
      },
    });

    if (!accountLookup) {
      return NextResponse.json(
        { error: 'Username atau password salah' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Verify password with custom auth
    const isValid = await verifyPassword(password, accountLookup.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Username atau password salah' },
        { status: 401 }
      );
    }

    // Migrate bcrypt hash to scrypt on successful login (non-blocking)
    if (isBcryptHash(accountLookup.passwordHash)) {
      try {
        const newHash = await hashPassword(password);
        await db.account.update({
          where: { id: accountLookup.id },
          data: { passwordHash: newHash, lastLoginAt: new Date() },
        });
      } catch (migrateError) {
        console.error('[PLAYER_LOGIN] Hash migration error (non-critical):', migrateError);
        try {
          await db.account.update({
            where: { id: accountLookup.id },
            data: { lastLoginAt: new Date() },
          });
        } catch (updateError) {
          console.error('[PLAYER_LOGIN] Last login update error (non-critical):', updateError);
        }
      }
    } else {
      try {
        await db.account.update({
          where: { id: accountLookup.id },
          data: { lastLoginAt: new Date() },
        });
      } catch (updateError) {
        console.error('[PLAYER_LOGIN] Last login update error (non-critical):', updateError);
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Create player session token (format: player:accountId:playerId:timestamp:signature)
    // ═══════════════════════════════════════════════════════════
    const token = createPlayerSessionToken(accountLookup.id, accountLookup.playerId);

    // Get active skins for the player (non-blocking — don't fail login if skins query fails)
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
          accountId: accountLookup.id,
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
        donorBadgeCount: ps.skin.type === 'donor' ? accountLookup.donorBadgeCount : undefined,
      }));
    } catch (skinError) {
      console.error('[PLAYER_LOGIN] Skin fetch error (non-critical, login continues):', skinError);
    }

    // If player has donor badges but no active donor skin, add virtual donor_badge entry
    if (accountLookup.donorBadgeCount > 0 && !skinsData.some(s => s.type === 'donor')) {
      skinsData.push({
        type: 'donor_badge',
        icon: '❤️',
        displayName: accountLookup.donorBadgeCount >= 5 ? 'Heart Badge ★' : 'Heart Badge',
        colorClass: '{"frame":"#fb7185","name":"#fb7185|#ef4444|#f472b6","badge":"rgba(244,63,94,0.2)|#fda4af","border":"#f43f5e|#ef4444|#f472b6","glow":"rgba(244,63,94,0.35)"}',
        priority: 0,
        duration: 'permanent',
        reason: `${accountLookup.donorBadgeCount}x donasi`,
        expiresAt: null,
        donorBadgeCount: accountLookup.donorBadgeCount,
      });
    }

    // ★ Audit log: player login (fire-and-forget)
    void createPlayerAuditLog({
      playerId: accountLookup.playerId,
      playerName: accountLookup.player.gamertag,
      action: 'login',
      entity: 'player_auth',
      details: `Player login: ${accountLookup.player.gamertag}`,
    });

    // ═══════════════════════════════════════════════════════════
    // Build final response with custom cookie
    // ═══════════════════════════════════════════════════════════
    const finalResponse = NextResponse.json({
      success: true,
      account: {
        id: accountLookup.id,
        username: accountLookup.username,
        donorBadgeCount: accountLookup.donorBadgeCount,
        skins: skinsData,
        player: accountLookup.player,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });

    // Set httpOnly cookie for player session
    finalResponse.cookies.set(PLAYER_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    });

    return finalResponse;
  } catch (error) {
    console.error('[PLAYER_LOGIN] Fatal error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
