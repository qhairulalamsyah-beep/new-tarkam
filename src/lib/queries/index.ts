// ─── Data Access Layer — Re-exports ───
// Central import point for all query functions
// ★ All queries delegate to API routes (fetch('/api/...')) → Prisma → Neon PostgreSQL

// Players
export {
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
  type Player,
  type PlayerSearchParams,
  type PlayerSearchResult,
  type PlayerLeaderboardParams,
  type PlayerCompareResult,
  type PlayerCompareData,
  type PlayerStreakResult,
  type PlayerPointBreakdown,
} from './players'

// Seasons
export {
  getSeasons,
  getSeasonById,
  getSeasonResults,
  type SeasonDetailResponse,
} from './seasons'

// Tournaments
export {
  getTournaments,
  getTournamentById,
  getTournamentParticipants,
  getTournamentOverview,
  getTournamentRegistrations,
  getApprovedPlayers,
} from './tournaments'

// Matches
export {
  getMatches,
  getLiveMatches,
  getLiveMatchCount,
  getRecentMatches,
  getNextMatches,
} from './matches'

// Clubs
export {
  getClubs,
  getClubById,
  getClubLeaderboard,
  getClubMembers,
  getClubStats,
} from './clubs'

// Donations
export {
  getDonations,
  getTopDonors,
  getTopDonorsDetailed,
} from './donations'

// CMS
export {
  getCmsSections,
  getCmsCards,
  getCmsSettings,
  getCmsContent,
} from './cms'

// Skins
export {
  getSkins,
  getSkinHolders,
  getPlayerSkinsByAccount,
  type SkinResult,
  type SkinHolderResult,
} from './skins'

// Sponsors
export {
  getSponsors,
  getSponsorBanners,
  getSponsoredPrizes,
} from './sponsors'

// Marketplace
export {
  getMarketplaceItems,
  getMarketplaceItem,
} from './marketplace'

// Achievements
export {
  getAchievements,
  getPlayerAchievements,
  type AchievementResult,
} from './achievements'

// Feed
export {
  getActivityFeed,
  type FeedItem,
} from './feed'

// Stats
export {
  getStats,
  type StatsResponse,
} from './stats'

// Misc (API-delegating queries for complex endpoints)
export {
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
  getWaNotifPreferences,
  updateWaNotifPreferences,
  sendTestWaNotification,
  sendWaNotification,
  getWaNotifLog,
} from './misc'
