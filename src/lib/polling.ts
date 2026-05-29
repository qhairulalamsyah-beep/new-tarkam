// ─── Polling Utility ───
// When NEXT_PUBLIC_DISABLE_POLLING=true, all polling is disabled.
// Data still refreshes on manual page reload or navigation.
//
// Usage: refetchInterval: getPollingInterval(300000) // returns false in dev, 300000 in prod

const disablePolling = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DISABLE_POLLING === 'true'

/**
 * Returns the polling interval, or `false` if polling is disabled via NEXT_PUBLIC_DISABLE_POLLING.
 * Use this for all `refetchInterval` values to respect the dev-mode quota saver flag.
 */
export function getPollingInterval(intervalMs: number | false): number | false {
  if (disablePolling) return false
  return intervalMs
}
