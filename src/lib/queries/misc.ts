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

// ── GET /api/livestreams ──
export async function getLiveStreams(params?: { division?: string; liveOnly?: boolean; limit?: number }) {
  const searchParams = new URLSearchParams()
  if (params?.division) searchParams.set('division', params.division)
  if (params?.liveOnly) searchParams.set('liveOnly', 'true')
  if (params?.limit) searchParams.set('limit', String(params.limit))

  const response = await fetch(`/api/livestreams?${searchParams.toString()}`)
  if (!response.ok) return { streams: [] }
  return response.json()
}

// ── GET /api/reactions ──
export async function getReactions(params: { targetType: string; targetId: string }) {
  const searchParams = new URLSearchParams()
  searchParams.set('targetType', params.targetType)
  searchParams.set('targetId', params.targetId)

  const response = await fetch(`/api/reactions?${searchParams.toString()}`)
  if (!response.ok) return { counts: {}, myReactions: [], total: 0 }
  return response.json()
}

// ── POST /api/reactions (toggle) ──
export async function toggleReaction(data: { type: string; targetType: string; targetId: string }) {
  const response = await fetch('/api/reactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error('Failed to toggle reaction')
  return response.json()
}

// ── GET /api/comments ──
export async function getComments(params: { targetType: string; targetId: string; cursor?: string; limit?: number }) {
  const searchParams = new URLSearchParams()
  searchParams.set('targetType', params.targetType)
  searchParams.set('targetId', params.targetId)
  if (params.cursor) searchParams.set('cursor', params.cursor)
  if (params.limit) searchParams.set('limit', String(params.limit))

  const response = await fetch(`/api/comments?${searchParams.toString()}`)
  if (!response.ok) return { comments: [], total: 0, hasMore: false, nextCursor: null }
  return response.json()
}

// ── POST /api/comments ──
export async function createComment(data: { content: string; targetType: string; targetId: string; parentId?: string }) {
  const response = await fetch('/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error('Failed to create comment')
  return response.json()
}

// ── DELETE /api/comments/[id] ──
export async function deleteComment(id: string) {
  const response = await fetch(`/api/comments/${id}`, { method: 'DELETE' })
  if (!response.ok) throw new Error('Failed to delete comment')
  return response.json()
}

// ── GET /api/predictions — Get user's predictions ──
export async function getMyPredictions(matchId?: string) {
  const searchParams = new URLSearchParams()
  if (matchId) searchParams.set('matchId', matchId)

  const response = await fetch(`/api/predictions?${searchParams.toString()}`, { credentials: 'include' })
  if (!response.ok) return { success: false, predictions: [] }
  return response.json()
}

// ── POST /api/predictions — Submit a prediction ──
export async function submitPrediction(data: { matchId: string; predictedWinnerId: string }) {
  const response = await fetch('/api/predictions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Gagal submit prediksi' }))
    throw new Error(err.error || 'Gagal submit prediksi')
  }
  return response.json()
}

// ── GET /api/predictions/stats?matchId= — Match prediction stats ──
export async function getMatchPredictionStats(matchId: string) {
  const response = await fetch(`/api/predictions/stats?matchId=${matchId}`)
  if (!response.ok) return { success: false, total: 0, team1: { id: null, name: 'Team 1', count: 0, percentage: 0 }, team2: { id: null, name: 'Team 2', count: 0, percentage: 0 }, predictions: [] }
  return response.json()
}

// ── GET /api/predictions/stats?leaderboard=true — Prediction leaderboard ──
export async function getPredictionLeaderboard(limit?: number) {
  const searchParams = new URLSearchParams()
  searchParams.set('leaderboard', 'true')
  if (limit) searchParams.set('limit', String(limit))

  const response = await fetch(`/api/predictions/stats?${searchParams.toString()}`)
  if (!response.ok) return { success: false, leaderboard: [] }
  return response.json()
}

// ── GET /api/leaderboard/history — Historical leaderboard snapshot ──
export async function getLeaderboardHistory(params: { seasonId: string; division?: string; weekNumber?: number }) {
  const searchParams = new URLSearchParams()
  searchParams.set('seasonId', params.seasonId)
  if (params.division) searchParams.set('division', params.division)
  if (params.weekNumber) searchParams.set('weekNumber', String(params.weekNumber))

  const response = await fetch(`/api/leaderboard/history?${searchParams.toString()}`)
  if (!response.ok) return null
  return response.json()
}

// ── POST /api/predictions/resolve — Resolve predictions (admin) ──
export async function resolvePredictions(matchId?: string) {
  const response = await fetch('/api/predictions/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(matchId ? { matchId } : {}),
  })
  if (!response.ok) throw new Error('Failed to resolve predictions')
  return response.json()
}

// ── GET /api/referrals/code — Get current user's referral code ──
export async function getReferralCode() {
  const response = await fetch('/api/referrals/code', { credentials: 'include' })
  if (!response.ok) return null
  return response.json()
}

// ── POST /api/referrals/code — Generate new referral code ──
export async function generateReferralCode() {
  const response = await fetch('/api/referrals/code', {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok) throw new Error('Gagal membuat kode referral')
  return response.json()
}

// ── POST /api/referrals/use — Use a referral code ──
export async function useReferralCode(data: { code: string; referredAccountId?: string; referredEmail?: string }) {
  const response = await fetch('/api/referrals/use', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Gagal menggunakan kode referral' }))
    throw new Error(err.error || 'Gagal menggunakan kode referral')
  }
  return response.json()
}

// ── GET /api/referrals/stats — Get referral stats ──
export async function getReferralStats() {
  const response = await fetch('/api/referrals/stats', { credentials: 'include' })
  if (!response.ok) return null
  return response.json()
}

// ── GET /api/notifications/preferences — Get WA notification preferences ──
export async function getWaNotifPreferences() {
  const response = await fetch('/api/notifications/preferences', { credentials: 'include' })
  if (!response.ok) return null
  return response.json()
}

// ── PUT /api/notifications/preferences — Update WA notification preferences ──
export async function updateWaNotifPreferences(data: {
  enableTournament?: boolean;
  enableMatch?: boolean;
  enableResult?: boolean;
  enablePrize?: boolean;
  enableSeason?: boolean;
}) {
  const response = await fetch('/api/notifications/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error('Gagal menyimpan preferensi')
  return response.json()
}

// ── POST /api/notifications/test — Send test WA notification ──
export async function sendTestWaNotification() {
  const response = await fetch('/api/notifications/test', {
    method: 'POST',
    credentials: 'include',
  })
  return response.json()
}

// ── POST /api/notifications/whatsapp — Send WA notification ──
export async function sendWaNotification(data: {
  type: string;
  targetId?: string;
  targetIds?: string[];
  data?: Record<string, unknown>;
}) {
  const response = await fetch('/api/notifications/whatsapp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error('Gagal mengirim notifikasi')
  return response.json()
}

// ── GET /api/notifications/whatsapp — Get WA notification log ──
export async function getWaNotifLog(params?: { type?: string; status?: string; limit?: number; offset?: number }) {
  const searchParams = new URLSearchParams()
  if (params?.type) searchParams.set('type', params.type)
  if (params?.status) searchParams.set('status', params.status)
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.offset) searchParams.set('offset', String(params.offset))

  const response = await fetch(`/api/notifications/whatsapp?${searchParams.toString()}`, { credentials: 'include' })
  if (!response.ok) return { data: [], total: 0 }
  return response.json()
}
