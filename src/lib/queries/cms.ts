// ─── CMS Queries ───
// Drop-in replacements for fetch('/api/cms/...') calls
// Delegates to the existing API routes which use Prisma/Neon
// ★ All fetches use cache: 'no-store' to prevent stale CDN/browser cache
//    after admin uploads and edits.

// ── GET /api/cms/content ──
export async function getCmsContent() {
  const response = await fetch('/api/cms/content', { cache: 'no-store' })
  if (!response.ok) return { settings: {}, sections: {} }
  return response.json()
}

// ── GET /api/cms/sections ──
export async function getCmsSections() {
  const response = await fetch('/api/cms/sections', { cache: 'no-store' })
  if (!response.ok) return []
  const data = await response.json()
  return data.sections || data || []
}

// ── GET /api/cms/cards ──
export async function getCmsCards(params?: { sectionId?: string }) {
  const searchParams = new URLSearchParams()
  if (params?.sectionId) searchParams.set('sectionId', params.sectionId)

  const response = await fetch(`/api/cms/cards?${searchParams.toString()}`, { cache: 'no-store' })
  if (!response.ok) return []
  const data = await response.json()
  return data.cards || data || []
}

// ── GET /api/cms/settings ──
export async function getCmsSettings() {
  const response = await fetch('/api/cms/settings', { cache: 'no-store' })
  if (!response.ok) return { settings: [], map: {} }
  return response.json()
}
