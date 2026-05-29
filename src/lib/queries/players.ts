// ─── Player Queries ───
// Drop-in replacements for fetch('/api/players/...') calls
// Delegates to the existing API routes which use Prisma/Neon

// ── Types ──
export interface Player {
  id: string
  name: string
  gamertag: string
  division: string
  tier: string
  avatar: string | null
  city: string
  phone: string | null
  points: number
  totalWins: number
  totalMvp: number
  streak: number
  maxStreak: number
  matches: number
  isActive: boolean
  registrationStatus: string
  clubMembers: Array<{
    leftAt: string | null
    profile: { id: string; name: string; logo: string | null }
  }>
  account: { id: string } | null
  _count?: {
    playerAchievements: number
    achievements: number
  }
  [key: string]: unknown
}

export interface PlayerSearchParams {
  q: string
  division?: string
}

export interface PlayerSearchResult {
  id: string
  gamertag: string
  division: string
  tier: string
  points: number
  totalWins: number
  totalMvp: number
  avatar: string | null
  club: { id: string; name: string; logo: string | null } | null
  rank: number
}

export interface PlayerLeaderboardParams {
  division?: string
  seasonId?: string
  limit?: number
}

export interface PlayerCompareResult {
  player1: PlayerCompareData
  player2: PlayerCompareData
}

export interface PlayerCompareData {
  id: string
  gamertag: string
  name: string
  avatar: string | null
  division: string
  tier: string
  points: number
  totalWins: number
  totalMvp: number
  streak: number
  maxStreak: number
  matches: number
  rank: number
  club: { id: string; name: string; logo: string | null } | null
  achievements: Array<{
    id: string
    name: string
    displayName: string
    icon: string
    tier: string
    category: string
    earnedAt: string
  }>
  tierScore: number
}

export interface PlayerStreakResult {
  streaks: Array<{
    id: string
    gamertag: string
    avatar: string | null
    tier: string
    streak: number
    maxStreak: number
    club: string | null
  }>
}

export interface PlayerPointBreakdown {
  playerId: string
  gamertag: string
  totalPoints: number
  totalWins: number
  streak: number
  maxStreak: number
  matches: number
  breakdown: {
    matchWin: number
    streakBonus: number
    prize: number
    other: number
  }
  prizeDetail: {
    juara1: number
    juara2: number
    juara3: number
    mvp: number
    other: number
  }
  prizeByWeek: Array<{
    week: number
    label: string
    juara1: number
    juara2: number
    juara3: number
    mvp: number
  }>
  totalCalculated: number
  diff: number
}

// ── GET /api/players ──
export async function getPlayers(params?: {
  division?: string
  tier?: string
  registrationStatus?: string
  limit?: number
}) {
  const searchParams = new URLSearchParams()
  if (params?.division) searchParams.set('division', params.division)
  if (params?.tier) searchParams.set('tier', params.tier)
  if (params?.registrationStatus) searchParams.set('registrationStatus', params.registrationStatus)
  if (params?.limit) searchParams.set('limit', String(params.limit))

  const response = await fetch(`/api/players?${searchParams.toString()}`)
  if (!response.ok) return [] as Player[]
  const data = await response.json()
  return (data.players || data || []) as Player[]
}

// ── GET /api/players/search ──
export async function searchPlayers(params: PlayerSearchParams) {
  const searchParams = new URLSearchParams()
  searchParams.set('q', params.q)
  if (params.division) searchParams.set('division', params.division)

  const response = await fetch(`/api/players/search?${searchParams.toString()}`)
  if (!response.ok) return { players: [] as PlayerSearchResult[] }
  return response.json() as Promise<{ players: PlayerSearchResult[] }>
}

// ── GET /api/players/leaderboard ──
export async function getPlayerLeaderboard(params?: PlayerLeaderboardParams) {
  const searchParams = new URLSearchParams()
  if (params?.division) searchParams.set('division', params.division)
  if (params?.seasonId) searchParams.set('seasonId', params.seasonId)
  if (params?.limit) searchParams.set('limit', String(params.limit))

  const response = await fetch(`/api/players/leaderboard?${searchParams.toString()}`)
  if (!response.ok) return []
  const data = await response.json()
  return data.leaderboard || data || []
}

// ── GET /api/players/compare ──
export async function comparePlayers(player1Id: string, player2Id: string): Promise<PlayerCompareResult> {
  const searchParams = new URLSearchParams()
  searchParams.set('player1', player1Id)
  searchParams.set('player2', player2Id)

  const response = await fetch(`/api/players/compare?${searchParams.toString()}`)
  if (!response.ok) throw new Error('Failed to compare players')
  return response.json()
}

// ── GET /api/players/streaks ──
export async function getPlayerStreaks(params?: { division?: string; limit?: number }) {
  const searchParams = new URLSearchParams()
  if (params?.division) searchParams.set('division', params.division)
  if (params?.limit) searchParams.set('limit', String(params.limit))

  const response = await fetch(`/api/players/streaks?${searchParams.toString()}`)
  if (!response.ok) return { streaks: [] }
  return response.json() as Promise<PlayerStreakResult>
}

// ── GET /api/players/[id] ──
export async function getPlayerById(id: string) {
  const response = await fetch(`/api/players/${id}`)
  if (!response.ok) throw new Error('Player not found')
  return response.json() as Promise<Player>
}

// ── GET /api/players/[id]/matches ──
export async function getPlayerMatches(id: string) {
  const response = await fetch(`/api/players/${id}/matches`)
  if (!response.ok) {
    return {
      player: { id, gamertag: '', division: '', tier: '', club: null },
      tournamentMatches: [],
    }
  }
  return response.json()
}

// ── GET /api/players/[id]/achievements ──
export async function getPlayerAchievements(playerId: string) {
  const response = await fetch(`/api/players/${playerId}/achievements`)
  if (!response.ok) {
    return {
      player: { id: playerId, gamertag: '', points: 0 },
      achievements: [],
      availableAchievements: [],
      byCategory: { tournament: [], mvp: [], points: [], club: [] },
      stats: { total: 0, earned: 0, remaining: 0 },
    }
  }
  return response.json()
}

// ── GET /api/players/[id]/point-breakdown ──
export async function getPlayerPointBreakdown(playerId: string): Promise<PlayerPointBreakdown> {
  const response = await fetch(`/api/players/${playerId}/point-breakdown`)
  if (!response.ok) throw new Error('Failed to fetch point breakdown')
  return response.json()
}

// ── GET /api/players/[id]/season-stats ──
export async function getPlayerSeasonStats(playerId: string) {
  const response = await fetch(`/api/players/${playerId}/season-stats`)
  if (!response.ok) return null
  return response.json()
}
