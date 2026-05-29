// ═══════════════════════════════════════════════════════════
// SMART POLLING — Dynamic polling intervals based on tournament status
// ═══════════════════════════════════════════════════════════
//
// Tournaments run only 4 hours per week (Wed/Thu 20:30-00:30 WIB).
// The rest of the time, aggressive polling is wasteful.
//
// This utility uses React Query's refetchInterval function API
// which receives the query object with access to queryClient.
// On each interval cycle, it checks tournament status from cache
// and returns the appropriate interval:
//   - LIVE (main_event / finalization) → liveInterval (e.g. 60s)
//   - IDLE (other / no active tournament) → idleInterval (e.g. 300-600s)
//
// ★ Tournament status values (from Prisma schema):
//   "setup" | "registration" | "approval" | "team_generation" |
//   "bracket_generation" | "main_event" | "finalization" | "completed"
// ═══════════════════════════════════════════════════════════

// Re-export getPollingInterval for backward compat
export { getPollingInterval } from './polling';

/** Tournament statuses that mean matches are currently being played */
export const LIVE_TOURNAMENT_STATUSES = new Set(['main_event', 'finalization']);

/**
 * Check if any tournament is currently live by reading React Query cache.
 * Uses the query object from React Query's refetchInterval callback.
 *
 * Returns { isLive, maleLive, femaleLive } for granular control.
 */
export function getTournamentLiveStatus(query: any): {
  isLive: boolean;
  maleLive: boolean;
  femaleLive: boolean;
} {
  try {
    const statusData = query.getClient().getQueryData(['tournament-status']) as {
      male?: { status: string | null };
      female?: { status: string | null };
    } | undefined;

    const maleLive = LIVE_TOURNAMENT_STATUSES.has(statusData?.male?.status || '');
    const femaleLive = LIVE_TOURNAMENT_STATUSES.has(statusData?.female?.status || '');

    return { isLive: maleLive || femaleLive, maleLive, femaleLive };
  } catch {
    // Cache not available yet — assume idle
    return { isLive: false, maleLive: false, femaleLive: false };
  }
}

/**
 * Smart refetchInterval function for React Query.
 *
 * React Query calls this function on every interval cycle, so it always
 * gets the freshest tournament status from cache.
 *
 * @param liveInterval  - Interval when tournament is LIVE (e.g. 60_000 = 60s)
 * @param idleInterval  - Interval when tournament is IDLE (e.g. 300_000 = 5min)
 * @returns A function compatible with React Query's refetchInterval option
 *
 * @example
 * useQuery({
 *   queryKey: ['stats', 'male'],
 *   refetchInterval: smartRefetchInterval(60_000, 300_000),
 * })
 */
export function smartRefetchInterval(
  liveInterval: number,
  idleInterval: number
): (query: any) => number | false {
  return (query: any) => {
    // Respect dev-mode polling disable flag
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DISABLE_POLLING === 'true') {
      return false;
    }

    const { isLive } = getTournamentLiveStatus(query);
    return isLive ? liveInterval : idleInterval;
  };
}
