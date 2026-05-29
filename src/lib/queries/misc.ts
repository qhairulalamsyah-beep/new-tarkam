// ─── Miscellaneous Queries ───
// Drop-in replacements for fetch('/api/...') calls that don't fit into
// the other query modules or require complex aggregations.
// These delegate to the existing API routes.

// ── GET /api/division-rivalry ──
export async function getDivisionRivalry() {
  const response = await fetch('/api/division-rivalry')
  if (!response.ok) return { male: null, female: null }
  return response.json()
}

// ── GET /api/league-matches ──
export async function getLeagueMatches(params?: { division?: string; limit?: number }) {
  const searchParams = new URLSearchParams()
  if (params?.division) searchParams.set('division', params.division)
  if (params?.limit) searchParams.set('limit', String(params.limit))

  const response = await fetch(`/api/league-matches?${searchParams.toString()}`)
  if (!response.ok) return null
  return response.json()
}

// ── GET /api/league-matches/[id] ──
export async function getLeagueMatchById(id: string) {
  const response = await fetch(`/api/league-matches/${id}`)
  if (!response.ok) return null
  return response.json()
}

// ── GET /api/league-matches/club ──
export async function getClubSchedule(params: { clubId: string; seasonId?: string }) {
  const searchParams = new URLSearchParams()
  searchParams.set('clubId', params.clubId)
  if (params.seasonId) searchParams.set('seasonId', params.seasonId)

  const response = await fetch(`/api/league-matches/club?${searchParams.toString()}`)
  if (!response.ok) return null
  return response.json()
}

// ── GET /api/tournaments/my-status ──
export async function getMyTournamentStatus(params: { name: string; division: string; gamertag: string }) {
  const searchParams = new URLSearchParams()
  searchParams.set('name', params.name)
  searchParams.set('division', params.division)
  searchParams.set('gamertag', params.gamertag)

  const response = await fetch(`/api/tournaments/my-status?${searchParams.toString()}`)
  if (!response.ok) throw new Error('Gagal mengambil data')
  return response.json()
}

// ── GET /api/tournament-status ──
export async function getTournamentStatus() {
  const response = await fetch('/api/tournament-status')
  if (!response.ok) return null
  return response.json()
}

// ── GET /api/rankings ──
export async function getRankings(params?: { division?: string }) {
  const searchParams = new URLSearchParams()
  if (params?.division) searchParams.set('division', params.division)

  const response = await fetch(`/api/rankings?${searchParams.toString()}`)
  if (!response.ok) return null
  return response.json()
}

// ── GET /api/rankings/[id] ──
export async function getRankingDetail(id: string) {
  const response = await fetch(`/api/rankings/${id}`)
  if (!response.ok) return null
  return response.json()
}

// ── GET /api/clubs/unified-profile ──
export async function getClubUnifiedProfile(clubId: string) {
  const response = await fetch(`/api/clubs/unified-profile?clubId=${clubId}`)
  if (!response.ok) throw new Error('Failed to fetch')
  return response.json()
}

// ── GET /api/tournaments/[id]/sponsors ──
export async function getTournamentSponsors(tournamentId: string) {
  const response = await fetch(`/api/tournaments/${tournamentId}/sponsors`)
  if (!response.ok) return { presentedBy: null }
  return response.json()
}

// ── GET /api/admin/audit-logs ──
export async function getAuditLogs(params?: { limit?: number; offset?: number; action?: string }) {
  const searchParams = new URLSearchParams()
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.offset) searchParams.set('offset', String(params.offset))
  if (params?.action) searchParams.set('action', params.action)

  const response = await fetch(`/api/admin/audit-logs?${searchParams.toString()}`, { credentials: 'include' })
  if (!response.ok) return { logs: [], total: 0 }
  return response.json()
}

// ── GET /api/players/[id]/season-stats ──
export async function getPlayerSeasonHistory(playerId: string) {
  const response = await fetch(`/api/players/${playerId}/season-stats`)
  if (!response.ok) return null
  return response.json()
}

// ── GET /api/wa-registrations ──
export async function getWaRegistrations(params: { division?: string; status?: string; limit?: number; offset?: number }) {
  const searchParams = new URLSearchParams()
  if (params.division) searchParams.set('division', params.division)
  if (params.status) searchParams.set('status', params.status)
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.offset) searchParams.set('offset', String(params.offset))

  const response = await fetch(`/api/wa-registrations?${searchParams.toString()}`, { credentials: 'include' })
  if (!response.ok) return { registrations: [], total: 0 }
  return response.json()
}

// ── GET /api/cloudinary/images ──
export async function getCloudinaryImages(params?: { folder?: string; max_results?: number; next_cursor?: string }) {
  const searchParams = new URLSearchParams()
  if (params?.folder) searchParams.set('folder', params.folder)
  if (params?.max_results) searchParams.set('max_results', String(params.max_results))
  if (params?.next_cursor) searchParams.set('next_cursor', params.next_cursor)

  const response = await fetch(`/api/cloudinary/images?${searchParams.toString()}`, { credentials: 'include' })
  if (!response.ok) return { resources: [], next_cursor: null }
  return response.json()
}

// ── GET /api/backup ──
export async function getBackup() {
  const response = await fetch('/api/backup', { credentials: 'include' })
  if (!response.ok) return null
  return response.json()
}
