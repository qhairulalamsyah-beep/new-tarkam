import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPlayer, verifyAdmin } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// DELETE /api/comments/[id] — Soft delete comment (owner or admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const comment = await db.comment.findUnique({ where: { id } });
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    if (comment.isDeleted) {
      return NextResponse.json({ error: 'Comment already deleted' }, { status: 400 });
    }

    // Check authorization: owner or admin
    const player = await verifyPlayer(request);
    const admin = await verifyAdmin(request);

    const isOwner = player && comment.accountId === player.id;
    const isAdmin = admin !== null;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized — only the comment owner or admin can delete' }, { status: 403 });
    }

    // Soft delete
    await db.comment.update({
      where: { id },
      data: {
        isDeleted: true,
        content: '[deleted]',
      },
    });

    return NextResponse.json({ success: true, action: 'deleted' });
  } catch (error) {
    console.error('[COMMENTS] DELETE Error:', error);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}
