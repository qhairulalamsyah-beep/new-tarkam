// ═══════════════════════════════════════════════════════════════
// TIME-AWARE CACHE TIER SYSTEM
// ═══════════════════════════════════════════════════════════════
// Dynamically adjusts CDN cache TTL based on WITA peak hours.
//
// Tournament schedule:
// - Rabu (cowo) & Kamis (cewe): 21:00-00:00 WITA
// - Peak browse: 19:00-23:00 WITA (evening) + 08:00-11:00 (morning)
//
// WITA = UTC+8
// ═══════════════════════════════════════════════════════════════

/** Current hour in WITA (UTC+8) */
function getWitaHour(): number {
  const now = new Date()
  return (now.getUTCHours() + 8) % 24
}

/** Time-of-day classification */
export type TimeOfDay = 'pre_peak' | 'peak' | 'off_peak'

/**
 * Classify current time in WITA:
 * - pre_peak: 1 hour before peak (warm caches aggressively, medium TTL)
 * - peak:     Active hours (shorter TTL for fresh data)
 * - off_peak: Night/low traffic (longer TTL, save DB quota)
 */
export function getTimeOfDay(): TimeOfDay {
  const hour = getWitaHour()

  // Pre-peak: 18:00-18:59 WITA (warm before evening rush)
  //           07:00-07:59 WITA (warm before morning browse)
  if (hour === 18 || hour === 7) return 'pre_peak'

  // Peak: 08:00-11:59 WITA (morning browse)
  //       19:00-23:59 WITA (evening + tournament)
  if ((hour >= 8 && hour <= 11) || (hour >= 19 && hour <= 23)) return 'peak'

  // Off-peak: 00:00-06:59 WITA (sleep), 12:00-17:59 (work/siesta)
  return 'off_peak'
}

// ── Cache Tier Definitions ──
// Each tier has 3 TTL profiles: peak, pre_peak, off_peak

export interface CacheTierConfig {
  peak: { sMaxage: number; swr: number }
  prePeak: { sMaxage: number; swr: number }
  offPeak: { sMaxage: number; swr: number }
  surrogateKey: string
}

/**
 * Tier 1 — Stable data (rarely changes)
 * Seasons, achievements, skins catalog, sponsors, division rivalry
 */
export const CACHE_TIER_1: CacheTierConfig = {
  peak:     { sMaxage: 120, swr: 300 },   // 2min CDN, 5min stale
  prePeak:  { sMaxage: 180, swr: 600 },   // 3min CDN, 10min stale
  offPeak:  { sMaxage: 600, swr: 1800 },  // 10min CDN, 30min stale
  surrogateKey: 'tier1-data',
}

/**
 * Tier 2 — Semi-stable data (changes during tournaments)
 * Stats, players, clubs, tournaments, leaderboard, donations
 */
export const CACHE_TIER_2: CacheTierConfig = {
  peak:     { sMaxage: 45, swr: 90 },     // 45s CDN, 1.5min stale
  prePeak:  { sMaxage: 90, swr: 180 },    // 1.5min CDN, 3min stale
  offPeak:  { sMaxage: 300, swr: 600 },   // 5min CDN, 10min stale
  surrogateKey: 'tier2-data',
}

/**
 * Tier 3 — Dynamic data (changes frequently)
 * Activity feed, live matches, recent results
 */
export const CACHE_TIER_3: CacheTierConfig = {
  peak:     { sMaxage: 20, swr: 40 },     // 20s CDN, 40s stale
  prePeak:  { sMaxage: 45, swr: 90 },     // 45s CDN, 1.5min stale
  offPeak:  { sMaxage: 120, swr: 300 },   // 2min CDN, 5min stale
  surrogateKey: 'tier3-data',
}

/**
 * Tier 4 — Personal / search (no CDN cache benefit)
 * Player search, compare, personal data
 */
export const CACHE_TIER_4: CacheTierConfig = {
  peak:     { sMaxage: 5, swr: 15 },
  prePeak:  { sMaxage: 5, swr: 15 },
  offPeak:  { sMaxage: 10, swr: 30 },
  surrogateKey: 'tier4-data',
}

/**
 * Error cache (same across all times)
 */
export const CACHE_ERROR = {
  sMaxage: 5,
  swr: 10,
}

// ── Helper to build Cache-Control header ──

function resolveTierValues(tier: CacheTierConfig, tod: TimeOfDay) {
  switch (tod) {
    case 'peak': return tier.peak
    case 'pre_peak': return tier.prePeak
    case 'off_peak': return tier.offPeak
  }
}

/**
 * Build time-aware Cache-Control + Surrogate-Key headers.
 *
 * Usage in API routes:
 * ```ts
 * const headers = buildCacheHeaders(CACHE_TIER_2, 'stats-data')
 * headers.set('Vary', 'Accept-Encoding')
 * return NextResponse.json(data, { headers })
 * ```
 */
export function buildCacheHeaders(
  tier: CacheTierConfig,
  surrogateKey?: string,
): Headers {
  const headers = new Headers()
  const tod = getTimeOfDay()
  const { sMaxage, swr } = resolveTierValues(tier, tod)

  headers.set('Cache-Control', `public, s-maxage=${sMaxage}, stale-while-revalidate=${swr}`)

  const key = surrogateKey || tier.surrogateKey
  if (key) headers.set('Surrogate-Key', key)

  return headers
}

/**
 * Build error Cache-Control headers.
 */
export function buildErrorCacheHeaders(): Headers {
  const headers = new Headers()
  headers.set('Cache-Control', `public, s-maxage=${CACHE_ERROR.sMaxage}, stale-while-revalidate=${CACHE_ERROR.swr}`)
  headers.set('Vary', 'Accept-Encoding')
  return headers
}

/**
 * Get the current cache profile info (for debugging/logging).
 */
export function getCacheProfile(): {
  timeOfDay: TimeOfDay
  witaHour: number
  tier1: { sMaxage: number; swr: number }
  tier2: { sMaxage: number; swr: number }
  tier3: { sMaxage: number; swr: number }
} {
  const tod = getTimeOfDay()
  return {
    timeOfDay: tod,
    witaHour: getWitaHour(),
    tier1: resolveTierValues(CACHE_TIER_1, tod),
    tier2: resolveTierValues(CACHE_TIER_2, tod),
    tier3: resolveTierValues(CACHE_TIER_3, tod),
  }
}
