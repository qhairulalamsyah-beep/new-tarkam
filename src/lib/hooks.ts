// ─── React Query Hooks ───
// Pre-configured hooks wrapping all API query functions.
// Components can swap fetch('/api/...') for a hook and get caching + auto-refresh.
//
// Query keys match the existing convention used throughout the codebase.
// Default staleTime: 300_000 (5min — matches QueryClient default).

import { useQuery } from '@tanstack/react-query'
import {
  getPlayers,
  searchPlayers,
  getPlayerStreaks,
  getPlayerById,
  getPlayerMatches,
  getPlayerSeasonStats,
  getPlayerLeaderboard,
  comparePlayers,
  getPlayerPointBreakdown,
  getPlayerAchievements as getPlayerAchievementsDetailed,
  type PlayerSearchParams,
  type PlayerLeaderboardParams,
} from '@/lib/queries/players'
import {
  getSeasons,
  getSeasonById,
  getSeasonResults,
} from '@/lib/queries/seasons'
import {
  getTournaments,
  getTournamentById,
  getTournamentParticipants,
  getTournamentOverview,
  getTournamentRegistrations,
  getApprovedPlayers,
} from '@/lib/queries/tournaments'
import {
  getMatches,
  getLiveMatches,
  getLiveMatchCount,
  getRecentMatches,
  getNextMatches,
  getMatchDetail,
} from '@/lib/queries/matches'
import {
  getClubs,
  getClubById,
  getClubLeaderboard,
  getClubMembers,
  getClubStats,
} from '@/lib/queries/clubs'
import {
  getDonations,
  getTopDonors,
  getTopDonorsDetailed,
} from '@/lib/queries/donations'
import {
  getCmsSections,
  getCmsCards,
  getCmsSettings,
  getCmsContent,
} from '@/lib/queries/cms'
import {
  getSkins,
  getSkinHolders,
  getPlayerSkinsByAccount,
} from '@/lib/queries/skins'
import {
  getSponsors,
  getSponsorBanners,
  getSponsoredPrizes,
} from '@/lib/queries/sponsors'
import {
  getMarketplaceItems,
  getMarketplaceItem,
} from '@/lib/queries/marketplace'
import {
  getAchievements,
  getPlayerAchievements,
} from '@/lib/queries/achievements'
import {
  getActivityFeed,
} from '@/lib/queries/feed'
import {
  getStats,
} from '@/lib/queries/stats'
import {
  getDivisionRivalry,
  getLeagueMatches,
  getLeagueMatchById,
  getClubSchedule,
  getMyTournamentStatus,
  getTournamentStatus,
  getRankings,
  getRankingDetail,
  getClubUnifiedProfile,
  getTournamentSponsors,
  getAuditLogs,
  getPlayerSeasonHistory,
  getWaRegistrations,
  getCloudinaryImages,
  getBackup,
  getLiveStreams,
  getReactions,
  getComments,
  getMyPredictions,
  getMatchPredictionStats,
  getPredictionLeaderboard,
  getLeaderboardHistory,
  getReferralCode,
  generateReferralCode,
  useReferralCode,
  getReferralStats,
  getWaNotifPreferences,
  getWaNotifLog,
} from '@/lib/queries/misc'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Shared: Extra query options that hooks accept
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Extra options that can be passed to any hook to override defaults. */
export type HookOptions = Partial<{
  enabled: boolean
  staleTime: number
  gcTime: number
  refetchInterval: number | false | ((query: any) => number | false)
  refetchIntervalInBackground: boolean
  refetchOnMount: boolean | 'always'
  refetchOnWindowFocus: boolean
  refetchOnReconnect: boolean
  select: (data: any) => any
}>

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Player Hooks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function usePlayers(params?: { division?: string; tier?: string; registrationStatus?: string }) {
  return useQuery({
    queryKey: ['players', params?.division, params?.tier, params?.registrationStatus],
    queryFn: () => getPlayers(params),
    staleTime: 120_000, // Tier 2 — semi-stable
  })
}

export function usePlayerSearch(params: PlayerSearchParams, options?: HookOptions) {
  const { q, division } = params
  return useQuery({
    queryKey: ['player-search', division, q],
    queryFn: () => searchPlayers(params),
    enabled: q.trim().length >= 2,
    staleTime: 30_000, // Tier 3 — dynamic
    ...options,
  })
}

