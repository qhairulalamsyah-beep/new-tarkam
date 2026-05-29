import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import crypto from 'crypto';

/**
 * POST /api/cloudinary/sign-upload
 * Generate a signed upload payload for client-side upload to Cloudinary.
 * Requires admin auth.
 *
 * Body: { folder?: string, publicId?: string, resourceType?: 'image' | 'video' }
 * Returns: { apiKey, timestamp, signature, folder, publicId, cloudName, resourceType }
 */
export async function POST(request: NextRequest) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  // Auth check — require admin
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { folder = 'general', publicId, resourceType = 'image' } = body;

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Cloudinary not configured — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET' },
        { headers, status: 500 }
      );
    }

    // Generate timestamp (Unix time in seconds)
    const timestamp = Math.floor(Date.now() / 1000);

    // Build the string to sign
    // Cloudinary requires parameters sorted ALPHABETICALLY by key name.
    // Order: folder → public_id → timestamp
    // Then append the API secret.
    const paramsToSign: Record<string, string> = {
      folder,
      timestamp: String(timestamp),
    };
    if (publicId) {
      paramsToSign.public_id = publicId;
    }
    // Sort keys alphabetically and build the string
    const sortedKeys = Object.keys(paramsToSign).sort();
    const stringToSign = sortedKeys.map(k => `${k}=${paramsToSign[k]}`).join('&') + apiSecret;

    // Generate SHA1 signature
    const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

    return NextResponse.json({
      apiKey,
      timestamp,
      signature,
      folder,
      publicId: publicId || undefined,
      cloudName,
      resourceType,
    }, { headers });
  } catch (error: unknown) {
    console.error('[Sign Upload] Error:', error);
    const message = error instanceof Error ? error.message : 'Gagal membuat signature';
    return NextResponse.json(
      { error: message },
      { headers, status: 500 }
    );
  }
}
