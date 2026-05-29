import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

// GET /api/clubs/[id] — Club detail with profile, members, and season info
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const { id } = await params;

    const club = await db.club.findUnique({ where: { id } });

    if (!club) return NextResponse.json({ error: 'Club not found' }, { headers, status: 404 });

    // Fetch related data in parallel
    const [profile, seasonData, members] = await Promise.all([
      db.clubProfile.findUnique({
        where: { id: club.profileId },
        include: {
          members: {
            include: {
              player: { select: { id: true, name: true, gamertag: true, division: true, tier: true, points: true, totalWins: true, totalMvp: true, streak: true, avatar: true } },
            },
          },
        },
      }),
      db.season.findUnique({
        where: { id: club.seasonId },
        select: { id: true, name: true, division: true, status: true },
      }),
      Promise.resolve(null),
    ]);

    if (!profile) {
      return NextResponse.json({ error: 'Club profile not found' }, { headers, status: 404 });
    }

    // Filter active members and sort
    const activeMembers = profile.members
      .filter(m => m.leftAt === null)
      .sort((a, b) => {
        const roleOrder = a.role === 'captain' ? 1 : 0;
        const bRoleOrder = b.role === 'captain' ? 1 : 0;
        if (roleOrder !== bRoleOrder) return bRoleOrder - roleOrder;
        return (a.player?.gamertag || '').localeCompare(b.player?.gamertag || '');
      });

    // Flatten for frontend compatibility
    const flat = {
      id: club.id,
      profileId: club.profileId,
      name: profile.name,
      logo: profile.logo,
      bannerImage: profile.bannerImage,
      division: club.division,
      seasonId: club.seasonId,
      wins: club.wins,
      losses: club.losses,
      points: club.points,
      gameDiff: club.gameDiff,
      season: seasonData,
      members: activeMembers.map(m => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        player: m.player,
      })),
      _count: { members: activeMembers.length },
    };

    return NextResponse.json(flat, { headers });
  } catch (error) {
    console.error('[GET /api/clubs/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch club' }, { status: 500 });
  }
}

// PUT /api/clubs/[id] — Edit club (name, logo, banner → all on ClubProfile now)
// Accepts BOTH Club ID (season entry) and ClubProfile ID (unified mode)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, logo, bannerImage } = body;

    // Try to find as Club (season entry) first, then as ClubProfile
    const club = await db.club.findUnique({ where: { id } });

    let profileId: string;
    let profileName: string;

    if (club) {
      profileId = club.profileId;
      // Fetch profile to get name
      const profileData = await db.clubProfile.findUnique({ where: { id: profileId } });
      profileName = profileData?.name || '';
    } else {
      // Try as ClubProfile ID (unified mode returns profile.id)
      const profile = await db.clubProfile.findUnique({ where: { id } });

      if (!profile) {
        return NextResponse.json({ error: 'Club tidak ditemukan' }, { status: 404 });
      }
      profileId = profile.id;
      profileName = profile.name;
    }

    // ── Update ClubProfile (persistent identity: name, logo, banner) ──
    if (name || logo !== undefined || bannerImage !== undefined) {
      // Check name uniqueness if renaming
      if (name && name !== profileName) {
        const existing = await db.clubProfile.findFirst({
          where: { name, NOT: { id: profileId } },
        });
        if (existing) {
          return NextResponse.json({ error: 'Nama club sudah digunakan' }, { status: 409 });
        }
      }

      const profileUpdate: Record<string, unknown> = {};
      if (name) profileUpdate.name = name.trim();
      if (logo !== undefined) profileUpdate.logo = logo;
      if (bannerImage !== undefined) profileUpdate.bannerImage = bannerImage;

      await db.clubProfile.update({
        where: { id: profileId },
        data: profileUpdate,
      });
    }

    // Re-fetch updated profile
    const updatedProfile = await db.clubProfile.findUnique({ where: { id: profileId } });

    // If we originally found a Club entry, also return club-level data
    if (club) {
      const updatedClub = await db.club.findUnique({ where: { id: club.id } });

      revalidatePath('/');
      revalidatePath('/api/stats');
      revalidateTag('cms-content', 'max');
      revalidateTag('landing-stats', 'max');

      // ★ Pusher: notify all clients of club data change
      try {
        const { pusherTrigger, PUSHER_CHANNELS, PUSHER_EVENTS } = await import('@/lib/pusher');
        void pusherTrigger(PUSHER_CHANNELS.LEADERBOARD, PUSHER_EVENTS.LEADERBOARD_UPDATED, {});
        void pusherTrigger(PUSHER_CHANNELS.FEED, PUSHER_EVENTS.CLUB_MEMBER_CHANGED, {
          type: 'club-update',
          clubId: id,
        });
      } catch { /* non-critical */ }

      await createAuditLog({
        adminId: authResult.id,
        adminName: authResult.username,
        action: 'update',
        entity: 'club',
        entityId: id,
        details: `Update club "${profileName}"`,
      });

      return NextResponse.json({
        id: updatedClub!.id,
        profileId: updatedProfile!.id,
        name: updatedProfile!.name,
        logo: updatedProfile!.logo,
        bannerImage: updatedProfile!.bannerImage,
        division: updatedClub!.division,
        seasonId: updatedClub!.seasonId,
        wins: updatedClub!.wins,
        losses: updatedClub!.losses,
        points: updatedClub!.points,
        gameDiff: updatedClub!.gameDiff,
      });
    }

    // Return profile-level response for unified mode
    revalidatePath('/');
    revalidatePath('/api/stats');
    revalidateTag('cms-content', 'max');
    revalidateTag('landing-stats', 'max');

    // ★ Pusher: notify all clients of club data change
    try {
      const { pusherTrigger, PUSHER_CHANNELS, PUSHER_EVENTS } = await import('@/lib/pusher');
      void pusherTrigger(PUSHER_CHANNELS.LEADERBOARD, PUSHER_EVENTS.LEADERBOARD_UPDATED, {});
      void pusherTrigger(PUSHER_CHANNELS.FEED, PUSHER_EVENTS.CLUB_MEMBER_CHANGED, {
        type: 'club-update',
        clubId: id,
      });
    } catch { /* non-critical */ }

    await createAuditLog({
      adminId: authResult.id,
      adminName: authResult.username,
      action: 'update',
      entity: 'club',
      entityId: id,
      details: `Update club "${profileName}"`,
    });

    return NextResponse.json({
      id: updatedProfile!.id,
      profileId: updatedProfile!.id,
      name: updatedProfile!.name,
      logo: updatedProfile!.logo,
      bannerImage: updatedProfile!.bannerImage,
    });
  } catch (error) {
    console.error('[PUT /api/clubs/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to update club' }, { status: 500 });
  }
}

