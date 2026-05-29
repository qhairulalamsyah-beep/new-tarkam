// ═══════════════════════════════════════════════════════════════
// VERCEL CRON — Daily Combined Job (Hobby Tier Compatible)
// ═══════════════════════════════════════════════════════════════
// Runs once daily at 01:00 WITA (17:00 UTC) via vercel.json crons.
// Hobby tier only allows 1 cron per day, so we combine:
//   1. Cache warming (ISR revalidation + endpoint pre-fetch)
//   2. Health evaluation (DB + data checks)
//
// Tournament schedule context (WITA = UTC+8):
// - Rabu (cowo) & Kamis (cewe): 21:00-00:00 WITA
// - Since we only get 1 daily run at 01:00 WITA, we warm ALL
//   endpoints aggressively right after tournament nights.
// ═══════════════════════════════════════════════════════════════

import { revalidatePath, revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const maxDuration = 60

// ── CRON AUTH ──
function isAuthorized(request: Request): boolean {
  const auth = request.headers.get('authorization')
  if (auth === `Bearer ${process.env.CRON_SECRET}`) return true
  if (request.headers.get('x-vercel-cron') === 'true') return true
  return false
}

// ── Endpoint definitions ──
const ALL_ENDPOINTS = [
  '/api/stats?division=male',
  '/api/stats?division=female',
  '/api/tournament-status',
  '/api/feed',
  '/api/activity',
  '/api/clubs/leaderboard?type=tarkam',
  '/api/clubs?unified=true',
  '/api/sponsors?activeOnly=true',
  '/api/leaderboard',
  '/api/seasons',
  '/api/season-results?division=male',
  '/api/season-results?division=female',
  '/api/tournaments',
  '/api/tournaments/approved-players?division=male',
  '/api/tournaments/approved-players?division=female',
  '/api/donations/top-donors',
]

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { step: string; status: 'ok' | 'fail' | 'skip'; detail?: string; durationMs?: number }[] = []
  const startTime = Date.now()

  // ═══ PART 1: Cache Warming ═══
  console.log('[CRON:DAILY] Starting daily jobs — cache warming + health check')

  // Step 1: Force ISR cache regeneration
  try {
    revalidatePath('/')
    revalidateTag('hero-data', 'max')
    revalidateTag('cms-content', 'max')
    revalidateTag('landing-stats', 'max')
    results.push({ step: 'revalidate_page', status: 'ok' })
  } catch (e: any) {
    results.push({ step: 'revalidate_page', status: 'fail', detail: e.message?.substring(0, 100) })
  }

  // Step 2: Warm endpoints
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://localhost:${process.env.PORT || 3000}`

  const BATCH_SIZE = 4
  for (let i = 0; i < ALL_ENDPOINTS.length; i += BATCH_SIZE) {
    const batch = ALL_ENDPOINTS.slice(i, i + BATCH_SIZE)

    const batchResults = await Promise.allSettled(
      batch.map(async (ep) => {
        const start = Date.now()
        try {
          const res = await fetch(`${baseUrl}${ep}`, {
            signal: AbortSignal.timeout(20_000),
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

  // ═══ PART 2: Health Evaluation ═══
  const [
    dbCheck,
    cmsCheck,
    playersCheck,
    tournamentsCheck,
    seasonsCheck,
    donationsCheck,
  ] = await Promise.allSettled([
    db.$queryRaw`SELECT 1`.then(() => ({ check: 'database', status: 'ok' as const })),
    db.cmsSetting.count().then((count) => ({ check: 'cms_data', status: 'ok' as const, detail: `${count} settings` })),
    db.player.count({ where: { isActive: true } }).then((count) => ({ check: 'players', status: 'ok' as const, detail: `${count} active` })),
    db.tournament.count().then((count) => ({ check: 'tournaments', status: 'ok' as const, detail: `${count} total` })),
    db.season.count({ where: { status: { in: ['active', 'completed'] } } }).then((count) => ({ check: 'seasons', status: 'ok' as const, detail: `${count} active/completed` })),
    db.donation.count({ where: { status: 'approved' } }).then((count) => ({ check: 'donations', status: 'ok' as const, detail: `${count} approved` })),
  ])

  const healthChecks = [dbCheck, cmsCheck, playersCheck, tournamentsCheck, seasonsCheck, donationsCheck].map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    const checks = ['database', 'cms_data', 'players', 'tournaments', 'seasons', 'donations']
    return { check: checks[i], status: 'fail' as const, detail: r.reason?.message?.substring(0, 100) }
  })

  for (const hc of healthChecks) {
    results.push({ step: `health_${hc.check}`, status: hc.status === 'ok' ? 'ok' : 'fail', detail: 'detail' in hc ? hc.detail : undefined })
  }

  // ═══ Summary ═══
  const totalDuration = Date.now() - startTime
  const okCount = results.filter(r => r.status === 'ok').length
  const failCount = results.filter(r => r.status === 'fail').length
  const healthFailCount = healthChecks.filter(h => h.status === 'fail').length

  console.log(
    `[CRON:DAILY] ${okCount} ok, ${failCount} fail | ${totalDuration}ms | ${ALL_ENDPOINTS.length} endpoints warmed | Health: ${healthFailCount > 0 ? 'UNHEALTHY' : 'HEALTHY'}`,
  )

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    type: 'daily',
    status: healthFailCount > 0 ? 'unhealthy' : 'warmed',
    warmedEndpoints: ALL_ENDPOINTS.length,
    health: {
      status: healthFailCount > 0 ? 'unhealthy' : 'healthy',
      checks: healthChecks,
    },
    totalDurationMs: totalDuration,
    results,
  }, { status: failCount > 0 ? 207 : 200 })
}
