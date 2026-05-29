// ═══════════════════════════════════════════════════════════════
// VERCEL CRON — Smart Time-Aware Cache Warming
// ═══════════════════════════════════════════════════════════════
// Runs every 2 hours during peak, every 3 hours during off-peak.
// Vercel cron schedule: "0 */2 * * *" (every 2 hours, the route
// itself decides which endpoints to warm based on WITA time).
//
// Tournament schedule context (WITA = UTC+8):
// - Rabu (cowo) & Kamis (cewe): 21:00-00:00 WITA
// - Peak browse: 08:00-11:00 & 19:00-23:00 WITA
// - Pre-peak warm: 07:00 & 18:00 WITA
//
// Strategy:
// - PRE_PEAK (07:00, 18:00 WITA): Warm ALL endpoints aggressively
// - PEAK: Warm key endpoints (stats, feed, tournament-status)
// - OFF_PEAK: Light warm (stats only) + DB check
// ═══════════════════════════════════════════════════════════════

import { revalidatePath, revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTimeOfDay, getCacheProfile } from '@/lib/cache-tiers'

export const maxDuration = 60

// ── CRON AUTH ──
// Verify the request is from Vercel Cron or authorized admin
function isAuthorized(request: Request): boolean {
  const auth = request.headers.get('authorization')
  if (auth === `Bearer ${process.env.CRON_SECRET}`) return true
  // Vercel Cron sends this header
  if (request.headers.get('x-vercel-cron') === 'true') return true
  return false
}

// ── Endpoint definitions grouped by priority ──

/** Critical endpoints — always warmed */
const CRITICAL_ENDPOINTS = [
  '/api/stats?division=male',
  '/api/stats?division=female',
  '/api/tournament-status',
]

/** Important endpoints — warmed during pre-peak and peak */
const IMPORTANT_ENDPOINTS = [
  '/api/feed',
  '/api/activity',
  '/api/clubs/leaderboard?type=tarkam',
  '/api/clubs?unified=true',
  '/api/sponsors?activeOnly=true',
  '/api/leaderboard',
]

/** Nice-to-have endpoints — warmed only during pre-peak */
const NICE_TO_HAVE_ENDPOINTS = [
  '/api/seasons',
  '/api/season-results?division=male',
  '/api/season-results?division=female',
  '/api/tournaments',
  '/api/tournaments/approved-players?division=male',
  '/api/tournaments/approved-players?division=female',
  '/api/division-rivalry',
  '/api/donations/top-donors',
  '/api/achievements',
]

export async function GET(request: Request) {
  // Auth check
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { step: string; status: 'ok' | 'fail' | 'skip'; detail?: string; durationMs?: number }[] = []
  const startTime = Date.now()
  const timeOfDay = getTimeOfDay()
  const profile = getCacheProfile()

  console.log(`[CRON:WARM] Time: ${timeOfDay} (WITA hour: ${profile.witaHour}), Tier2 TTL: ${profile.tier2.sMaxage}s`)

  // ── Step 1: Force ISR cache regeneration ──
  try {
    revalidatePath('/')
    revalidateTag('hero-data', 'max')
    revalidateTag('cms-content', 'max')
    revalidateTag('landing-stats', 'max')
    results.push({ step: 'revalidate_page', status: 'ok' })
  } catch (e: any) {
    results.push({ step: 'revalidate_page', status: 'fail', detail: e.message?.substring(0, 100) })
  }

  // ── Step 2: Determine which endpoints to warm ──
  let endpointsToWarm: string[]

  switch (timeOfDay) {
    case 'pre_peak':
      // Pre-peak: warm EVERYTHING — caches must be hot before rush hour
      endpointsToWarm = [...CRITICAL_ENDPOINTS, ...IMPORTANT_ENDPOINTS, ...NICE_TO_HAVE_ENDPOINTS]
      break

    case 'peak':
      // Peak: warm critical + important — data must be fresh
      endpointsToWarm = [...CRITICAL_ENDPOINTS, ...IMPORTANT_ENDPOINTS]
      break

    case 'off_peak':
      // Off-peak: only critical endpoints — save DB/CDN quota
      endpointsToWarm = CRITICAL_ENDPOINTS
      break
  }

  // ── Step 3: Warm endpoints ──
  // ★ FIX: Do NOT use cache:'no-store' — that tells CDN NOT to cache!
  // Using default cache behavior so Vercel Edge Cache gets populated.
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://localhost:${process.env.PORT || 3000}`

  // Batch in groups of 4 to avoid overwhelming the serverless function
  const BATCH_SIZE = 4
  for (let i = 0; i < endpointsToWarm.length; i += BATCH_SIZE) {
    const batch = endpointsToWarm.slice(i, i + BATCH_SIZE)

    const batchResults = await Promise.allSettled(
      batch.map(async (ep) => {
        const start = Date.now()
        try {
          const res = await fetch(`${baseUrl}${ep}`, {
            signal: AbortSignal.timeout(20_000), // 20s timeout per endpoint
          })
          const duration = Date.now() - start
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return { endpoint: ep, status: 'ok' as const, durationMs: duration }
        } catch (err: any) {
          const duration = Date.now() - start
          return { endpoint: ep, status: 'fail' as const, detail: err.message?.substring(0, 100), durationMs: duration }
        }
      })
    )

    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.push({ step: `warm_${r.value.endpoint}`, status: r.value.status, durationMs: r.value.durationMs })
      } else {
        results.push({ step: 'warm_unknown', status: 'fail', detail: r.reason?.message?.substring(0, 100) })
      }
    }
  }

  // ── Step 4: Quick DB connectivity check ──
  try {
    await db.$queryRaw`SELECT 1`
    results.push({ step: 'db_check', status: 'ok' })
  } catch (e: any) {
    results.push({ step: 'db_check', status: 'fail', detail: e.message?.substring(0, 100) })
  }

  // ── Step 5: Log summary ──
  const totalDuration = Date.now() - startTime
  const okCount = results.filter(r => r.status === 'ok').length
  const failCount = results.filter(r => r.status === 'fail').length

  console.log(
    `[CRON:WARM] ${timeOfDay.toUpperCase()} | ${okCount} ok, ${failCount} fail | ${totalDuration}ms | ${endpointsToWarm.length} endpoints warmed`,
  )

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    timeOfDay,
    witaHour: profile.witaHour,
    cacheProfile: profile,
    status: failCount > 0 ? 'partial' : 'warmed',
    warmedEndpoints: endpointsToWarm.length,
    totalDurationMs: totalDuration,
    results,
  }, { status: failCount > 0 ? 207 : 200 })
}
