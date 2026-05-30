import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { NextResponse } from 'next/server';

// PATCH /api/livestreams/[id] — Update stream (admin only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  try {
    const { id } = await params;
    const body = await request.json();
    const { title, platform, streamUrl, videoId, channelId, isLive, division, tournamentId, thumbnail, viewerCount } = body;

    const existing = await db.liveStream.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Stream tidak ditemukan' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (platform !== undefined) updateData.platform = platform;
    if (streamUrl !== undefined) {
      updateData.streamUrl = streamUrl;
      // Re-detect platform from URL
      const urlLower = streamUrl.toLowerCase();
      if (urlLower.includes('twitch.tv')) {
        updateData.platform = 'twitch';
        const twitchMatch = streamUrl.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
        if (twitchMatch && !channelId) {
          updateData.channelId = twitchMatch[1];
        }
      } else if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
        updateData.platform = 'youtube';
        const ytMatch = streamUrl.match(
          /(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
        );
        if (ytMatch && !videoId) {
          updateData.videoId = ytMatch[1];
        }
      }
    }
    if (videoId !== undefined) updateData.videoId = videoId;
    if (channelId !== undefined) updateData.channelId = channelId;
    if (division !== undefined) updateData.division = division || null;
    if (tournamentId !== undefined) updateData.tournamentId = tournamentId || null;
    if (thumbnail !== undefined) updateData.thumbnail = thumbnail || null;
    if (viewerCount !== undefined) updateData.viewerCount = viewerCount;

    // Handle isLive toggle
    if (isLive !== undefined) {
      updateData.isLive = isLive;
      if (isLive && !existing.startedAt) {
        updateData.startedAt = new Date();
      }
      if (!isLive) {
        updateData.startedAt = null;
      }
    }

    const stream = await db.liveStream.update({
      where: { id },
      data: updateData,
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            weekNumber: true,
            division: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, stream });
  } catch (error) {
    console.error('[LIVESTREAMS_PATCH]', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat memperbarui stream' }, { status: 500 });
  }
}

// DELETE /api/livestreams/[id] — Remove stream (admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  try {
    const { id } = await params;

    const existing = await db.liveStream.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Stream tidak ditemukan' }, { status: 404 });
    }

    await db.liveStream.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Stream berhasil dihapus' });
  } catch (error) {
    console.error('[LIVESTREAMS_DELETE]', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat menghapus stream' }, { status: 500 });
  }
}
