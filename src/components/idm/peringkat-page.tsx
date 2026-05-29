'use client';

import { useState, useCallback } from 'react';
import { Award } from 'lucide-react';
import type { StatsData } from '@/types/stats';
import { useStats } from '@/lib/hooks';
import { smartRefetchInterval } from '@/lib/smart-polling';

// Lazy load section components
import dynamic from 'next/dynamic';
const PeringkatSection = dynamic(() => import('./landing/peringkat-section').then(m => ({ default: m.PeringkatSection })), { ssr: false, loading: () => <div className="min-h-[280px] sm:min-h-[480px]" /> });
const PlayerProfile = dynamic(() => import('./player-profile').then(m => ({ default: m.PlayerProfile })), { ssr: false, loading: () => null });
const ClubProfile = dynamic(() => import('./club-profile').then(m => ({ default: m.ClubProfile })), { ssr: false, loading: () => null });

export function PeringkatPage() {

  // State
  const [selectedPlayerRaw, setSelectedPlayerRaw] = useState<StatsData['topPlayers'][0] & { division?: string } | null>(null);
  const [selectedClub, setSelectedClub] = useState<(StatsData['clubs'][0] & { division?: string }) | null>(null);

  const setSelectedPlayer = useCallback((player: typeof selectedPlayerRaw) => {
    setSelectedPlayerRaw(player);
  }, []);

  // Data fetching — male stats
  const { data: maleData, isLoading: isMaleLoading } = useStats('male', {
    staleTime: 120000,
    refetchOnMount: 'always', // ★ FIX: Always refetch on mount — SSR hydrates only 1 player, need full data ASAP
    refetchInterval: smartRefetchInterval(60_000, 300_000),
    refetchIntervalInBackground: false,
    gcTime: 300000,
    select: (d: any) => d as StatsData,
  }) as { data: StatsData | undefined; isLoading: boolean };

  // Data fetching — female stats
  const { data: femaleData, isLoading: isFemaleLoading } = useStats('female', {
    staleTime: 120000,
    refetchOnMount: 'always', // ★ FIX: Always refetch on mount — SSR hydrates only 1 player, need full data ASAP
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
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
              <Award className="w-5 h-5 text-idm-gold-warm" /> Peringkat
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Klasemen pemain dan klub terbaik</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        <PeringkatSection
          maleData={maleData}
          femaleData={femaleData}
          isDataLoading={isDataLoading}
          setSelectedPlayer={setSelectedPlayer}
          setSelectedClub={setSelectedClub}
          hideHeader
          showAll
        />
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
