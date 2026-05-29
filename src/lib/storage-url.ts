// ─── Storage URL Helpers ───
// ★ ZERO external SDK imports — safe for client bundle.
// Used by Next.js Image loaders and components that need to
// parse/construct legacy Supabase Storage URLs (for backward compat).
// New uploads use Cloudinary — these helpers handle old images.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

/**
 * Check if a URL is a legacy Supabase Storage URL.
 */
export function isSupabaseStorageUrl(url: string): boolean {
  if (!url) return false
  const supabaseHost = SUPABASE_URL?.replace('https://', '') || ''
  return url.includes(supabaseHost) && url.includes('/storage/v1/object/public/')
}

/**
 * Extract bucket and path from a legacy Supabase Storage public URL.
 * E.g. "https://xxx.supabase.co/storage/v1/object/public/avatars/players/123.webp"
 *   → { bucket: 'avatars', path: 'players/123.webp' }
 */
export function parseSupabaseStorageUrl(url: string): { bucket: string; path: string } | null {
  if (!isSupabaseStorageUrl(url)) return null

  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/)
  if (!match) return null

  return { bucket: match[1], path: match[2] }
}

/**
 * Convert a legacy Supabase Storage object URL to a render (transformation) URL.
 *   /storage/v1/object/public/{bucket}/{path}
 *   → /storage/v1/render/image/public/{bucket}/{path}?width=640&quality=80
 */
export function toRenderUrl(objectUrl: string, width: number, quality?: number): string {
  const match = objectUrl.match(
    /\/storage\/v1\/object\/public\/([^/]+\/.+)$/
  )

  if (!match) {
    return objectUrl
  }

  const bucketAndPath = match[1]

  const params = new URLSearchParams()
  params.set('width', Math.min(width, 1920).toString())

  if (quality) {
    params.set('quality', Math.min(quality, 85).toString())
  }

  params.set('format', 'auto')

  return `${SUPABASE_URL}/storage/v1/render/image/public/${bucketAndPath}?${params.toString()}`
}
