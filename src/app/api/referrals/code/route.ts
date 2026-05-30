import { NextResponse } from 'next/server';
import { requirePlayer } from '@/lib/api-auth';
import { db } from '@/lib/db';

// Generate a short, memorable referral code
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid confusion
  let code = 'TARKAM-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET /api/referrals/code — Get current user's referral code (auto-generate if not exists)
export async function GET(request: Request) {
  const player = await requirePlayer(request);
  if (player instanceof NextResponse) return player;

  try {
    let referralCode = await db.referralCode.findUnique({
      where: { accountId: player.id },
      include: {
        referrals: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            referredAccount: {
              select: {
                id: true,
                player: {
                  select: { gamertag: true, avatar: true, division: true },
                },
              },
            },
          },
        },
      },
    });

    // Auto-generate if not exists
    if (!referralCode) {
      let code = generateReferralCode();
      // Ensure uniqueness (very unlikely collision, but safe)
      let attempts = 0;
      while (await db.referralCode.findUnique({ where: { code } })) {
        code = generateReferralCode();
        attempts++;
        if (attempts > 10) break;
      }

      referralCode = await db.referralCode.create({
        data: {
          code,
          accountId: player.id,
        },
        include: {
          referrals: {
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
              referredAccount: {
                select: {
                  id: true,
                  player: {
                    select: { gamertag: true, avatar: true, division: true },
                  },
                },
              },
            },
          },
        },
      });
    }

    return NextResponse.json({
      code: referralCode.code,
      uses: referralCode.uses,
      maxUses: referralCode.maxUses,
      createdAt: referralCode.createdAt,
      referrals: referralCode.referrals,
    });
  } catch (error) {
    console.error('[referrals/code] GET error:', error);
    return NextResponse.json({ error: 'Gagal mengambil kode referral' }, { status: 500 });
  }
}

// POST /api/referrals/code — Generate a new referral code (replaces old one)
export async function POST(request: Request) {
  const player = await requirePlayer(request);
  if (player instanceof NextResponse) return player;

  try {
    // Check if they already have a code
    const existing = await db.referralCode.findUnique({
      where: { accountId: player.id },
    });

    if (existing) {
      // Generate a new code, replacing the old one
      let code = generateReferralCode();
      let attempts = 0;
      while (await db.referralCode.findUnique({ where: { code } })) {
        code = generateReferralCode();
        attempts++;
        if (attempts > 10) break;
      }

      const updated = await db.referralCode.update({
        where: { id: existing.id },
        data: { code },
        include: {
          referrals: {
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
              referredAccount: {
                select: {
                  id: true,
                  player: {
                    select: { gamertag: true, avatar: true, division: true },
                  },
                },
              },
            },
          },
        },
      });

      return NextResponse.json({
        code: updated.code,
        uses: updated.uses,
        maxUses: updated.maxUses,
        createdAt: updated.createdAt,
        referrals: updated.referrals,
        message: 'Kode referral baru berhasil dibuat',
      });
    }

    // No existing code — create one
    let code = generateReferralCode();
    let attempts = 0;
    while (await db.referralCode.findUnique({ where: { code } })) {
      code = generateReferralCode();
      attempts++;
      if (attempts > 10) break;
    }

    const referralCode = await db.referralCode.create({
      data: { code, accountId: player.id },
      include: {
        referrals: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            referredAccount: {
              select: {
                id: true,
                player: {
                  select: { gamertag: true, avatar: true, division: true },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      code: referralCode.code,
      uses: referralCode.uses,
      maxUses: referralCode.maxUses,
      createdAt: referralCode.createdAt,
      referrals: referralCode.referrals,
      message: 'Kode referral berhasil dibuat',
    });
  } catch (error) {
    console.error('[referrals/code] POST error:', error);
    return NextResponse.json({ error: 'Gagal membuat kode referral' }, { status: 500 });
  }
}
