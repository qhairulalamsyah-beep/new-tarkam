// ─── Skin Queries ───
// Drop-in replacements for fetch('/api/skins/...') calls
// Delegates to the existing API routes which use Prisma/Neon

// ── Types ──
export interface SkinResult {
  id: string
  type: string
  displayName: string
  description: string
  icon: string
  colorClass: unknown
  priority: number
  duration: string
  isActive: boolean
}

export interface SkinHolderResult {
  id: string
  accountId: string
  skinId: string
  skinType: string
  displayName: string
  icon: string
  colorClass: unknown
  priority: number
  duration: string
  reason: string | null
  expiresAt: string | null
  isExpired: boolean
  awardedBy: string | null
  createdAt: string
  donorBadgeCount?: number
  player: {
    id: string
    gamertag: string
    name: string
    division: string
    avatar: string | null
  } | null
}

// ── GET /api/skins ──
export async function getSkins() {
  const response = await fetch('/api/skins')
  if (!response.ok) return { count: 0, skins: [] as SkinResult[] }
  return response.json()
}

// ── GET /api/skins/holders ──
export async function getSkinHolders() {
  const response = await fetch('/api/skins/holders')
  if (!response.ok) return { count: 0, activeCount: 0, holders: [] as SkinHolderResult[] }
  return response.json()
}

// ── GET /api/skins/player/[accountId] ──
export async function getPlayerSkinsByAccount(accountId: string) {
  const response = await fetch(`/api/skins/player/${accountId}`)
  if (!response.ok) return { count: 0, expiredRemoved: 0, skins: [] }
  return response.json()
}
