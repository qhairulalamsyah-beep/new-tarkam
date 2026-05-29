// ─── Realtime Event Trigger ───
// Real-time event broadcasting is a no-op — data freshness is handled
// by React Query polling (useRealtime hook invalidates caches every 2 minutes).

// Channel and event constants (kept for API compatibility)
export const PUSHER_CHANNELS = {
  FEED: 'idm-feed',
  LEADERBOARD: 'idm-leaderboard',
  TOURNAMENT: 'idm-tournament',
  LEAGUE: 'idm-league',
} as const;

export const PUSHER_EVENTS = {
  DONATION_APPROVED: 'donation-approved',
  DONATION_REJECTED: 'donation-rejected',
  FEED_UPDATED: 'feed-updated',
  PLAYER_REGISTERED: 'player-registered',
  CLUB_MEMBER_CHANGED: 'club-member-changed',
  LEADERBOARD_UPDATED: 'leaderboard-updated',
  TOURNAMENT_CREATED: 'tournament-created',
  TOURNAMENT_SCORED: 'tournament-scored',
  TOURNAMENT_FINALIZED: 'tournament-finalized',
  TOURNAMENT_STATUS_CHANGED: 'tournament-status-changed',
  LEAGUE_MATCH_SCORED: 'league-match-scored',
  SEASON_CLOSED: 'season-closed',
} as const;

/**
 * No-op trigger — events are no longer broadcast via WebSocket.
 * Data freshness is handled by React Query polling (2-min intervals).
 */
export async function pusherTrigger(
  channel: string,
  event: string,
  _data: Record<string, unknown>
): Promise<void> {
  // No-op: polling handles data freshness
}
