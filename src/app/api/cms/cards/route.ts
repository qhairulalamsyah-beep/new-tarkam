import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

// GET cards (optionally filter by sectionId)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get('sectionId');

  try {
    const cards = await db.cmsCard.findMany({
      where: sectionId ? { sectionId } : undefined,
      orderBy: { order: 'asc' },
      include: {
        section: {
          select: { slug: true, title: true },
        },
      },
    });

    // Prisma already returns section relation, no need to rename
    return NextResponse.json(cards, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error) {
    console.error('[GET /api/cms/cards] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 });
  }
}

// POST create or update a card
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const body = await request.json();
  const { id, sectionId, title, subtitle, description, imageUrl, videoUrl, linkUrl, tag, tagColor, isActive, order } = body;

  if (!sectionId) {
    return NextResponse.json({ error: 'sectionId is required' }, { status: 400 });
  }

  const cardData = { sectionId, title, subtitle, description, imageUrl, videoUrl, linkUrl, tag, tagColor, isActive, order };

  try {
    let card;

    if (id) {
      // Try update first, fall back to create if not found
      try {
        card = await db.cmsCard.update({
          where: { id },
          data: cardData,
        });
      } catch {
        // Record not found — create instead
        card = await db.cmsCard.create({ data: cardData });
      }
    } else {
      card = await db.cmsCard.create({ data: cardData });
    }

    // ★ Invalidate CDN + ISR cache so landing page shows updated CMS content immediately
    revalidatePath('/');
    revalidateTag('cms-content', 'max');
    revalidateTag('hero-data', 'max'); // ★ Hero section uses CMS data
    revalidatePath('/api/cms/content');

    return NextResponse.json(card);
  } catch (error) {
    console.error('[POST /api/cms/cards] Save error:', error);
    return NextResponse.json({ error: 'Failed to save card' }, { status: 500 });
  }
}

// DELETE a card
export async function DELETE(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    await db.cmsCard.delete({ where: { id } });

    // ★ Invalidate CDN + ISR cache
    revalidatePath('/');
    revalidateTag('cms-content', 'max');
    revalidateTag('hero-data', 'max'); // ★ Hero section uses CMS data
    revalidatePath('/api/cms/content');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/cms/cards] Error:', error);
    return NextResponse.json({ error: 'Failed to delete card' }, { status: 500 });
  }
}
