import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPlayer, verifyAdmin } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const VALID_TARGET_TYPES = ['match', 'tournament', 'player', 'highlight'];

// GET /api/comments?targetType=&targetId=&cursor=&limit= — Get comments for target
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get('targetType');
    const targetId = searchParams.get('targetId');
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    if (!targetType || !targetId) {
      return NextResponse.json({ error: 'targetType and targetId are required' }, { status: 400 });
    }

    if (!VALID_TARGET_TYPES.includes(targetType)) {
      return NextResponse.json({ error: 'Invalid targetType' }, { status: 400 });
    }

    // Build where clause: top-level comments only (no parentId), not deleted
    const where: any = { targetType, targetId, parentId: null, isDeleted: false };
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
    }

    // Fetch comments with replies and account info
    const comments = await db.comment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        account: {
          select: {
            id: true,
            username: true,
            player: {
              select: {
                id: true,
                gamertag: true,
                avatar: true,
                division: true,
                tier: true,
              },
            },
          },
        },
        replies: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'asc' },
          include: {
            account: {
              select: {
                id: true,
                username: true,
                player: {
                  select: {
                    id: true,
                    gamertag: true,
                    avatar: true,
                    division: true,
                    tier: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const hasMore = comments.length > limit;
    const items = hasMore ? comments.slice(0, limit) : comments;

    // Get total count
    const total = await db.comment.count({
      where: { targetType, targetId, isDeleted: false },
    });

    // Get current user for ownership info
    const player = await verifyPlayer(request);
    const currentAccountId = player?.id || null;

    const formatComment = (c: any) => ({
      id: c.id,
      content: c.content,
      targetType: c.targetType,
      targetId: c.targetId,
      parentId: c.parentId,
      isDeleted: c.isDeleted,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      isOwn: currentAccountId ? c.accountId === currentAccountId : false,
      author: c.account ? {
        id: c.account.id,
        username: c.account.username,
        gamertag: c.account.player?.gamertag || null,
        avatar: c.account.player?.avatar || null,
        division: c.account.player?.division || null,
        tier: c.account.player?.tier || null,
      } : null,
    });

    return NextResponse.json({
      comments: items.map(c => ({
        ...formatComment(c),
        replies: c.replies.map(formatComment),
      })),
      total,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1].createdAt.toISOString() : null,
    });
  } catch (error) {
    console.error('[COMMENTS] GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

// POST /api/comments — Add a comment
export async function POST(request: NextRequest) {
  try {
    const player = await verifyPlayer(request);
    if (!player) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }

    const body = await request.json();
    const { content, targetType, targetId, parentId } = body;

    if (!content || !targetType || !targetId) {
      return NextResponse.json({ error: 'content, targetType, and targetId are required' }, { status: 400 });
    }

    if (content.length > 1000) {
      return NextResponse.json({ error: 'Comment too long (max 1000 characters)' }, { status: 400 });
    }

    if (!VALID_TARGET_TYPES.includes(targetType)) {
      return NextResponse.json({ error: 'Invalid targetType' }, { status: 400 });
    }

    // If replying, verify parent exists and belongs to same target
    if (parentId) {
      const parent = await db.comment.findUnique({ where: { id: parentId } });
      if (!parent || parent.isDeleted) {
        return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 });
      }
      if (parent.targetType !== targetType || parent.targetId !== targetId) {
        return NextResponse.json({ error: 'Parent comment does not belong to this target' }, { status: 400 });
      }
      // Only allow one level of nesting (no replies to replies)
      if (parent.parentId) {
        return NextResponse.json({ error: 'Cannot reply to a reply — only one level of nesting' }, { status: 400 });
      }
    }

    const comment = await db.comment.create({
      data: {
        content: content.trim(),
        targetType,
        targetId,
        accountId: player.id,
        playerId: player.playerId,
        parentId: parentId || null,
      },
      include: {
        account: {
          select: {
            id: true,
            username: true,
            player: {
              select: {
                id: true,
                gamertag: true,
                avatar: true,
                division: true,
                tier: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      comment: {
        id: comment.id,
        content: comment.content,
        targetType: comment.targetType,
        targetId: comment.targetId,
        parentId: comment.parentId,
        isDeleted: comment.isDeleted,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
        isOwn: true,
        author: comment.account ? {
          id: comment.account.id,
          username: comment.account.username,
          gamertag: comment.account.player?.gamertag || null,
          avatar: comment.account.player?.avatar || null,
          division: comment.account.player?.division || null,
          tier: comment.account.player?.tier || null,
        } : null,
      },
    });
  } catch (error) {
    console.error('[COMMENTS] POST Error:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}
