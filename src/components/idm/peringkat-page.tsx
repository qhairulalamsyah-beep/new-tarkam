'use client';

import { useState, useCallback } from 'react';
import { Award, Clock } from 'lucide-react';
import type { StatsData } from '@/types/stats';
import { useStats } from '@/lib/hooks';
import { smartRefetchInterval } from '@/lib/smart-polling';
import { useCommunityTheme } from '@/hooks/use-community-theme';

// Lazy load section components
import dynamic from 'next/dynamic';
const PeringkatSection = dynamic(() => import('./landing/peringkat-section').then(m => ({ default: m.PeringkatSection })), { ssr: false, loading: () => <div className="min-h-[280px] sm:min-h-[480px]" /> });
const PlayerProfile = dynamic(() => import('./player-profile').then(m => ({ default: m.PlayerProfile })), { ssr: false, loading: () => null });
const ClubProfile = dynamic(() => import('./club-profile').then(m => ({ default: m.ClubProfile })), { ssr: false, loading: () => null });
const HistoricalLeaderboard = dynamic(() => import('./historical-leaderboard').then(m => ({ default: m.HistoricalLeaderboard })), { ssr: false, loading: () => <div className="min-h-[280px] sm:min-h-[480px]" /> });

type ViewMode = 'current' | 'history';

export function PeringkatPage() {
  const ct = useCommunityTheme();

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('current');
  const [selectedPlayerRaw, setSelectedPlayerRaw] = useState<StatsData['topPlayers'][0] & { division?: string } | null>(null);
  const [selectedClub, setSelectedClub] = useState<(StatsData['clubs'][0] & { division?: string }) | null>(null);

  const setSelectedPlayer = useCallback((player: typeof selectedPlayerRaw) => {
    setSelectedPlayerRaw(player);
  }, []);

  // Data fetching — male stats
  const { data: maleData, isLoading: isMaleLoading } = useStats('male', {
    staleTime: 120000,
    refetchOnMount: 'always',
    refetchInterval: smartRefetchInterval(60_000, 300_000),
    refetchIntervalInBackground: false,
    gcTime: 300000,
    select: (d: any) => d as StatsData,
  }) as { data: StatsData | undefined; isLoading: boolean };

  // Data fetching — female stats
  const { data: femaleData, isLoading: isFemaleLoading } = useStats('female', {
    staleTime: 120000,
    refetchOnMount: 'always',
    refetchInterval: smartRefetchInterval(60_000, 330_000),
    refetchIntervalInBackground: false,
    gcTime: 300000,
    select: (d: any) => d as StatsData,
  }) as { data: StatsData | undefined; isLoading: boolean };

  const isDataLoading = isMaleLoading || isFemaleLoading;

  return (
    <div className="bg-background">
      {/* Page Title Banner */}
      <div className="border-b border-idm-gold-warm/10 bg-gradient-to-b from-idm-gold-warm/[0.03] to-transparent px-4 py-5 sm:py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <Award className="w-5 h-5 text-idm-gold-warm" /> Peringkat
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {viewMode === 'current' ? 'Klasemen pemain dan klub terbaik' : 'Riwayat peringkat per minggu'}
              </p>
            </div>

            {/* View mode toggle */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-idm-gold-warm/5 border border-idm-gold-warm/10 shrink-0">
              <button
                onClick={() => setViewMode('current')}
                className={`compact-pill flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  viewMode === 'current'
                    ? `bg-idm-gold-warm/15 text-idm-gold-warm shadow-sm border border-idm-gold-warm/25`
                    : 'text-muted-foreground hover:text-foreground border border-transparent'
                }`}
              >
                <Award className="w-3 h-3" /> Saat Ini
              </button>
              <button
                onClick={() => setViewMode('history')}
                className={`compact-pill flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  viewMode === 'history'
                    ? `bg-idm-gold-warm/15 text-idm-gold-warm shadow-sm border border-idm-gold-warm/25`
                    : 'text-muted-foreground hover:text-foreground border border-transparent'
                }`}
              >
                <Clock className="w-3 h-3" /> Riwayat
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        {viewMode === 'current' ? (
          <PeringkatSection
            maleData={maleData}
            femaleData={femaleData}
            isDataLoading={isDataLoading}
            setSelectedPlayer={setSelectedPlayer}
            setSelectedClub={setSelectedClub}
            hideHeader
            showAll
          />
        ) : (
          <div className="px-4 py-6 sm:py-8">
            <HistoricalLeaderboard />
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedPlayerRaw && (
        <PlayerProfile
          player={selectedPlayerRaw}
          onClose={() => setSelectedPlayerRaw(null)}
          skinMap={{ ...maleData?.skinMap, ...femaleData?.skinMap }}
        />
      )}

      {selectedClub && (
        <ClubProfile
          club={selectedClub}
          onClose={() => setSelectedClub(null)}
        />
      )}
    </div>
  );
}
