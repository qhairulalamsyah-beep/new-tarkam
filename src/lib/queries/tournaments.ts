// ─── Tournament Queries ───
// Drop-in replacements that delegate to the existing Prisma-based API routes.
// The API routes are connected to
// the Neon database via Prisma, so all data flows through the correct source.

// ── GET /api/tournaments ──
export async function getTournaments(params?: {
  division?: string
  seasonId?: string
  status?: string
}) {
  try {
    const searchParams = new URLSearchParams()
    if (params?.division) searchParams.set('division', params.division)
    if (params?.seasonId) searchParams.set('seasonId', params.seasonId)
    if (params?.status) searchParams.set('status', params.status)

    const qs = searchParams.toString()
    const response = await fetch(`/api/tournaments${qs ? `?${qs}` : ''}`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('Failed to fetch tournaments:', response.status, response.statusText)
      return []
    }

    const result = await response.json()
    // API may return the array directly or wrapped in { data: [...] }
    return Array.isArray(result) ? result : (result.data || [])
  } catch (error) {
    console.error('Error fetching tournaments:', error)
    return []
  }
}

// ── GET /api/tournaments/[id] ──
export async function getTournamentById(id: string) {
  try {
    const response = await fetch(`/api/tournaments/${id}`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('Failed to fetch tournament by ID:', response.status, response.statusText)
      throw new Error('Tournament not found')
    }

    return response.json()
  } catch (error) {
    if (error instanceof Error && error.message === 'Tournament not found') throw error
    console.error('Error fetching tournament by ID:', error)
    throw new Error('Failed to fetch tournament')
  }
}

// ── GET /api/tournaments/[id]/participants ──
export async function getTournamentParticipants(tournamentId: string) {
  try {
    const response = await fetch(`/api/tournaments/${tournamentId}/participants`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('Failed to fetch tournament participants:', response.status, response.statusText)
      return { success: true, data: [] }
    }

    const result = await response.json()
    // API may return { success, data } or just an array
    if (Array.isArray(result)) {
      return { success: true, data: result }
    }
    return result
  } catch (error) {
    console.error('Error fetching tournament participants:', error)
    return { success: true, data: [] }
  }
}

// ── GET /api/tournaments/overview ──
export async function getTournamentOverview(params?: { division?: string }) {
  try {
    const searchParams = new URLSearchParams()
    if (params?.division) searchParams.set('division', params.division)

    const qs = searchParams.toString()
    const response = await fetch(`/api/tournaments/overview${qs ? `?${qs}` : ''}`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('Failed to fetch tournament overview:', response.status, response.statusText)
      return {
        hasTournament: false,
        division: params?.division || 'semua',
        playerCount: 0,
        clubCount: 0,
        message: 'Gagal memuat data tournament',
      }
    }

    return response.json()
  } catch (error) {
    console.error('Error fetching tournament overview:', error)
    return {
      hasTournament: false,
      division: params?.division || 'semua',
      playerCount: 0,
      clubCount: 0,
      message: 'Gagal memuat data tournament',
    }
  }
}

// ── GET /api/tournaments/my-status ──
export async function getTournamentMyStatus(params: { name?: string; gamertag?: string; division?: string }) {
  // Note: This is a complex query that the frontend currently calls with player name/gamertag.
  // For the data access layer, we simplify by requiring a playerId directly.
  // The full search-by-name logic remains in the API route.
  throw new Error('Use fetch("/api/tournaments/my-status?name=...") for the full implementation. This query requires complex player search + tournament matching that is best handled by the existing API route.')
}

// ── GET /api/wa-registrations ──
export async function getTournamentRegistrations(params: { division?: string }) {
  try {
    const searchParams = new URLSearchParams()
    if (params?.division) searchParams.set('division', params.division)

    const qs = searchParams.toString()
    const response = await fetch(`/api/wa-registrations${qs ? `?${qs}` : ''}`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('Failed to fetch tournament registrations:', response.status, response.statusText)
      return {
        success: true,
        tournamentId: null,
        tournamentName: null,
        weekNumber: null,
        participants: [],
        counts: { pending: 0, approved: 0, total: 0 },
      }
    }

    return response.json()
  } catch (error) {
    console.error('Error fetching tournament registrations:', error)
    return {
      success: true,
      tournamentId: null,
      tournamentName: null,
      weekNumber: null,
      participants: [],
      counts: { pending: 0, approved: 0, total: 0 },
    }
  }
}

// ── GET /api/tournaments/approved-players ──
export async function getApprovedPlayers(params?: { division?: string }) {
  try {
    const searchParams = new URLSearchParams()
    if (params?.division) searchParams.set('division', params.division)

    const qs = searchParams.toString()
    const response = await fetch(`/api/tournaments/approved-players${qs ? `?${qs}` : ''}`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('Failed to fetch approved players:', response.status, response.statusText)
      return {
        success: true,
        tournamentId: null,
        tournamentName: null,
        weekNumber: null,
        seasonName: null,
        participants: [],
        counts: { approved: 0, pending: 0, total: 0 },
      }
    }

    return response.json()
  } catch (error) {
    console.error('Error fetching approved players:', error)
    return {
      success: true,
      tournamentId: null,
      tournamentName: null,
      weekNumber: null,
      seasonName: null,
      participants: [],
      counts: { approved: 0, pending: 0, total: 0 },
    }
  }
}
