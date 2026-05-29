// ─── Match Queries ───
// Drop-in replacements for fetch('/api/matches/...') calls
// Delegates to the existing API routes which use Prisma/Neon

// ── GET /api/matches ──
export async function getMatches(params?: {
  tournamentId?: string
  status?: string
  round?: number
  page?: number
  limit?: number
}) {
  const searchParams = new URLSearchParams()
  if (params?.tournamentId) searchParams.set('tournamentId', params.tournamentId)
  if (params?.status) searchParams.set('status', params.status)
  if (params?.round) searchParams.set('round', String(params.round))
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.limit) searchParams.set('limit', String(params.limit))

  const response = await fetch(`/api/matches?${searchParams.toString()}`)
  if (!response.ok) {
    return {
      success: false,
      data: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    }
  }
  return response.json()
}

// ── GET /api/matches/live ──
export async function getLiveMatches(params?: { division?: string }) {
  const searchParams = new URLSearchParams()
  if (params?.division) searchParams.set('division', params.division)

  const response = await fetch(`/api/matches/live?${searchParams.toString()}`)
  if (!response.ok) return { matches: [], count: 0, hasLive: false }
  return response.json()
}

// ── GET /api/matches/recent ──
export async function getRecentMatches(params?: { division?: string; bracket?: string; limit?: number }) {
  const searchParams = new URLSearchParams()
  if (params?.division) searchParams.set('division', params.division)
  if (params?.bracket) searchParams.set('bracket', params.bracket)
  if (params?.limit) searchParams.set('limit', String(params.limit))

  const response = await fetch(`/api/matches/recent?${searchParams.toString()}`)
  if (!response.ok) return { matches: [] }
  return response.json()
}

// ── GET /api/matches/next ──
export async function getNextMatches(params?: { division?: string }) {
  const searchParams = new URLSearchParams()
  if (params?.division) searchParams.set('division', params.division)

  const response = await fetch(`/api/matches/next?${searchParams.toString()}`)
  if (!response.ok) return { liveCount: 0, nextMatch: null, recentResults: [] }
  return response.json()
}

// ── GET /api/matches/live-count ──
export async function getLiveMatchCount(params?: { division?: string }) {
  const searchParams = new URLSearchParams()
  if (params?.division) searchParams.set('division', params.division)

  const response = await fetch(`/api/matches/live-count?${searchParams.toString()}`)
  if (!response.ok) {
    return {
      activeTournaments: 0,
      completedMatches: 0,
      upcomingMatches: 0,
      liveNow: false,
    }
  }
  return response.json()
}
