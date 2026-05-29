'use client';

import React from 'react';
import { Users, Shield, Music, Trophy, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AvatarMedia } from '@/components/ui/avatar-media';
import { ClubLogoImage } from '@/components/idm/club-logo-image';
import { getAvatarUrl } from '@/lib/utils';
import type { StatsData, TopPlayer } from '@/types/stats';

type DivisionFilter = 'all' | 'male' | 'female';

/* ═══════════════════════════════════════════
   PeringkatHeader — Sort toggle + Division filter
   ═══════════════════════════════════════════ */
export function PeringkatHeader({
  leaderboardSort,
  onLeaderboardSortChange,
  divisionFilter,
  onDivisionFilterChange,
  maleData,
  femaleData,
}: {
  leaderboardSort: 'players' | 'clubs';
  onLeaderboardSortChange: (s: 'players' | 'clubs') => void;
  divisionFilter: DivisionFilter;
  onDivisionFilterChange: (d: DivisionFilter) => void;
  maleData?: StatsData;
  femaleData?: StatsData;
}) {
  const maleCount = maleData?.topPlayers?.length ?? 0;
  const femaleCount = femaleData?.topPlayers?.length ?? 0;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      {/* Sort toggle: Players / Clubs */}
      <div className="flex items-center gap-1 bg-idm-gold-warm/5 border border-idm-gold-warm/10 rounded-lg p-1">
        {(['players', 'clubs'] as const).map(sort => (
          <button
            key={sort}
            onClick={() => onLeaderboardSortChange(sort)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              leaderboardSort === sort
                ? 'bg-idm-gold-warm/15 text-idm-gold-warm shadow-sm border border-idm-gold-warm/25'
                : 'text-muted-foreground/70 hover:text-foreground border border-transparent hover:bg-muted/40'
            }`}
          >
            {sort === 'players' ? <Users className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
            {sort === 'players' ? 'Pemain' : 'Club'}
          </button>
        ))}
      </div>

      {/* Division filter */}
      <div className="flex items-center gap-1 bg-idm-gold-warm/5 border border-idm-gold-warm/10 rounded-lg p-1">
        {([
          { key: 'all' as DivisionFilter, label: 'Semua' },
          { key: 'male' as DivisionFilter, label: '♂ Cowo', count: maleCount },
          { key: 'female' as DivisionFilter, label: '♀ Cewe', count: femaleCount },
        ]).map(div => (
          <button
            key={div.key}
            onClick={() => onDivisionFilterChange(div.key)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              divisionFilter === div.key
                ? 'bg-idm-gold-warm/15 text-idm-gold-warm shadow-sm border border-idm-gold-warm/25'
                : 'text-muted-foreground/70 hover:text-foreground border border-transparent hover:bg-muted/40'
            }`}
          >
            {div.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   CommunityLeaderboard — Player & Club ranking list
   ═══════════════════════════════════════════ */
export function CommunityLeaderboard({
  maleData,
  femaleData,
  onPlayerClick,
  onClubClick,
  leaderboardSort,
  divisionFilter,
  maxPlayers = 10,
  maxClubs = 6,
  showAll = false,
  onViewAll,
}: {
  maleData?: StatsData;
  femaleData?: StatsData;
  onPlayerClick: (player: TopPlayer & { division?: string }, division: 'male' | 'female') => void;
  onClubClick: (club: StatsData['clubs'][0]) => void;
  leaderboardSort: 'players' | 'clubs';
  onLeaderboardSortChange: (s: 'players' | 'clubs') => void;
  divisionFilter: DivisionFilter;
  onDivisionFilterChange: (d: DivisionFilter) => void;
  maxPlayers?: number;
  maxClubs?: number;
  showAll?: boolean;
  onViewAll?: () => void;
}) {
  // Merge players based on division filter
  const allPlayers: (TopPlayer & { division: 'male' | 'female' })[] = [];
  if (divisionFilter === 'all' || divisionFilter === 'male') {
    for (const p of maleData?.topPlayers ?? []) {
      allPlayers.push({ ...p, division: 'male' });
    }
  }
  if (divisionFilter === 'all' || divisionFilter === 'female') {
    for (const p of femaleData?.topPlayers ?? []) {
      allPlayers.push({ ...p, division: 'female' });
    }
  }
  // Sort by points descending
  allPlayers.sort((a, b) => (b.points || 0) - (a.points || 0));
  const displayPlayers = showAll ? allPlayers : allPlayers.slice(0, maxPlayers);

  // Merge clubs
  const allClubs = [...(maleData?.clubs ?? []), ...(femaleData?.clubs ?? [])];
  // Deduplicate clubs by id
  const uniqueClubs = Array.from(new Map(allClubs.map(c => [c.id, c])).values());
  uniqueClubs.sort((a, b) => (b.points || 0) - (a.points || 0));
  const displayClubs = showAll ? uniqueClubs : uniqueClubs.slice(0, maxClubs);

  if (leaderboardSort === 'clubs') {
    return (
      <div className="space-y-2">
        {displayClubs.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground/50">Belum ada data club</p>
          </div>
        ) : (
          displayClubs.map((club, idx) => (
            <button
              key={club.id}
              onClick={() => onClubClick(club)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/30 bg-card/60 hover:bg-card/80 hover:border-idm-gold-warm/20 transition-all cursor-pointer group"
            >
              {/* Rank */}
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                idx === 0 ? 'bg-yellow-400/15 text-yellow-400 border border-yellow-400/25'
                : idx === 1 ? 'bg-gray-300/15 text-gray-300 border border-gray-300/25'
                : idx === 2 ? 'bg-amber-500/15 text-amber-500 border border-amber-500/25'
                : 'bg-muted/20 text-muted-foreground border border-border/10'
              }`}>
                {idx + 1}
              </span>
              {/* Logo */}
              <ClubLogoImage clubName={club.name} dbLogo={club.logo} alt={club.name} width={32} height={32} className="w-8 h-8 rounded-lg object-cover" />
              {/* Info */}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-bold truncate">{club.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] text-muted-foreground/60">{club._count?.members || 0} anggota</span>
                  <span className="text-[9px] text-idm-gold-warm/70 font-bold">{club.wins}W-{club.losses}L</span>
                </div>
              </div>
              {/* Points */}
              <div className="shrink-0 text-right">
                <p className="text-xs font-black text-idm-gold-warm tabular-nums">{(club.points || 0).toLocaleString('id-ID')}</p>
                <p className="text-[8px] text-muted-foreground/50 uppercase">pts</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-idm-gold-warm/50 transition-colors shrink-0" />
            </button>
          ))
        )}
        {!showAll && uniqueClubs.length > maxClubs && onViewAll && (
          <button onClick={onViewAll} className="w-full text-center py-3 text-xs font-semibold text-idm-gold-warm/70 hover:text-idm-gold-warm transition-colors cursor-pointer">
            Lihat Semua ({uniqueClubs.length} Club)
          </button>
        )}
      </div>
    );
  }

  // Players leaderboard
  return (
    <div className="space-y-2">
      {displayPlayers.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground/50">Belum ada data pemain</p>
        </div>
      ) : (
        displayPlayers.map((player, idx) => (
          <button
            key={`${player.id}-${player.division}`}
            onClick={() => onPlayerClick(player, player.division)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/30 bg-card/60 hover:bg-card/80 hover:border-idm-gold-warm/20 transition-all cursor-pointer group"
          >
            {/* Rank */}
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
              idx === 0 ? 'bg-yellow-400/15 text-yellow-400 border border-yellow-400/25'
              : idx === 1 ? 'bg-gray-300/15 text-gray-300 border border-gray-300/25'
              : idx === 2 ? 'bg-amber-500/15 text-amber-500 border border-amber-500/25'
              : 'bg-muted/20 text-muted-foreground border border-border/10'
            }`}>
              {idx + 1}
            </span>
            {/* Avatar */}
            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
              <AvatarMedia
                src={getAvatarUrl(player.gamertag, player.division, player.avatar)}
                alt={player.gamertag}
                width={32}
                height={32}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-bold truncate">{player.gamertag}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge className={`text-[7px] font-bold border px-1 py-0 ${
                  player.division === 'male'
                    ? 'bg-idm-male/10 text-idm-male-light border-idm-male/15'
                    : 'bg-idm-female/10 text-idm-female-light border-idm-female/15'
                }`}>
                  {player.division === 'male' ? '♂ Cowo' : '♀ Cewe'}
                </Badge>
                {player.club && (
                  <span className="text-[9px] text-muted-foreground/60 truncate">
                    {typeof player.club === 'object' && player.club?.name ? player.club.name : ''}
                  </span>
                )}
                <span className="text-[9px] text-green-500/70 font-bold">{player.totalWins}W</span>
              </div>
            </div>
            {/* Points */}
            <div className="shrink-0 text-right">
              <p className="text-xs font-black text-idm-gold-warm tabular-nums">{(player.points || 0).toLocaleString('id-ID')}</p>
              <p className="text-[8px] text-muted-foreground/50 uppercase">pts</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-idm-gold-warm/50 transition-colors shrink-0" />
          </button>
        ))
      )}
      {!showAll && allPlayers.length > maxPlayers && onViewAll && (
        <button onClick={onViewAll} className="w-full text-center py-3 text-xs font-semibold text-idm-gold-warm/70 hover:text-idm-gold-warm transition-colors cursor-pointer">
          Lihat Semua ({allPlayers.length} Pemain)
        </button>
      )}
    </div>
  );
}
