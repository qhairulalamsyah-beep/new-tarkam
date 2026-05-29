'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { LIVE_TOURNAMENT_STATUSES } from '@/lib/smart-polling'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

// ═══════════════════════════════════════════════════════════
// ★ SMART POLLING REALTIME HOOK
// Uses tournament status to dynamically adjust polling interval:
//   - LIVE (main_event / finalization) → 60s
//   - IDLE (other / no active tournament) → 300s
//
// This is far more efficient than fixed 300s polling because
// tournaments only run ~4 hours/week (Wed/Thu 20:30-00:30 WIB).
// ═══════════════════════════════════════════════════════════

const LIVE_POLL_INTERVAL = 60_000   // 1 minute when tournament is live
const IDLE_POLL_INTERVAL = 300_000  // 5 minutes when no tournament is live

const INVALIDATE_KEYS = ['stats', 'feed', 'activity-feed'] as const

export function useRealtime(enabled = true) {
  const qc = useQueryClient()
  const qcRef = useRef(qc)

  useEffect(() => {
    qcRef.current = qc
  }, [qc])

  useEffect(() => {
    if (!enabled) return

    // Batched invalidation helper — only refetch active (mounted) queries
    const invalidateActive = () => {
      for (const key of INVALIDATE_KEYS) {
        qcRef.current.invalidateQueries({ queryKey: [key], refetchType: 'active' })
      }
    }

    // Smart polling: check tournament status on each interval cycle
    // and adjust the interval dynamically
    let currentTimeout: ReturnType<typeof setTimeout> | null = null

    const scheduleNextPoll = () => {
      // Read tournament status from React Query cache
      const { isLive } = getTournamentLiveStatusFromQc(qcRef.current)
      const interval = isLive ? LIVE_POLL_INTERVAL : IDLE_POLL_INTERVAL

      currentTimeout = setTimeout(() => {
        invalidateActive()
        scheduleNextPoll() // Re-evaluate status for next cycle
      }, interval)
    }

    // Start the first poll cycle
    scheduleNextPoll()

    // Debounced visibility change — avoid burst invalidations on rapid tab switches
    let visibilityDebounce: ReturnType<typeof setTimeout> | null = null

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if (visibilityDebounce) clearTimeout(visibilityDebounce)
        visibilityDebounce = setTimeout(() => {
          invalidateActive()
          // Re-evaluate polling schedule when tab becomes visible
          if (currentTimeout) clearTimeout(currentTimeout)
          scheduleNextPoll()
          visibilityDebounce = null
        }, 2000)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (currentTimeout) clearTimeout(currentTimeout)
      if (visibilityDebounce) clearTimeout(visibilityDebounce)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled])

  return { connectionStatus: 'connected' as ConnectionStatus }
}

/**
 * Read tournament live status directly from queryClient (not from query callback)
 */
function getTournamentLiveStatusFromQc(qc: ReturnType<typeof useQueryClient>): {
  isLive: boolean;
} {
  try {
    const statusData = qc.getQueryData(['tournament-status']) as {
      male?: { status: string | null };
      female?: { status: string | null };
    } | undefined

    const maleLive = LIVE_TOURNAMENT_STATUSES.has(statusData?.male?.status || '')
    const femaleLive = LIVE_TOURNAMENT_STATUSES.has(statusData?.female?.status || '')

    return { isLive: maleLive || femaleLive }
  } catch {
    return { isLive: false }
  }
}
