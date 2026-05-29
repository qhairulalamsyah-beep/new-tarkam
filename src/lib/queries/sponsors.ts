// ─── Sponsor Queries ───
// Drop-in replacements for fetch('/api/sponsors/...') calls
// Delegates to the existing API routes which use Prisma/Neon

// ── GET /api/sponsors ──
export async function getSponsors(params?: { tier?: string; activeOnly?: boolean }) {
  const searchParams = new URLSearchParams()
  if (params?.tier) searchParams.set('tier', params.tier)
  if (params?.activeOnly) searchParams.set('activeOnly', 'true')

  const response = await fetch(`/api/sponsors?${searchParams.toString()}`)
  if (!response.ok) return { sponsors: [] }
  return response.json()
}

// ── GET /api/sponsors/banners ──
export async function getSponsorBanners(params?: { placement?: string; activeOnly?: boolean }) {
  const searchParams = new URLSearchParams()
  if (params?.placement) searchParams.set('placement', params.placement)
  if (params?.activeOnly) searchParams.set('activeOnly', 'true')

  const response = await fetch(`/api/sponsors/banners?${searchParams.toString()}`)
  if (!response.ok) return { banners: [] }
  return response.json()
}

// ── GET /api/sponsors/prizes ──
export async function getSponsoredPrizes(params?: {
  sponsorId?: string
  tournamentId?: string
  activeOnly?: boolean
}) {
  const searchParams = new URLSearchParams()
  if (params?.sponsorId) searchParams.set('sponsorId', params.sponsorId)
  if (params?.tournamentId) searchParams.set('tournamentId', params.tournamentId)
  if (params?.activeOnly) searchParams.set('activeOnly', 'true')

  const response = await fetch(`/api/sponsors/prizes?${searchParams.toString()}`)
  if (!response.ok) return { prizes: [] }
  return response.json()
}
