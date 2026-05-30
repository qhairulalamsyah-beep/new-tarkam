import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPlayer } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const VALID_REACTION_TYPES = ['fire', 'heart', 'clap', 'laugh', 'shock', 'trophy'];
const VALID_TARGET_TYPES = ['match', 'tournament', 'player', 'highlight'];

// GET /api/reactions?targetType=&targetId= — Get reaction counts for a target
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get('targetType');
    const targetId = searchParams.get('targetId');

    if (!targetType || !targetId) {
      return NextResponse.json({ error: 'targetType and targetId are required' }, { status: 400 });
    }

    if (!VALID_TARGET_TYPES.includes(targetType)) {
      return NextResponse.json({ error: 'Invalid targetType' }, { status: 400 });
    }

    // Get all reactions for this target grouped by type
    const reactions = await db.reaction.findMany({
      where: { targetType, targetId },
      select: {
        type: true,
        accountId: true,
      },
    });

    // Group by type with counts
    const counts: Record<string, number> = {};
    for (const r of reactions) {
      counts[r.type] = (counts[r.type] || 0) + 1;
    }

    // Get current user's reactions if logged in
    const player = await verifyPlayer(request);
    let myReactions: string[] = [];
    if (player) {
      myReactions = reactions
        .filter(r => r.accountId === player.id)
        .map(r => r.type);
    }

    return NextResponse.json({
      targetType,
      targetId,
      counts,
      myReactions,
      total: reactions.length,
    });
  } catch (error) {
    console.error('[REACTIONS] GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch reactions' }, { status: 500 });
  }
}

// POST /api/reactions — Toggle reaction (add if not exists, remove if exists)
export async function POST(request: NextRequest) {
  try {
    const player = await verifyPlayer(request);
    if (!player) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }

    const body = await request.json();
    const { type, targetType, targetId } = body;

    if (!type || !targetType || !targetId) {
      return NextResponse.json({ error: 'type, targetType, and targetId are required' }, { status: 400 });
    }

    if (!VALID_REACTION_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Invalid reaction type' }, { status: 400 });
    }

    if (!VALID_TARGET_TYPES.includes(targetType)) {
      return NextResponse.json({ error: 'Invalid targetType' }, { status: 400 });
    }

    // Toggle: if reaction exists, remove it; otherwise, create it
    const existing = await db.reaction.findUnique({
      where: {
        targetType_targetId_accountId_type: {
          targetType,
          targetId,
          accountId: player.id,
          type,
        },
      },
    });

    if (existing) {
      // Remove the reaction (unreact)
      await db.reaction.delete({ where: { id: existing.id } });

      // Get updated counts
      const counts = await getReactionCounts(targetType, targetId);
      const myReactions = await getMyReactions(targetType, targetId, player.id);

      return NextResponse.json({
        action: 'removed',
        removedType: type,
        counts,
        myReactions,
      });
    } else {
      // Add the reaction
      await db.reaction.create({
        data: {
          type,
          targetType,
          targetId,
          accountId: player.id,
          playerId: player.playerId,
        },
      });

      const counts = await getReactionCounts(targetType, targetId);
      const myReactions = await getMyReactions(targetType, targetId, player.id);

      return NextResponse.json({
        action: 'added',
        addedType: type,
        counts,
        myReactions,
      });
    }
  } catch (error) {
    console.error('[REACTIONS] POST Error:', error);
    return NextResponse.json({ error: 'Failed to toggle reaction' }, { status: 500 });
  }
}

// DELETE /api/reactions — Remove specific reaction
export async function DELETE(request: NextRequest) {
  try {
    const player = await verifyPlayer(request);
    if (!player) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const targetType = searchParams.get('targetType');
    const targetId = searchParams.get('targetId');

    if (!type || !targetType || !targetId) {
      return NextResponse.json({ error: 'type, targetType, and targetId are required' }, { status: 400 });
    }

    const existing = await db.reaction.findUnique({
      where: {
        targetType_targetId_accountId_type: {
          targetType,
          targetId,
          accountId: player.id,
          type,
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Reaction not found' }, { status: 404 });
    }

    await db.reaction.delete({ where: { id: existing.id } });

    const counts = await getReactionCounts(targetType, targetId);
    const myReactions = await getMyReactions(targetType, targetId, player.id);

    return NextResponse.json({
      action: 'removed',
      removedType: type,
      counts,
      myReactions,
    });
  } catch (error) {
    console.error('[REACTIONS] DELETE Error:', error);
    return NextResponse.json({ error: 'Failed to remove reaction' }, { status: 500 });
  }
}

// Helper: get reaction counts for a target
async function getReactionCounts(targetType: string, targetId: string): Promise<Record<string, number>> {
  const reactions = await db.reaction.findMany({
    where: { targetType, targetId },
    select: { type: true },
  });

  const counts: Record<string, number> = {};
  for (const r of reactions) {
    counts[r.type] = (counts[r.type] || 0) + 1;
  }
  return counts;
}

// Helper: get current user's reactions for a target
async function getMyReactions(targetType: string, targetId: string, accountId: string): Promise<string[]> {
  const reactions = await db.reaction.findMany({
    where: { targetType, targetId, accountId },
    select: { type: true },
  });
  return reactions.map(r => r.type);
}
