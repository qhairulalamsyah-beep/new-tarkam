// ─── Stats Queries ───
// Drop-in replacement for fetch('/api/stats') calls
//
// NOTE: The /api/stats endpoint is the most complex route in the app, using 14+ parallel
// queries with groupBy aggregations, deep nested includes (4+ levels), and extensive
// in-memory post-processing (composite scoring, donor matching, season snapshots, skin maps).
// Prisma/Neon cannot express these efficiently via simple fetch. Therefore, this module
// delegates to the existing API route for the full stats aggregation pipeline,
// while providing a typed interface.
//
// For simpler stat queries, see the individual query modules
// (players, matches, donations, clubs, etc.).

import type { StatsData } from '@/types/stats'

/**
 * @deprecated Use `StatsData` from `@/types/stats` instead.
 * Kept as a type alias for backward compatibility with existing imports.
 */
export type StatsResponse = StatsData

// ── GET /api/stats ──
// Delegates to the existing API route which uses Prisma for complex aggregations
// (groupBy, deep nested includes, etc.)
export async function getStats(division?: string): Promise<StatsData> {
  const params = new URLSearchParams()
  if (division) params.set('division', division)

  const response = await fetch(`/api/stats?${params.toString()}`, {
    next: { revalidate: 120 },
  })

  if (!response.ok) {
    console.error('Failed to fetch stats:', response.status, response.statusText)
    return {
      hasData: false,
      division: division || 'semua',
      allSeasons: [],
      season: { id: '', name: '', number: 0, status: '' },
      totalPlayers: 0,
      approvedPlayerCount: 0,
      topPlayers: [],
      clubs: [],
      recentMatches: [],
      upcomingMatches: [],
      weeklyChampions: [],
      weeklyTopPerformers: [],
      sultanOfWeekly: [],
      mvpHallOfFame: [],
      topDonors: [],
      weeklyTopDonors: [],
      totalPrizePool: 0,
      malePrizePool: 0,
      femalePrizePool: 0,
      activeTournamentPrizePool: 0,
      seasonDonationTotal: 0,
      skinMap: {},
      activeTournament: null,
      seasonProgress: { totalWeeks: 0, completedWeeks: 0, percentage: 0 },
    }
  }

  return response.json()
}
