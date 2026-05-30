import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { NextResponse } from 'next/server';

// GET /api/livestreams — List streams (live first, then recent)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const division = searchParams.get('division');
    const liveOnly = searchParams.get('liveOnly') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const where: Record<string, unknown> = {};
    if (liveOnly) where.isLive = true;
    if (division && division !== 'all') {
      // Match streams with the specific division OR streams with no division (both)
      where.OR = [
        { division },
        { division: null },
      ];
    }

    const streams = await db.liveStream.findMany({
      where,
      orderBy: [
        { isLive: 'desc' },
        { startedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
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

    return NextResponse.json({ streams });
  } catch (error) {
    console.error('[LIVESTREAMS_GET]', error);
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}

// POST /api/livestreams — Create new stream (admin only)
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  try {
    const body = await request.json();
    const { title, platform, streamUrl, videoId, channelId, isLive, division, tournamentId, thumbnail, viewerCount } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Judul stream wajib diisi' }, { status: 400 });
    }
    if (!streamUrl || typeof streamUrl !== 'string') {
      return NextResponse.json({ error: 'URL stream wajib diisi' }, { status: 400 });
    }

    // Auto-detect platform from URL if not provided
    let resolvedPlatform = platform || 'youtube';
    let resolvedVideoId = videoId || null;
    let resolvedChannelId = channelId || null;

    const urlLower = streamUrl.toLowerCase();

    if (urlLower.includes('twitch.tv')) {
      resolvedPlatform = 'twitch';
      // Extract channel name from Twitch URL
      const twitchMatch = streamUrl.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
      if (twitchMatch && !resolvedChannelId) {
        resolvedChannelId = twitchMatch[1];
      }
    } else if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
      resolvedPlatform = 'youtube';
      // Extract video ID from YouTube URL
      if (!resolvedVideoId) {
        const ytMatch = streamUrl.match(
          /(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
        );
        if (ytMatch) {
          resolvedVideoId = ytMatch[1];
        }
      }
    }

    if (!['youtube', 'twitch'].includes(resolvedPlatform)) {
      return NextResponse.json({ error: 'Platform harus youtube atau twitch' }, { status: 400 });
    }

    const stream = await db.liveStream.create({
      data: {
        title,
        platform: resolvedPlatform,
        streamUrl,
        videoId: resolvedVideoId,
        channelId: resolvedChannelId,
        isLive: isLive ?? false,
        startedAt: isLive ? new Date() : null,
        division: division || null,
        tournamentId: tournamentId || null,
        thumbnail: thumbnail || null,
        viewerCount: viewerCount || null,
      },
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

    return NextResponse.json({ success: true, stream }, { status: 201 });
  } catch (error) {
    console.error('[LIVESTREAMS_POST]', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat membuat stream' }, { status: 500 });
  }
}
