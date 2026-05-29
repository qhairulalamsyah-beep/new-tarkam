import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

/**
 * GET /api/cloudinary/images
 * Lists images from Cloudinary using the Admin API. Requires admin auth.
 * Query params: max_results, prefix, next_cursor
 */
export async function GET(request: NextRequest) {
  const headers = new Headers();
  headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  headers.set('Surrogate-Key', 'league-data');

  // Auth check — require admin
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Cloudinary not configured — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET' },
        { headers, status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const maxResults = searchParams.get('max_results') || '50';
    const prefix = searchParams.get('prefix') || searchParams.get('folder') || '';
    const nextCursor = searchParams.get('next_cursor') || '';

    // Build Cloudinary Admin API URL
    const params = new URLSearchParams({
      max_results: maxResults,
    });
    if (prefix) params.set('prefix', prefix);
    if (nextCursor) params.set('next_cursor', nextCursor);

    // Fetch both image and video resources in parallel
    const [imageRes, videoRes] = await Promise.all([
      fetch(`https://api.cloudinary.com/v1_1/${cloudName}/resources/image?${params.toString()}`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
        },
      }),
      fetch(`https://api.cloudinary.com/v1_1/${cloudName}/resources/video?${params.toString()}`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
        },
      }).catch(() => null), // Video may not exist, gracefully handle
    ]);

    const imageData = imageRes.ok ? await imageRes.json() : { resources: [] };
    const videoData = videoRes && videoRes.ok ? await videoRes.json() : { resources: [] };

    // Merge and transform resources
    const allResources = [
      ...(imageData.resources || []),
      ...(videoData.resources || []),
    ].map((res: any) => ({
      public_id: res.public_id,
      url: res.secure_url,
      width: res.width || 0,
      height: res.height || 0,
      format: res.format || '',
      bytes: res.bytes || 0,
      created_at: res.created_at || '',
      resourceType: res.resource_type || 'image',
      duration: res.duration || undefined,
    }));

    // Sort by creation date descending
    allResources.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({
      images: allResources,
      provider: 'cloudinary',
      next_cursor: imageData.next_cursor || videoData?.next_cursor || null,
    }, { headers });
  } catch (error: unknown) {
    console.error('[Cloudinary Images] List error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { headers, status: 500 }
    );
  }
}

/**
 * POST /api/cloudinary/images — Get folders list from Cloudinary. Requires admin auth.
 */
export async function POST(request: NextRequest) {
  // Auth check — require admin
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { action } = body;

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Cloudinary not configured' },
        { status: 500 }
      );
    }

    if (action === 'get_folders') {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/folders?max_results=100`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        return NextResponse.json({ error: err.error?.message || 'Failed to fetch folders' }, { status: res.status });
      }

      const data = await res.json();
      return NextResponse.json({
        provider: 'cloudinary',
        folders: (data.folders || []).map((f: any) => ({
          name: f.name,
          path: f.path,
        })),
      });
    }

    if (action === 'get_sub_folders') {
      const { parentFolder } = body;
      if (!parentFolder) {
        return NextResponse.json({ error: 'parentFolder required' }, { status: 400 });
      }

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/folders/${parentFolder}?max_results=100`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        return NextResponse.json({ error: err.error?.message || 'Failed to fetch sub-folders' }, { status: res.status });
      }

      const data = await res.json();
      return NextResponse.json({
        provider: 'cloudinary',
        folders: (data.folders || []).map((f: any) => ({
          name: f.name,
          path: f.path,
        })),
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[Cloudinary Images] Folders error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
