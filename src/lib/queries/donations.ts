// ─── Donation Queries ───
// Drop-in replacements for fetch('/api/donations/...') calls
// Delegates to the existing API routes which use Prisma/Neon

// ── GET /api/donations ──
export async function getDonations(params?: {
  type?: 'weekly' | 'season'
  seasonId?: string
  tournamentId?: string
  status?: 'pending' | 'approved' | 'rejected' | 'all'
  division?: 'male' | 'female'
  limit?: number
}) {
  const searchParams = new URLSearchParams()
  if (params?.type) searchParams.set('type', params.type)
  if (params?.seasonId) searchParams.set('seasonId', params.seasonId)
  if (params?.tournamentId) searchParams.set('tournamentId', params.tournamentId)
  if (params?.status) searchParams.set('status', params.status)
  if (params?.division) searchParams.set('division', params.division)
  if (params?.limit) searchParams.set('limit', String(params.limit))

  const response = await fetch(`/api/donations?${searchParams.toString()}`)
  if (!response.ok) {
    return {
      donations: [],
      total: { amount: 0, count: 0 },
    }
  }
  return response.json()
}

// ── GET /api/donations/top ──
export async function getTopDonors(params?: { limit?: number }) {
  const searchParams = new URLSearchParams()
  if (params?.limit) searchParams.set('limit', String(params.limit))

  const response = await fetch(`/api/donations/top?${searchParams.toString()}`)
  if (!response.ok) return []
  const data = await response.json()
  return data.donors || data || []
}

// ── GET /api/donations/top-donors ──
export async function getTopDonorsDetailed() {
  const response = await fetch('/api/donations/top-donors')
  if (!response.ok) {
    return {
      donors: [],
      summary: { totalAmount: 0, totalDonors: 0, totalDonations: 0 },
    }
  }
  return response.json()
}
