'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { AppShell } from '@/components/idm/app-shell';
import { ErrorBoundary } from '@/components/idm/error-boundary';
import type { HeroData } from '@/lib/hero-data';

interface ClientAppProps {
  heroData?: HeroData;
}

export function ClientApp({ heroData }: ClientAppProps) {
  const [queryClient] = useState(
    () => {
      const qc = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 300_000, // ★ 5min — content rarely changes (tournaments weekly Wed/Thu)
            refetchOnWindowFocus: false, // Don't refetch on focus — reduces API calls
            refetchOnMount: false, // ★ Don't refetch on mount if data is still fresh
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      });

      // ══════════════════════════════════════════════════════════════════
      // ★ HYDRATE: Pre-populate React Query cache with SSR hero data.
      // This ensures the hero section renders instantly without skeleton.
      // Full stats data is fetched client-side by React Query.
      // ══════════════════════════════════════════════════════════════════
      if (heroData) {
        // Hydrate CMS content
        qc.setQueryData(['cms-content'], { settings: heroData.settings, sections: {} });

        // ★ Hydrate tournament status for smart polling — critical for
        // getSmartPollingInterval() to work on first render without API call.
        // Without this, smart polling assumes IDLE until /api/tournament-status responds.
        qc.setQueryData(['tournament-status'], {
          male: {
            tournamentId: null,
            status: heroData.tournamentStatus.male.status,
            name: null,
            weekNumber: null,
            isRegistrationOpen: heroData.tournamentStatus.male.isRegistrationOpen,
          },
          female: {
            tournamentId: null,
            status: heroData.tournamentStatus.female.status,
            name: null,
            weekNumber: null,
            isRegistrationOpen: heroData.tournamentStatus.female.isRegistrationOpen,
          },
        });

        // ★ Build lightweight male stats from hero data for the hero section.
        // React Query will fetch the FULL stats from /api/stats client-side,
        // but this pre-hydration means the hero section renders immediately.
        if (heroData.topMalePlayer) {
          const lightweightMaleStats = {
            hasData: true,
            division: 'male',
            totalPlayers: heroData.totalPlayers,
            topPlayers: [heroData.topMalePlayer],
            clubs: [],
            weeklyChampions: heroData.latestChampionClub ? [{
              weekNumber: heroData.latestChampionClub.weekNumber,
              tournamentName: '',
              prizePool: 0,
              winnerTeam: {
                name: heroData.latestChampionClub.name,
                // ★ Include synthetic player with club info so the hero section's
                // championClubInfo computation works immediately from SSR data.
                // Without this, the club card can't render until the full /api/stats
                // response arrives 2-4s later.
                players: [{
                  id: '__ssr__',
                  gamertag: '',
                  club: {
                    id: '__ssr__',
                    name: heroData.latestChampionClub.name,
                    logo: heroData.latestChampionClub.logo,
                  },
                }],
              },
              mvp: heroData.latestChampionClub.mvp,
            }] : [],
            tournamentStatus: heroData.tournamentStatus.male,
            skinMap: {},
          };
          qc.setQueryData(['stats', 'male', null], lightweightMaleStats);
        }
      }

      return qc;
    }
  );

  // ★ Non-blocking: init deferred until after page render
  // NOTE: Only fires ONCE per session — uses sessionStorage to prevent repeated DB queries
  useEffect(() => {
    // Skip if already initialized this session
    if (typeof window !== 'undefined' && sessionStorage.getItem('tarkam-admin-initialized')) return;

    const deferInit = () => {
      // Init admin — fire and forget (only creates if none exists)
      fetch('/api/init-admin', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            sessionStorage.setItem('tarkam-admin-initialized', '1');
          }
        })
        .catch(() => {});
    };

    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(deferInit, { timeout: 5000 });
    } else {
      setTimeout(deferInit, 5000);
    }
  }, []);

  // ★ Version check — less aggressive polling (every 10min in dev, 5min in prod)
  // Disabled when NEXT_PUBLIC_DISABLE_POLLING=true to save quota
  useEffect(() => {
    const disablePolling = process.env.NEXT_PUBLIC_DISABLE_POLLING === 'true';
    if (disablePolling) return; // ★ Skip version polling in dev mode

    let lastVersion: string | null = null;

    const checkVersion = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (lastVersion !== null && data.version !== lastVersion) {
          queryClient.invalidateQueries({ refetchType: 'active' });
        }
        lastVersion = data.version;
      } catch {
        // Silent fail
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 600_000); // 10min — less aggressive than 5min
    return () => clearInterval(interval);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AppShell />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
