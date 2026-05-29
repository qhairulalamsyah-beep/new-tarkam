import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

// GET all sections with their cards
export async function GET() {
  try {
    const sections = await db.cmsSection.findMany({
      orderBy: { order: 'asc' },
      include: {
        cards: {
          orderBy: { order: 'asc' },
        },
      },
    });

    // Prisma already includes cards via the relation, no need to rename
    // Sort cards within each section by order asc (already done in include)
    const sorted = sections.map((section) => ({
      ...section,
      cards: section.cards.sort((a, b) => (a.order || 0) - (b.order || 0)),
    }));

    return NextResponse.json(sorted, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error) {
    console.error('[GET /api/cms/sections] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch sections' }, { status: 500 });
  }
}

// POST create or update a section
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const body = await request.json();
  const { id, slug, title, subtitle, description, bannerUrl, isActive, order } = body;

  if (!slug) {
    return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
  }

  try {
    let section;

    if (id) {
      section = await db.cmsSection.update({
        where: { id },
        data: { slug, title, subtitle, description, bannerUrl, isActive, order },
      });
    } else {
      section = await db.cmsSection.create({
        data: { slug, title, subtitle, description, bannerUrl, isActive, order },
      });
    }

    // ★ Invalidate CDN + ISR cache so landing page shows updated CMS content immediately
    revalidatePath('/');
    revalidateTag('cms-content', 'max');
    revalidateTag('hero-data', 'max'); // ★ Hero section uses CMS data
    revalidatePath('/api/cms/content');

    return NextResponse.json(section);
  } catch (error) {
    console.error('[POST /api/cms/sections] Save error:', error);
    return NextResponse.json({ error: 'Failed to save section' }, { status: 500 });
  }
}

// DELETE a section
export async function DELETE(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    // Delete cards in this section first (cascade should handle this, but be safe)
    await db.cmsCard.deleteMany({ where: { sectionId: id } });

    // Then delete the section
    await db.cmsSection.delete({ where: { id } });

    // ★ Invalidate CDN + ISR cache
    revalidatePath('/');
    revalidateTag('cms-content', 'max');
    revalidateTag('hero-data', 'max'); // ★ Hero section uses CMS data
    revalidatePath('/api/cms/content');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/cms/sections] Error:', error);
    return NextResponse.json({ error: 'Failed to delete section' }, { status: 500 });
  }
}
