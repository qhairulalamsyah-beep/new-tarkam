import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { buildCacheHeaders, buildErrorCacheHeaders, CACHE_TIER_4 } from '@/lib/cache-tiers';

// POST /api/clubs/[id]/members — Add member to club (via ClubProfile)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id: clubId } = await params;
  const body = await request.json();
  const { playerId, role } = body;

  if (!playerId) {
    return NextResponse.json({ error: 'Player ID wajib diisi' }, { status: 400 });
  }

  try {
    // Validate club exists and get profileId
    const club = await db.club.findUnique({ where: { id: clubId } });

    if (!club) {
      return NextResponse.json({ error: 'Club tidak ditemukan' }, { status: 404 });
    }

    const profileId = club.profileId;

    // Validate player exists
    const player = await db.player.findUnique({ where: { id: playerId } });

    if (!player) {
      return NextResponse.json({ error: 'Player tidak ditemukan' }, { status: 404 });
    }

    // Check if player is already an ACTIVE member of this club profile
    const existingActive = await db.clubMember.findFirst({
      where: {
        profileId,
        playerId,
        leftAt: null,
      },
    });

    if (existingActive) {
      return NextResponse.json({ error: 'Player sudah menjadi anggota club ini' }, { status: 409 });
    }

    // Check if player is an active member of ANOTHER club
    const otherMemberships = await db.clubMember.findMany({
      where: {
        playerId,
        leftAt: null,
        NOT: { profileId },
      },
      include: { profile: { select: { name: true } } },
    });

    if (otherMemberships.length > 0) {
      const otherProfile = otherMemberships[0].profile;
      return NextResponse.json({
        error: `Player sudah terdaftar di club "${otherProfile?.name}". Hapus dulu dari club tersebut.`,
      }, { status: 409 });
    }

    // If adding as captain, check if there's already a captain
    const memberRole = role === 'captain' ? 'captain' : 'member';
    if (memberRole === 'captain') {
      const currentCaptain = await db.clubMember.findFirst({
        where: {
          profileId,
          role: 'captain',
          leftAt: null,
        },
      });

      if (currentCaptain) {
        // Demote existing captain to member
        await db.clubMember.update({
          where: { id: currentCaptain.id },
          data: { role: 'member' },
        });
      }
    }

    // If player had a previous membership in this club (leftAt is set), re-activate them
    const previousMembership = await db.clubMember.findFirst({
      where: {
        profileId,
        playerId,
        leftAt: { not: null },
      },
    });

    if (previousMembership) {
      const reactivated = await db.clubMember.update({
        where: { id: previousMembership.id },
        data: { leftAt: null, role: memberRole, joinedAt: new Date() },
        include: { player: { select: { id: true, gamertag: true, name: true, division: true, tier: true, points: true } } },
      });

      return NextResponse.json(reactivated, { status: 201 });
    }

    const member = await db.clubMember.create({
      data: {
        profileId,
        playerId,
        role: memberRole,
      },
      include: { player: { select: { id: true, gamertag: true, name: true, division: true, tier: true, points: true } } },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error('[POST /api/clubs/[id]/members] Error:', error);
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
  }
}

// GET /api/clubs/[id]/members — List members of club (via ClubProfile)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // ★ Time-aware cache headers — Tier 4 (personal): TTL adjusts based on WITA peak hours
  const headers = buildCacheHeaders(CACHE_TIER_4, 'club-members');

  try {
    const { id: clubId } = await params;

    const club = await db.club.findUnique({ where: { id: clubId } });

    if (!club) {
      return NextResponse.json({ error: 'Club tidak ditemukan' }, { headers, status: 404 });
    }

    const profileId = club.profileId;

    // Get active members from the ClubProfile (persistent, not per-season)
    const members = await db.clubMember.findMany({
      where: {
        profileId,
        leftAt: null,
      },
      include: {
        player: { select: { id: true, gamertag: true, name: true, division: true, tier: true, points: true, totalWins: true, totalMvp: true, streak: true, avatar: true, isActive: true } },
      },
    });

    // Sort: role desc (captain first), then gamertag asc
    const sorted = members.sort((a, b) => {
      const roleOrder = a.role === 'captain' ? 1 : 0;
      const bRoleOrder = b.role === 'captain' ? 1 : 0;
      if (roleOrder !== bRoleOrder) return bRoleOrder - roleOrder;
      return (a.player?.gamertag || '').localeCompare(b.player?.gamertag || '');
    });

    return NextResponse.json(sorted, { headers });
  } catch (error) {
    console.error('[GET /api/clubs/[id]/members] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch members' }, { headers: Object.fromEntries(buildErrorCacheHeaders().entries()), status: 500 });
  }
}

// DELETE /api/clubs/[id]/members — Remove member from club (set leftAt on ClubProfile membership)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id: clubId } = await params;
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get('playerId');

  if (!playerId) {
    return NextResponse.json({ error: 'Player ID wajib diisi' }, { status: 400 });
  }

  try {
    // Get club's profileId
    const club = await db.club.findUnique({ where: { id: clubId } });

    if (!club) {
      return NextResponse.json({ error: 'Club tidak ditemukan' }, { status: 404 });
    }

    const profileId = club.profileId;

    const membership = await db.clubMember.findFirst({
      where: {
        profileId,
        playerId,
        leftAt: null,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Player bukan anggota club ini' }, { status: 404 });
    }

    // If removing captain, auto-assign the first remaining member as captain
    if (membership.role === 'captain') {
      const otherMembers = await db.clubMember.findMany({
        where: {
          profileId,
          NOT: { playerId },
          leftAt: null,
        },
        orderBy: { joinedAt: 'asc' },
        take: 1,
      });

      if (otherMembers.length > 0) {
        await db.clubMember.update({
          where: { id: otherMembers[0].id },
          data: { role: 'captain' },
        });
      }
    }

    // Soft-delete: set leftAt instead of hard-deleting (preserves history)
    await db.clubMember.update({
      where: { id: membership.id },
      data: { leftAt: new Date() },
    });

    return NextResponse.json({ success: true, message: 'Anggota berhasil dihapus dari club' });
  } catch (error) {
    console.error('[DELETE /api/clubs/[id]/members] Error:', error);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