export function usePlayerStreaks(params?: { division?: string; limit?: number }) {
  return useQuery({
    queryKey: ['player-streaks', params?.division],
    queryFn: () => getPlayerStreaks(params),
    staleTime: 120_000, // Tier 2 — semi-stable
  })
}

export function usePlayerById(id: string) {
  return useQuery({
    queryKey: ['player-detail', id],
    queryFn: () => getPlayerById(id),
    enabled: !!id,
    staleTime: 120_000, // Tier 2 — semi-stable
  })
}

export function usePlayerMatches(id: string) {
  return useQuery({
    queryKey: ['player-matches', id],
    queryFn: () => getPlayerMatches(id),
    enabled: !!id,
    staleTime: 30_000, // Tier 3 — dynamic
  })
}

export function usePlayerSeasonStats(playerId: string) {
  return useQuery({
    queryKey: ['player-season-stats', playerId],
    queryFn: () => getPlayerSeasonStats(playerId),
    enabled: !!playerId,
    staleTime: 120_000, // Tier 2 — semi-stable
  })
}

export function usePlayerLeaderboard(params?: PlayerLeaderboardParams) {
  return useQuery({
    queryKey: ['player-leaderboard', params?.division, params?.seasonId, params?.limit],
    queryFn: () => getPlayerLeaderboard(params),
    staleTime: 120_000, // Tier 2 — semi-stable
  })
}

export function usePlayerCompare(player1Id: string, player2Id: string, options?: HookOptions) {
  return useQuery({
    queryKey: ['player-compare', player1Id, player2Id],
    queryFn: () => comparePlayers(player1Id, player2Id),
    enabled: !!player1Id && !!player2Id && player1Id !== player2Id,
    staleTime: 30_000, // Tier 3 — dynamic
    ...options,
  })
}

export function usePlayerPointBreakdown(playerId: string) {
  return useQuery({
    queryKey: ['player-point-breakdown', playerId],
    queryFn: () => getPlayerPointBreakdown(playerId),
    enabled: !!playerId,
    staleTime: 120_000, // Tier 2 — semi-stable
  })
}

