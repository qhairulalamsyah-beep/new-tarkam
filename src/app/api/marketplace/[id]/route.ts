import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';

const VALID_CATEGORIES = ['ava', 'item', 'char', 'jasa', 'dll'];

// GET /api/marketplace/[id] — Get marketplace item by ID
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const item = await db.marketplaceItem.findUnique({ where: { id } });

    if (!item) {
      return NextResponse.json(
        { error: 'Marketplace item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Error fetching marketplace item:', error);
    return NextResponse.json(
      { error: 'Failed to fetch marketplace item' },
      { status: 500 }
    );
  }
}

// DELETE /api/marketplace/[id] — Soft delete a marketplace item (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;

    const existingItem = await db.marketplaceItem.findUnique({ where: { id } });

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Marketplace item not found' },
        { status: 404 }
      );
    }

    // Soft delete: set isActive to false
    const updated = await db.marketplaceItem.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('Error deleting marketplace item:', error);
    return NextResponse.json(
      { error: 'Failed to delete marketplace item' },
      { status: 500 }
    );
  }
}

// PATCH /api/marketplace/[id] — Update a marketplace item (admin only)
// Supports: update fields, approve, reject
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;

    const existingItem = await db.marketplaceItem.findUnique({ where: { id } });

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Marketplace item not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { sellerName, sellerAvatar, sellerWhatsapp, title, description, price, category, imageUrl, images, isPremium, isActive, status } = body;

    // Validate category if provided
    if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate price if provided
    if (price !== undefined && (typeof price !== 'number' || price < 0 || !Number.isInteger(price))) {
      return NextResponse.json(
        { error: 'Price must be a non-negative integer' },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (status !== undefined && !['pending', 'approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: pending, approved, or rejected' },
        { status: 400 }
      );
    }

    // Validate images array if provided (max 5)
    let imagesJson: string | null | undefined = undefined;
    if (images !== undefined) {
      if (Array.isArray(images)) {
        const validImages = images.filter((url: string) => typeof url === 'string' && url.trim()).slice(0, 5);
        imagesJson = validImages.length > 0 ? JSON.stringify(validImages) : null;
      } else {
        imagesJson = null;
      }
    }

    const updateData: Record<string, unknown> = {};
    if (sellerName !== undefined) updateData.sellerName = sellerName;
    if (sellerAvatar !== undefined) updateData.sellerAvatar = sellerAvatar;
    if (sellerWhatsapp !== undefined) updateData.sellerWhatsapp = sellerWhatsapp;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (category !== undefined) updateData.category = category;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (imagesJson !== undefined) updateData.images = imagesJson;
    if (isPremium !== undefined) updateData.isPremium = isPremium;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (status !== undefined) updateData.status = status;

    const updated = await db.marketplaceItem.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('Error updating marketplace item:', error);
    return NextResponse.json(
      { error: 'Failed to update marketplace item' },
      { status: 500 }
    );
  }
}

// PUT /api/marketplace/[id] — Update a marketplace item (admin only, alternative endpoint)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Reuse PATCH logic
  return PATCH(request, { params });
}
