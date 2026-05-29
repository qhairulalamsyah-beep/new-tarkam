// ─── Club Queries ───
// Drop-in replacements for fetch('/api/clubs/...') calls
// Delegates to the existing API routes which use Prisma/Neon

// ── GET /api/clubs ──
export async function getClubs(params?: { seasonId?: string; division?: string; unified?: boolean }) {
  const searchParams = new URLSearchParams()
  if (params?.seasonId) searchParams.set('seasonId', params.seasonId)
  if (params?.division) searchParams.set('division', params.division)
  if (params?.unified) searchParams.set('unified', 'true')

  const response = await fetch(`/api/clubs?${searchParams.toString()}`)
  if (!response.ok) return []
  const data = await response.json()
  return data.clubs || data || []
}

// ── GET /api/clubs/[id] ──
export async function getClubById(id: string) {
  const response = await fetch(`/api/clubs/${id}`)
  if (!response.ok) throw new Error('Club not found')
  return response.json()
}

// ── GET /api/clubs/[id]/members ──
export async function getClubMembers(clubId: string) {
  const response = await fetch(`/api/clubs/${clubId}/members`)
  if (!response.ok) return []
  const data = await response.json()
  return data.members || data || []
}

// ── GET /api/clubs/leaderboard ──
export async function getClubLeaderboard(params?: { type?: 'tarkam' | 'liga' }) {
  const searchParams = new URLSearchParams()
  if (params?.type) searchParams.set('type', params.type)

  const response = await fetch(`/api/clubs/leaderboard?${searchParams.toString()}`)
  if (!response.ok) return { clubs: [], type: params?.type || 'tarkam' }
  return response.json()
}

// ── GET /api/clubs/unified-profile ──
export async function getClubUnifiedProfile(clubId: string) {
  const response = await fetch(`/api/clubs/unified-profile?clubId=${clubId}`)
  if (!response.ok) throw new Error('Failed to fetch club unified profile')
  return response.json()
}