export function usePlayerAchievementsDetailed(playerId: string) {
  return useQuery({
    queryKey: ['player-achievements', playerId],
    queryFn: () => getPlayerAchievementsDetailed(playerId),
    enabled: !!playerId,
    staleTime: 120_000, // Tier 2 — semi-stable
  })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Season Hooks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useSeasons(params?: { division?: string }, options?: HookOptions) {
  return useQuery({
    queryKey: ['seasons-all', params?.division],
    queryFn: () => getSeasons(params),
    staleTime: 300_000, // Tier 1 — stable
    ...options,
  })
}

export function useSeasonById(id: string) {
  return useQuery({
    queryKey: ['season-detail', id],
    queryFn: () => getSeasonById(id),
    enabled: !!id,
    staleTime: 120_000, // Tier 2 — semi-stable
  })
}

export function useSeasonResults(params?: { division?: string }, options?: HookOptions) {
  return useQuery({
    queryKey: ['season-results', params?.division || 'male'],
    queryFn: () => getSeasonResults(params),
    staleTime: 300_000, // Tier 1 — stable
    ...options,
  })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tournament Hooks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useTournaments(params?: { division?: string; seasonId?: string; status?: string }, options?: HookOptions) {
  return useQuery({
    queryKey: ['tournaments', params?.division, params?.seasonId, params?.status],
    queryFn: () => getTournaments(params),
    staleTime: 120_000, // Tier 2 — semi-stable
    ...options,
  })
}

export function useTournamentById(id: string, options?: HookOptions) {
  return useQuery({
    queryKey: ['tournament', id],
    queryFn: () => getTournamentById(id),
    enabled: !!id,
    staleTime: 120_000, // Tier 2 — semi-stable
    ...options,
  })
}

export function useTournamentParticipants(tournamentId: string) {
  return useQuery({
    queryKey: ['tournament-participants', tournamentId],
    queryFn: () => getTournamentParticipants(tournamentId),
    enabled: !!tournamentId,
    staleTime: 30_000, // Tier 3 — dynamic
  })
}

export function useTournamentOverview(params?: { division?: string }) {
  return useQuery({
    queryKey: ['tournament-overview', params?.division],
    queryFn: () => getTournamentOverview(params),
    staleTime: 120_000, // Tier 2 — semi-stable
  })
}

export function useTournamentRegistrations(params: { division?: string }, options?: HookOptions) {
  return useQuery({
    queryKey: ['wa-registrations', params.division],
    queryFn: () => getTournamentRegistrations(params),
    staleTime: 30_000, // Tier 3 — dynamic
    ...options,
  })
}

export function useApprovedPlayers(params?: { division?: string }, options?: HookOptions) {
  return useQuery({
    queryKey: ['approved-players', params?.division],
    queryFn: () => getApprovedPlayers(params),
    staleTime: 30_000, // Tier 3 — dynamic
    ...options,
  })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Match Hooks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useMatches(params?: {
  tournamentId?: string
  status?: string
  round?: number
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ['matches', params?.tournamentId, params?.status, params?.round, params?.page, params?.limit],
    queryFn: () => getMatches(params),
    staleTime: 30_000, // Tier 3 — dynamic
  })
}

export function useLiveMatches(params?: { division?: string }) {
  return useQuery({
    queryKey: ['matches-live', params?.division],
    queryFn: () => getLiveMatches(params),
    staleTime: 30_000, // Tier 3 — dynamic
  })
}

export function useLiveMatchCount(params?: { division?: string }, options?: HookOptions) {
  return useQuery({
    queryKey: ['matches-live-count', params?.division],
    queryFn: () => getLiveMatchCount(params),
    staleTime: 30_000, // Tier 3 — dynamic
    ...options,
  })
}

export function useRecentMatches(params?: { division?: string; bracket?: string; limit?: number }) {
  return useQuery({
    queryKey: ['recent-matches', params?.division],
    queryFn: () => getRecentMatches(params),
    staleTime: 30_000, // Tier 3 — dynamic
  })
}

export function useNextMatches(params?: { division?: string }) {
  return useQuery({
    queryKey: ['matches-next', params?.division],
    queryFn: () => getNextMatches(params),
    staleTime: 30_000, // Tier 3 — dynamic
  })
}

export function useMatchDetail(id: string | null, options?: HookOptions) {
  return useQuery({
    queryKey: ['match-detail', id],
    queryFn: () => getMatchDetail(id!),
    enabled: !!id,
    staleTime: 30_000, // Tier 3 — dynamic
    ...options,
  })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Club Hooks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useClubs(params?: { seasonId?: string; division?: string; unified?: boolean }) {
  return useQuery({
    queryKey: ['clubs', params?.seasonId, params?.division, params?.unified],
    queryFn: () => getClubs(params),
    staleTime: 120_000, // Tier 2 — semi-stable
  })
}

export function useClubById(id: string) {
  return useQuery({
    queryKey: ['club-detail', id],
    queryFn: () => getClubById(id),
    enabled: !!id,
    staleTime: 120_000, // Tier 2 — semi-stable
  })
}

export function useClubLeaderboard(params?: { type?: 'tarkam' | 'liga' }, options?: HookOptions) {
  return useQuery({
    queryKey: ['club-leaderboard', params?.type || 'tarkam'],
    queryFn: () => getClubLeaderboard(params),
    staleTime: 120_000, // Tier 2 — semi-stable
    ...options,
  })
}

export function useClubMembers(clubId: string) {
  return useQuery({
    queryKey: ['club-members', clubId],
    queryFn: () => getClubMembers(clubId),
    enabled: !!clubId,
    staleTime: 120_000, // Tier 2 — semi-stable
  })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Donation Hooks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useDonations(params?: {
  type?: 'weekly' | 'season'
  seasonId?: string
  tournamentId?: string
  status?: 'pending' | 'approved' | 'rejected' | 'all'
  division?: 'male' | 'female'
  limit?: number
}) {
  return useQuery({
    queryKey: ['donations', params?.type, params?.seasonId, params?.tournamentId, params?.status, params?.division],
    queryFn: () => getDonations(params),
    staleTime: 120_000, // Tier 2 — semi-stable
  })
}

export function useTopDonors(params?: { limit?: number }) {
  return useQuery({
    queryKey: ['top-donors', params?.limit],
    queryFn: () => getTopDonors(params),
    staleTime: 120_000, // Tier 2 — semi-stable
  })
}

export function useTopDonorsDetailed() {
  return useQuery({
    queryKey: ['top-donors-detailed'],
    queryFn: () => getTopDonorsDetailed(),
    staleTime: 120_000, // Tier 2 — semi-stable
  })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CMS Hooks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useCmsContent(options?: HookOptions) {
  return useQuery({
    queryKey: ['cms-content'],
    queryFn: () => getCmsContent(),
    staleTime: 60_000, // ★ 1min — admin uploads reflect quickly via revalidateTag
    ...options,
  })
}

export function useCmsSections() {
  return useQuery({
    queryKey: ['cms-sections'],
    queryFn: () => getCmsSections(),
    staleTime: 60_000, // ★ 1min — admin edits reflect quickly via revalidateTag
  })
}

export function useCmsCards(params?: { sectionId?: string }) {
  return useQuery({
    queryKey: ['cms-cards', params?.sectionId],
    queryFn: () => getCmsCards(params),
    staleTime: 60_000, // ★ 1min — admin edits reflect quickly via revalidateTag
  })
}

export function useCmsSettings(options?: HookOptions) {
  return useQuery({
    queryKey: ['cms-settings'],
    queryFn: () => getCmsSettings(),
    staleTime: 60_000, // ★ 1min — admin edits reflect quickly via revalidateTag
    ...options,
  })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Skin Hooks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useSkins() {
  return useQuery({
    queryKey: ['admin-skins-catalog'],
    queryFn: () => getSkins(),
    staleTime: 300_000, // Tier 1 — stable
  })
}

export function useSkinHolders() {
  return useQuery({
    queryKey: ['admin-skin-holders'],
    queryFn: () => getSkinHolders(),
    staleTime: 300_000, // Tier 1 — stable
  })
}

export function usePlayerSkinsByAccount(accountId: string) {
  return useQuery({
    queryKey: ['player-skins', accountId],
    queryFn: () => getPlayerSkinsByAccount(accountId),
    enabled: !!accountId,
    staleTime: 30_000, // Tier 3 — dynamic
  })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Sponsor Hooks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useSponsors(params?: { tier?: string; activeOnly?: boolean }, options?: HookOptions) {
  return useQuery({
    queryKey: [params?.activeOnly ? 'sponsors-active' : 'sponsors', params?.tier],
    queryFn: () => getSponsors(params),
    staleTime: 300_000, // Tier 1 — stable
    ...options,
  })
}

export function useSponsorBanners(params?: { placement?: string; activeOnly?: boolean }) {
  return useQuery({
    queryKey: ['sponsor-banners', params?.placement],
    queryFn: () => getSponsorBanners(params),
    staleTime: 300_000, // Tier 1 — stable
  })
}

export function useSponsoredPrizes(params?: {
  sponsorId?: string
  tournamentId?: string
  activeOnly?: boolean
}) {
  return useQuery({
    queryKey: ['sponsored-prizes', params?.sponsorId, params?.tournamentId],
    queryFn: () => getSponsoredPrizes(params),
    staleTime: 300_000, // Tier 1 — stable
  })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Marketplace Hooks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useMarketplaceItems(params?: {
  category?: string
  search?: string
  status?: 'pending' | 'approved' | 'rejected' | 'all'
}) {
  return useQuery({
    queryKey: ['marketplace', params?.category, params?.search, params?.status],
    queryFn: () => getMarketplaceItems(params),
    staleTime: 120_000, // Tier 2 — semi-stable
  })
}

export function useMarketplaceItem(id: string) {
  return useQuery({
    queryKey: ['marketplace-item', id],
    queryFn: () => getMarketplaceItem(id),
    enabled: !!id,
    staleTime: 120_000, // Tier 2 — semi-stable
  })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Achievement Hooks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useAchievements(params?: { category?: string; activeOnly?: boolean }) {
  return useQuery({
    queryKey: ['achievements', params?.category, params?.activeOnly],
    queryFn: () => getAchievements(params),
    staleTime: 300_000, // Tier 1 — stable
  })
}

export function usePlayerAchievements(playerId: string) {
  return useQuery({
    queryKey: ['player-achievements-simple', playerId],
    queryFn: () => getPlayerAchievements(playerId),
    enabled: !!playerId,
    staleTime: 300_000, // Tier 1 — stable
  })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Feed Hooks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useActivityFeed(options?: HookOptions) {
  return useQuery({
    queryKey: ['activity-feed'],
    queryFn: () => getActivityFeed(),
    staleTime: 30_000, // Tier 3 — dynamic
    ...options,
  })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Stats Hooks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useStats(division?: string, options?: HookOptions) {
  return useQuery({
    queryKey: ['stats', division],
    queryFn: () => getStats(division),
    staleTime: 120_000, // Tier 2 — semi-stable
    ...options,
  })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Misc Hooks (API-delegating queries for complex endpoints)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useDivisionRivalry(options?: HookOptions) {
  return useQuery({
    queryKey: ['division-rivalry'],
    queryFn: () => getDivisionRivalry(),
    staleTime: 300_000, // Tier 1 — very static (rarely changes)
    ...options,
  })
}

export function useLeagueMatches(params?: { division?: string; limit?: number }, options?: HookOptions) {
  return useQuery({
    queryKey: ['next-match-day', params?.division],
    queryFn: () => getLeagueMatches(params),
    staleTime: 30_000, // Tier 3 — dynamic
    ...options,
  })
}

export function useLeagueMatchById(id: string, options?: HookOptions) {
  return useQuery({
    queryKey: ['league-match-detail', id],
    queryFn: () => getLeagueMatchById(id),
    enabled: !!id,
    staleTime: 30_000, // Tier 3 — dynamic
    ...options,
  })
}

export function useClubSchedule(params: { clubId: string; seasonId?: string }, options?: HookOptions) {
  return useQuery({
    queryKey: ['club-schedule', params.clubId, params.seasonId],
    queryFn: () => getClubSchedule(params),
    enabled: !!params.clubId,
    staleTime: 120_000, // Tier 2 — semi-static (changes during tournament)
    ...options,
  })
}

export function useMyTournamentStatus(params: { name: string; division: string; gamertag: string }, options?: HookOptions) {
  return useQuery({
    queryKey: ['my-tournament-status', params.name, params.division],
    queryFn: () => getMyTournamentStatus(params),
    enabled: !!params.name,
    staleTime: 30_000, // Tier 3 — dynamic
    ...options,
  })
}

export function useTournamentStatus(options?: HookOptions) {
  return useQuery({
    queryKey: ['tournament-status'],
    queryFn: () => getTournamentStatus(),
    staleTime: 120_000, // Tier 2 — semi-static
    ...options,
  })
}

export function useRankings(params?: { division?: string }, options?: HookOptions) {
  return useQuery({
    queryKey: ['admin-rankings', params?.division],
    queryFn: () => getRankings(params),
    staleTime: 120_000, // Tier 2 — semi-static
    ...options,
  })
}

export function useRankingDetail(id: string, options?: HookOptions) {
  return useQuery({
    queryKey: ['ranking-detail', id],
    queryFn: () => getRankingDetail(id),
    enabled: !!id,
    staleTime: 30_000, // Tier 3 — dynamic
    ...options,
  })
}

export function useClubUnifiedProfile(clubId: string, options?: HookOptions) {
  return useQuery({
    queryKey: ['unified-club-profile', clubId],
    queryFn: () => getClubUnifiedProfile(clubId),
    enabled: !!clubId,
    staleTime: 120_000, // Tier 2 — semi-stable
    ...options,
  })
}

export function useClubStats(clubId: string, options?: HookOptions) {
  return useQuery({
    queryKey: ['club-stats', clubId],
    queryFn: () => getClubStats(clubId),
    enabled: !!clubId,
    staleTime: 120_000, // Tier 2 — semi-stable
    ...options,
  })
}

export function useTournamentSponsors(tournamentId: string, options?: HookOptions) {
  return useQuery({
    queryKey: ['tournament-sponsors', tournamentId],
    queryFn: () => getTournamentSponsors(tournamentId),
    enabled: !!tournamentId,
    staleTime: 120_000, // Tier 2 — semi-static
    ...options,
  })
}

export function useAuditLogs(params?: { limit?: number; offset?: number; action?: string }, options?: HookOptions) {
  return useQuery({
    queryKey: ['audit-logs', params?.limit, params?.offset, params?.action],
    queryFn: () => getAuditLogs(params),
    staleTime: 30_000, // Tier 3 — dynamic
    ...options,
  })
}

export function usePlayerSeasonHistory(playerId: string, options?: HookOptions) {
  return useQuery({
    queryKey: ['player-season-history', playerId],
    queryFn: () => getPlayerSeasonHistory(playerId),
    enabled: !!playerId,
    staleTime: 120_000, // Tier 2 — semi-stable
    ...options,
  })
}

export function useWaRegistrations(params: { division?: string; status?: string; limit?: number; offset?: number }, options?: HookOptions) {
  return useQuery({
    queryKey: ['wa-registrations', params.division, params.status, params.limit, params.offset],
    queryFn: () => getWaRegistrations(params),
    staleTime: 30_000, // Tier 3 — dynamic
    ...options,
  })
}

export function useCloudinaryImages(params?: { folder?: string; max_results?: number; next_cursor?: string }, options?: HookOptions) {
  return useQuery({
    queryKey: ['cloudinary-images', params?.folder, params?.max_results, params?.next_cursor],
    queryFn: () => getCloudinaryImages(params),
    staleTime: 300_000, // Tier 1 — very static (images rarely change)
    ...options,
  })
}

export function useBackup(options?: HookOptions) {
  return useQuery({
    queryKey: ['backup'],
    queryFn: () => getBackup(),
    staleTime: 120_000, // Tier 2 — semi-static
    ...options,
  })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Live Stream Hooks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useLiveStreams(params?: { division?: string; liveOnly?: boolean; limit?: number }, options?: HookOptions) {
  return useQuery({
    queryKey: ['livestreams', params?.division, params?.liveOnly, params?.limit],
    queryFn: () => getLiveStreams(params),
    staleTime: 30_000, // Tier 3 — dynamic (live status changes frequently)
    refetchInterval: params?.liveOnly ? 60_000 : false, // Poll every 60s when filtering live only
    refetchIntervalInBackground: false,
    ...options,
  })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Reaction & Comment Hooks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useReactions(params: { targetType: string; targetId: string }, options?: HookOptions) {
  return useQuery({
    queryKey: ['reactions', params.targetType, params.targetId],
    queryFn: () => getReactions(params),
    enabled: !!params.targetType && !!params.targetId,
    staleTime: 15_000, // Tier 4 — very dynamic (reactions change quickly)
    ...options,
  })
}

export function useComments(params: { targetType: string; targetId: string; cursor?: string; limit?: number }, options?: HookOptions) {
  return useQuery({
    queryKey: ['comments', params.targetType, params.targetId, params.cursor, params.limit],
    queryFn: () => getComments(params),
    enabled: !!params.targetType && !!params.targetId,
    staleTime: 15_000, // Tier 4 — very dynamic
    ...options,
  })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Prediction Hooks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useMyPredictions(matchId?: string, options?: HookOptions) {
  return useQuery({
    queryKey: ['my-predictions', matchId],
    queryFn: () => getMyPredictions(matchId),
    staleTime: 30_000, // Tier 3 — dynamic
    ...options,
  })
}

export function useMatchPredictionStats(matchId: string | null, options?: HookOptions) {
  return useQuery({
    queryKey: ['match-prediction-stats', matchId],
    queryFn: () => getMatchPredictionStats(matchId!),
    enabled: !!matchId,
    staleTime: 30_000, // Tier 3 — dynamic
    ...options,
  })
}

export function usePredictionLeaderboard(limit?: number, options?: HookOptions) {
  return useQuery({
    queryKey: ['prediction-leaderboard', limit],
    queryFn: () => getPredictionLeaderboard(limit),
    staleTime: 120_000, // Tier 2 — semi-stable
    ...options,
  })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Historical Leaderboard Hooks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useLeaderboardHistory(params: { seasonId: string; division?: string; weekNumber?: number }, options?: HookOptions) {
  return useQuery({
    queryKey: ['leaderboard-history', params.seasonId, params.division, params.weekNumber],
    queryFn: () => getLeaderboardHistory(params),
    enabled: !!params.seasonId,
    staleTime: 120_000, // Tier 2 — semi-stable (historical data doesn't change often)
    placeholderData: (prev) => prev,
    ...options,
  })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Referral Hooks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useReferralCode(options?: HookOptions) {
  return useQuery({
    queryKey: ['referral-code'],
    queryFn: () => getReferralCode(),
    staleTime: 60_000, // Tier 2 — semi-stable
    ...options,
  })
}

export function useReferralStats(options?: HookOptions) {
  return useQuery({
    queryKey: ['referral-stats'],
    queryFn: () => getReferralStats(),
    staleTime: 30_000, // Tier 3 — dynamic
    ...options,
  })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WhatsApp Notification Hooks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useWaNotifPreferences(options?: HookOptions) {
  return useQuery({
    queryKey: ['wa-notif-preferences'],
    queryFn: () => getWaNotifPreferences(),
    staleTime: 30_000, // Tier 3 — dynamic
    ...options,
  })
}

export function useWaNotifLog(params?: { type?: string; status?: string; limit?: number; offset?: number }, options?: HookOptions) {
  return useQuery({
    queryKey: ['wa-notif-log', params?.type, params?.status, params?.limit, params?.offset],
    queryFn: () => getWaNotifLog(params),
    staleTime: 30_000, // Tier 3 — dynamic
    ...options,
  })
}
