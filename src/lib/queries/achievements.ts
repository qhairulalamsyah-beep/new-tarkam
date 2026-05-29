// ─── Achievement Queries ───
// Drop-in replacements for fetch('/api/achievements/...') calls
// Delegates to the existing API routes which use Prisma/Neon

// ── Types ──
export interface AchievementResult {
  id: string
  name: string
  displayName: string
  description: string
  category: string
  icon: string
  tier: string
  criteria: string
  rewardPoints: number
  isActive: boolean
  _count?: {
    playerAchievements: number
  }
  [key: string]: unknown
}

// ── GET /api/achievements ──
export async function getAchievements(params?: {
  category?: string
  activeOnly?: boolean
}) {
  const searchParams = new URLSearchParams()
  if (params?.category) searchParams.set('category', params.category)
  if (params?.activeOnly) searchParams.set('activeOnly', 'true')

  const response = await fetch(`/api/achievements?${searchParams.toString()}`)
  if (!response.ok) return { achievements: [] as AchievementResult[] }
  return response.json()
}

// ── GET /api/players/[id]/achievements ──
export async function getPlayerAchievements(playerId: string) {
  const response = await fetch(`/api/players/${playerId}/achievements`)
  if (!response.ok) return { achievements: [] }
  return response.json()
}
