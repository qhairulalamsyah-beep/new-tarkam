// ─── Realtime Shared Constants & Types ───
// ★ ZERO external SDK imports — safe for client bundle.
// Used by the polling-based useRealtime hook for cache invalidation mapping.

// ═══════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════

/** Realtime is now polling-based — always false for WebSocket flag */
export const NEXT_PUBLIC_REALTIME_ENABLED = false

/** Consolidated channel name — kept for API compatibility */
export const REALTIME_CHANNEL = 'idm-realtime'

// ═══════════════════════════════════════════════════════════
// EVENT CONSTANTS
// ═══════════════════════════════════════════════════════════

export const REALTIME_EVENTS = {
  // Feed
  DONATION_APPROVED: 'donation-approved',
  DONATION_REJECTED: 'donation-rejected',
  FEED_UPDATED: 'feed-updated',
  PLAYER_REGISTERED: 'player-registered',
  CLUB_MEMBER_CHANGED: 'club-member-changed',

  // Leaderboard
  LEADERBOARD_UPDATED: 'leaderboard-updated',

  // Tournament
  TOURNAMENT_CREATED: 'tournament-created',
  TOURNAMENT_SCORED: 'tournament-scored',
  TOURNAMENT_FINALIZED: 'tournament-finalized',
  TOURNAMENT_STATUS_CHANGED: 'tournament-status-changed',

  // League
  LEAGUE_MATCH_SCORED: 'league-match-scored',
  SEASON_CLOSED: 'season-closed',
} as const

export type RealtimeEvent = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS]

// ═══════════════════════════════════════════════════════════
// CONNECTION STATUS
// ═══════════════════════════════════════════════════════════

export type RealtimeConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'reconnecting'

// ═══════════════════════════════════════════════════════════
// REACT QUERY CACHE INVALIDATION MAPPING
// ═══════════════════════════════════════════════════════════

export const EVENT_TO_QUERY_KEYS: Record<RealtimeEvent, string[]> = {
  'donation-approved': ['feed', 'donations', 'top-donors'],
  'donation-rejected': ['donations', 'feed'],
  'feed-updated': ['feed', 'stats', 'admin-players'],
  'player-registered': ['feed', 'stats', 'tournament-overview', 'admin-players'],
  'club-member-changed': ['feed', 'stats', 'clubs', 'admin-players'],
  'leaderboard-updated': ['leaderboard', 'rankings', 'stats', 'admin-players'],
  'tournament-created': ['stats', 'feed', 'tournament-overview'],
  'tournament-scored': ['stats', 'feed'],
  'tournament-finalized': ['stats', 'feed', 'tournament-overview', 'my-tournament-status'],
  'tournament-status-changed': ['stats', 'feed', 'tournament-overview', 'my-tournament-status'],
  'league-match-scored': ['stats', 'feed'],
  'season-closed': ['stats', 'feed'],
}

/**
 * Get the React Query keys that should be invalidated for a given event.
 */
export function getInvalidationKeys(event: RealtimeEvent): string[] {
  return EVENT_TO_QUERY_KEYS[event] || ['stats']
}
