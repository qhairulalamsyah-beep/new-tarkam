// ═══════════════════════════════════════════════════════════════
// VERCEL CRON — Daily Project Health Evaluation
// ═══════════════════════════════════════════════════════════════
// Runs daily at 09:00 WITA (01:00 UTC) via vercel.json crons.
// Checks: DB connectivity, CMS data, players, tournaments, API health.
// Returns 200 if healthy, 500 if any critical check fails.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const maxDuration = 30

function isAuthorized(request: Request): boolean {
  const auth = request.headers.get('authorization')
  if (auth === `Bearer ${process.env.CRON_SECRET}`) return true
  if (request.headers.get('x-vercel-cron') === 'true') return true
  return false
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Run all checks in parallel for faster evaluation
  const [
    dbCheck,
    cmsCheck,
    playersCheck,
    tournamentsCheck,
    seasonsCheck,
    donationsCheck,
  ] = await Promise.allSettled([
    // 1. Database connectivity
    db.$queryRaw`SELECT 1`.then(() => ({ check: 'database', status: 'ok' as const })),

    // 2. CMS data
    db.cmsSetting.count().then((count) => ({ check: 'cms_data', status: 'ok' as const, detail: `${count} settings` })),

    // 3. Active players
    db.player.count({ where: { isActive: true } }).then((count) => ({ check: 'players', status: 'ok' as const, detail: `${count} active` })),

    // 4. Tournaments
    db.tournament.count().then((count) => ({ check: 'tournaments', status: 'ok' as const, detail: `${count} total` })),

    // 5. Seasons
    db.season.count({ where: { status: { in: ['active', 'completed'] } } }).then((count) => ({ check: 'seasons', status: 'ok' as const, detail: `${count} active/completed` })),

    // 6. Donations
    db.donation.count({ where: { status: 'approved' } }).then((count) => ({ check: 'donations', status: 'ok' as const, detail: `${count} approved` })),
  ])

  const results = [dbCheck, cmsCheck, playersCheck, tournamentsCheck, seasonsCheck, donationsCheck].map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    const checks = ['database', 'cms_data', 'players', 'tournaments', 'seasons', 'donations']
    return { check: checks[i], status: 'fail' as const, detail: r.reason?.message?.substring(0, 100) }
  })

  const hasFailures = results.some(r => r.status === 'fail')
  const status = hasFailures ? 500 : 200

  console.log(`[CRON:EVAL] Daily evaluation: ${hasFailures ? 'FAILURES' : 'ALL OK'}`, results)

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    status: hasFailures ? 'unhealthy' : 'healthy',
    checks: results,
  }, { status })
}