// DELETE /api/clubs/[id] — Delete club
// Accepts BOTH Club ID (season entry) and ClubProfile ID (unified mode)
// When deleting via ClubProfile ID: deletes ALL season entries + the profile itself
// When deleting via Club ID: deletes only that season entry (keeps profile)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;

    // Try to find as Club (season entry) first
    const club = await db.club.findUnique({ where: { id } });

    if (club) {
      // ID is a Club (season entry) ID — delete only this season entry
      // Fetch profile name for audit log
      const profileData = await db.clubProfile.findUnique({
        where: { id: club.profileId },
        select: { name: true },
      });
      const profileName = profileData?.name || '';

      await db.club.delete({ where: { id } });

      // Invalidate cache
      revalidatePath('/');
      revalidatePath('/api/stats');
      revalidateTag('cms-content', 'max');
      revalidateTag('landing-stats', 'max');

      await createAuditLog({
        adminId: authResult.id,
        adminName: authResult.username,
        action: 'delete',
        entity: 'club',
        entityId: id,
        details: `Menghapus club "${profileName}" dari season`,
      });

      return NextResponse.json({ success: true, message: `Club "${profileName}" berhasil dihapus dari season ini. Profil club dan anggota tetap tersimpan.` });
    }

    // Try as ClubProfile ID (unified mode)
    const profile = await db.clubProfile.findUnique({ where: { id } });

    if (!profile) {
      return NextResponse.json({ error: 'Club tidak ditemukan' }, { status: 404 });
    }

    const profileName = profile.name;

    // Delete all Club season entries for this profile
    await db.club.deleteMany({ where: { profileId: id } });

    // Delete the ClubProfile (cascade will remove ClubMember records)
    await db.clubProfile.delete({ where: { id } });

    // Invalidate cache
    revalidatePath('/');
    revalidatePath('/api/stats');
    revalidateTag('cms-content', 'max');
    revalidateTag('landing-stats', 'max');

    // ★ Pusher: notify all clients of club deletion
    try {
      const { pusherTrigger, PUSHER_CHANNELS, PUSHER_EVENTS } = await import('@/lib/pusher');
      void pusherTrigger(PUSHER_CHANNELS.LEADERBOARD, PUSHER_EVENTS.LEADERBOARD_UPDATED, {});
      void pusherTrigger(PUSHER_CHANNELS.FEED, PUSHER_EVENTS.CLUB_MEMBER_CHANGED, {
        type: 'club-deleted',
        clubId: id,
      });
    } catch { /* non-critical */ }

    await createAuditLog({
      adminId: authResult.id,
      adminName: authResult.username,
      action: 'delete',
      entity: 'club',
      entityId: id,
      details: `Menghapus club "${profileName}" beserta seluruh data season dan keanggotaan`,
    });

    return NextResponse.json({ success: true, message: `Club "${profileName}" berhasil dihapus secara permanen beserta seluruh season dan keanggotaannya.` });
  } catch (error: unknown) {
    console.error('[DELETE /api/clubs] Unexpected error:', error);
    return NextResponse.json({ error: 'Gagal menghapus club. Silakan coba lagi.' }, { status: 500 });
  }
}
