'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, ChevronLeft, ChevronRight, Clock,
  ArrowUp, ArrowDown, Minus, Crown, Medal,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AvatarMedia } from '@/components/ui/avatar-media';
import { Skeleton } from '@/components/ui/skeleton';
import { useSeasons, useLeaderboardHistory } from '@/lib/hooks';
import { getAvatarUrl } from '@/lib/utils';
import { getDivisionTheme } from '@/hooks/use-division-theme';
import { useCommunityTheme } from '@/hooks/use-community-theme';

/* ═══════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════ */

interface HistoricalPlayer {
  playerId: string;
  gamertag: string;
  avatar: string | null;
  division: string;
  tier: string;
  club: string | null;
  points: number;
  rank: number;
  prevRank: number | null;
  rankChange: number | null;
}

interface HistoricalData {
  success: boolean;
  seasonInfo: {
    id: string;
    name: string;
    number: number;
    division: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
  };
  weekNumber: number;
  maxWeek: number;
  availableWeeks: Array<{
    weekNumber: number;
    tournamentName: string;
    status: string;
  }>;
  players: HistoricalPlayer[];
}

type DivisionFilter = 'all' | 'male' | 'female';

/* ═══════════════════════════════════════════════════════
   RANK BADGE — Shared component matching community leaderboard
   ═══════════════════════════════════════════════════════ */

function RankBadge({ rank }: { rank: number }) {
  return (
    <span className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm sm:text-base font-bold shrink-0 ${
      rank === 1
        ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-md shadow-yellow-500/25'
        : rank === 2
          ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-black shadow-md shadow-gray-400/20'
          : rank === 3
            ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-md shadow-amber-600/20'
            : 'bg-muted text-muted-foreground'
    }`}>
      {rank}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════
   POSITION CHANGE INDICATOR
   ═══════════════════════════════════════════════════════ */

function PositionChange({ rankChange }: { rankChange: number | null }) {
  if (rankChange === null || rankChange === 0) {
    return rankChange === 0 ? (
      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Minus className="w-3 h-3" />
      </span>
    ) : null;
  }

  if (rankChange > 0) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] text-green-500 font-semibold">
        <ArrowUp className="w-3 h-3" />{rankChange}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-0.5 text-[10px] text-red-500 font-semibold">
      <ArrowDown className="w-3 h-3" />{Math.abs(rankChange)}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════
   TOP 3 PODIUM
   ═══════════════════════════════════════════════════════ */

function Top3Podium({ players, division }: { players: HistoricalPlayer[]; division: string }) {
  const top3 = players.slice(0, 3);
  if (top3.length === 0) return null;

  const dt = getDivisionTheme(division as 'male' | 'female');
  const effectiveDivision = (division || 'male') as 'male' | 'female';

  // Podium order: 2nd, 1st, 3rd (middle is tallest)
  const podiumOrder = top3.length >= 3
    ? [top3[1], top3[0], top3[2]]
    : top3.length >= 2
      ? [top3[1], top3[0]]
      : [top3[0]];

  const podiumHeights = top3.length >= 3
    ? ['h-20', 'h-28', 'h-16']
    : top3.length >= 2
      ? ['h-20', 'h-28']
      : ['h-28'];

  const podiumRanks = top3.length >= 3
    ? [2, 1, 3]
    : top3.length >= 2
      ? [2, 1]
      : [1];

  return (
    <div className="flex items-end justify-center gap-3 sm:gap-4 px-2 py-4">
      {podiumOrder.map((player, idx) => {
        const rank = podiumRanks[idx];
        const height = podiumHeights[idx];
        const isFirst = rank === 1;

        return (
          <motion.div
            key={player.playerId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1, type: 'spring', stiffness: 200 }}
            className="flex flex-col items-center"
          >
            {/* Avatar + Crown */}
            <div className="relative mb-1.5">
              {isFirst && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 300 }}
                  className="absolute -top-4 left-1/2 -translate-x-1/2"
                >
                  <Crown className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                </motion.div>
              )}
              <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden ${
                isFirst ? 'ring-2 ring-idm-gold-warm/60' :
                rank === 2 ? 'ring-2 ring-gray-400/50' :
                'ring-2 ring-amber-600/50'
              }`}>
                <AvatarMedia
                  src={getAvatarUrl(player.gamertag, effectiveDivision, player.avatar)}
                  alt={player.gamertag}
                  width={56}
                  height={56}
                  className="w-full h-full"
                />
              </div>
            </div>

            {/* Name + Points */}
            <p className="text-xs sm:text-sm font-bold text-center truncate max-w-[80px] sm:max-w-[100px]">
              {player.gamertag}
            </p>
            <p className={`text-xs font-bold ${isFirst ? dt.neonText : 'text-muted-foreground'}`}>
              {player.points} pts
            </p>

            {/* Podium block */}
            <div className={`w-16 sm:w-20 ${height} rounded-t-lg mt-1.5 flex flex-col items-center justify-start pt-2 ${
              isFirst
                ? 'bg-gradient-to-t from-idm-gold-warm/20 to-idm-gold-warm/5 border border-idm-gold-warm/20'
                : rank === 2
                  ? 'bg-gradient-to-t from-gray-400/15 to-gray-400/5 border border-gray-400/15'
                  : 'bg-gradient-to-t from-amber-600/15 to-amber-600/5 border border-amber-600/15'
            }`}>
              <span className={`text-lg font-black ${
                isFirst ? 'text-idm-gold-warm' :
                rank === 2 ? 'text-gray-400' : 'text-amber-600'
              }`}>
                {rank}
              </span>
              <Medal className={`w-3.5 h-3.5 mt-0.5 ${
                isFirst ? 'text-idm-gold-warm' :
                rank === 2 ? 'text-gray-400' : 'text-amber-600'
              }`} />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PLAYER ROW
   ═══════════════════════════════════════════════════════ */

function PlayerRow({ player, idx }: { player: HistoricalPlayer; idx: number }) {
  const playerDivision = (player.division || 'male') as 'male' | 'female';
  const playerDt = getDivisionTheme(playerDivision);
  const isTop = idx < 3;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
      className={`rounded-xl border transition-all duration-200 ${
        idx === 0
          ? 'bg-gradient-to-br from-idm-gold-warm/[0.06] via-card/80 to-idm-gold-warm/[0.03] border-idm-gold-warm/20 shadow-[0_0_10px_rgba(239,249,35,0.06),0_0_20px_rgba(239,249,35,0.03)]'
          : isTop
            ? 'bg-card/60 border-border/30'
            : idx % 2 === 0
              ? 'bg-card/50 border-border/20'
              : 'bg-card/35 border-border/15'
      } hover:border-idm-gold-warm/20 hover:bg-card/70`}
    >
      <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3">
        {/* Rank */}
        <RankBadge rank={player.rank} />

        {/* Avatar */}
        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden shrink-0 ${
          idx === 0 ? 'ring-2 ring-idm-gold-warm/50' :
          idx === 1 ? 'ring-2 ring-gray-400/40' :
          idx === 2 ? 'ring-2 ring-amber-600/40' : ''
        }`}>
          <AvatarMedia
            src={getAvatarUrl(player.gamertag, playerDivision, player.avatar)}
            alt={player.gamertag}
            width={40}
            height={40}
            className="w-full h-full"
          />
        </div>

        {/* Player info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm sm:text-base font-medium truncate">{player.gamertag}</p>
            <PositionChange rankChange={player.rankChange} />
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge className={`${playerDt.badgeBg} text-[10px] border`}>
              {playerDivision === 'male' ? '🕺 Cowo' : '💃 Cewe'}
            </Badge>
            {player.club && (
              <span className="text-xs text-muted-foreground truncate">{player.club}</span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-border/40 shrink-0">
          <div className="text-center min-w-[36px]">
            <p className={`text-sm sm:text-base font-bold ${isTop ? playerDt.neonText : ''}`}>{player.points}</p>
            <p className="text-[10px] text-muted-foreground uppercase">pts</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   LOADING SKELETON
   ═══════════════════════════════════════════════════════ */

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {/* Season/week controls skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-40 rounded-lg" />
        <Skeleton className="h-9 flex-1 rounded-lg" />
      </div>

      {/* Podium skeleton */}
      <div className="flex items-end justify-center gap-4 py-4">
        <Skeleton className="w-16 h-20 rounded-t-lg" />
        <Skeleton className="w-16 h-28 rounded-t-lg" />
        <Skeleton className="w-16 h-16 rounded-t-lg" />
      </div>

      {/* Player rows skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-muted/20 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   EMPTY STATE
   ═══════════════════════════════════════════════════════ */

function EmptyState({ message }: { message: string }) {
  const ct = useCommunityTheme();
  return (
    <div className={`p-8 rounded-2xl ${ct.bgSubtle} ${ct.border} text-center`}>
      <Clock className={`w-10 h-10 mx-auto mb-3 opacity-30 ${ct.text}`} />
      <p className="text-sm text-muted-foreground">{message}</p>
      <p className="text-xs text-muted-foreground/60 mt-1">Data akan muncul setelah turnamen dimulai</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */

interface HistoricalLeaderboardProps {
  /** Pre-selected division filter */
  initialDivision?: DivisionFilter;
}

export function HistoricalLeaderboard({ initialDivision = 'all' }: HistoricalLeaderboardProps) {
  const ct = useCommunityTheme();

  // ── Local state ──
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [selectedDivision, setSelectedDivision] = useState<DivisionFilter>(initialDivision);
  const [weekNumber, setWeekNumber] = useState<number>(1);

  // ── Fetch seasons ──
  const { data: seasonsRaw, isLoading: isSeasonsLoading } = useSeasons();

  // Normalize seasons data
  const seasons = useMemo(() => {
    if (!Array.isArray(seasonsRaw)) return [];
    return seasonsRaw as Array<{
      id: string;
      name: string;
      number: number;
      division: string;
      status: string;
      startDate: string;
      endDate: string | null;
      _count?: { tournaments: number; clubs: number };
    }>;
  }, [seasonsRaw]);

  // Auto-select first active season if none selected
  React.useEffect(() => {
    if (!selectedSeasonId && seasons.length > 0) {
      const activeSeason = seasons.find(s => s.status === 'active') || seasons[0];
      setSelectedSeasonId(activeSeason.id);
    }
  }, [seasons, selectedSeasonId]);

  // Get the selected season's division
  const selectedSeason = useMemo(
    () => seasons.find(s => s.id === selectedSeasonId),
    [seasons, selectedSeasonId]
  );

  // Compute effective division for the API call
  const effectiveDivision = useMemo(() => {
    if (selectedDivision !== 'all') return selectedDivision;
    return selectedSeason?.division || 'male';
  }, [selectedDivision, selectedSeason]);

  // ── Fetch historical leaderboard ──
  const { data: historyData, isLoading: isHistoryLoading } = useLeaderboardHistory({
    seasonId: selectedSeasonId,
    division: effectiveDivision,
    weekNumber,
  }, {
    enabled: !!selectedSeasonId,
  });

  const data = historyData as HistoricalData | null;

  // Update week number when maxWeek changes
  React.useEffect(() => {
    if (data?.maxWeek && weekNumber > data.maxWeek) {
      setWeekNumber(data.maxWeek);
    }
  }, [data?.maxWeek, weekNumber]);

  // When season changes, reset week to max
  const handleSeasonChange = useCallback((value: string) => {
    setSelectedSeasonId(value);
    // Week will be auto-set by the API returning maxWeek
    setWeekNumber(999); // Large number so API defaults to maxWeek
  }, []);

  // Filter players by division if "all" is selected
  const displayPlayers = useMemo(() => {
    const players = data?.players;
    if (!players) return [];
    if (selectedDivision === 'all') return players;
    return players.filter(p => p.division === selectedDivision);
  }, [data, selectedDivision]);

  // ── Render ──

  if (isSeasonsLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* ── Controls Header ── */}
      <div className="space-y-3">
        {/* Season selector + Division filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Season dropdown */}
          <Select value={selectedSeasonId} onValueChange={handleSeasonChange}>
            <SelectTrigger className="w-full sm:w-[220px] bg-idm-gold-warm/5 border-idm-gold-warm/15">
              <SelectValue placeholder="Pilih Season..." />
            </SelectTrigger>
            <SelectContent>
              {seasons.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{s.name}</span>
                    <Badge className={`text-[9px] ${
                      s.status === 'active' ? 'bg-green-500/15 text-green-500' :
                      s.status === 'completed' ? 'bg-idm-gold-warm/15 text-idm-gold-warm' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {s.status === 'active' ? '🟢 Aktif' : s.status === 'completed' ? '🏆 Selesai' : '📅 Akan Datang'}
                    </Badge>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Division filter pills */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-idm-gold-warm/5 border border-idm-gold-warm/10 shrink-0">
            {([
              { key: 'all' as DivisionFilter, label: 'Semua' },
              { key: 'male' as DivisionFilter, label: 'Cowo' },
              { key: 'female' as DivisionFilter, label: 'Cewe' },
            ]).map(f => (
              <button
                key={f.key}
                onClick={() => setSelectedDivision(f.key)}
                className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-md transition-all whitespace-nowrap cursor-pointer ${
                  selectedDivision === f.key
                    ? 'bg-idm-gold-warm/15 text-idm-gold-warm shadow-sm shadow-idm-gold-warm/10 border border-idm-gold-warm/25'
                    : 'text-muted-foreground/70 hover:text-foreground border border-transparent hover:bg-muted/40'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Week slider */}
        {data && data.maxWeek > 0 && (
          <div className={`rounded-xl ${ct.bgSubtle} ${ct.border} p-3 sm:p-4`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 ${ct.text}`} />
                <span className="text-sm font-semibold">Minggu</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge className={`${ct.casinoBadge} text-[11px]`}>
                  {data.weekNumber} / {data.maxWeek}
                </Badge>
                {data.availableWeeks.find(w => w.weekNumber === data.weekNumber)?.status === 'completed' && (
                  <Badge className="bg-green-500/15 text-green-500 text-[10px]">Selesai</Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setWeekNumber(Math.max(1, weekNumber - 1))}
                disabled={weekNumber <= 1}
                className="p-1.5 rounded-lg hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex-1">
                <Slider
                  value={[weekNumber]}
                  min={1}
                  max={data.maxWeek}
                  step={1}
                  onValueChange={([v]) => setWeekNumber(v)}
                  className="w-full"
                />
              </div>

              <button
                onClick={() => setWeekNumber(Math.min(data.maxWeek, weekNumber + 1))}
                disabled={weekNumber >= data.maxWeek}
                className="p-1.5 rounded-lg hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Week markers */}
            <div className="flex items-center justify-between mt-1.5 px-1">
              {data.availableWeeks.map(w => (
                <button
                  key={w.weekNumber}
                  onClick={() => setWeekNumber(w.weekNumber)}
                  className={`text-[10px] font-medium px-1 py-0.5 rounded cursor-pointer transition-all ${
                    w.weekNumber === data.weekNumber
                      ? `${ct.text} ${ct.bg} shadow-sm`
                      : w.status === 'completed'
                        ? 'text-muted-foreground hover:text-foreground'
                        : 'text-muted-foreground/40'
                  }`}
                >
                  W{w.weekNumber}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Loading State ── */}
      {isHistoryLoading && <LoadingSkeleton />}

      {/* ── Empty State ── */}
      {!isHistoryLoading && data && displayPlayers.length === 0 && (
        <EmptyState
          message={
            !selectedSeasonId
              ? 'Pilih season untuk melihat riwayat peringkat'
              : data.maxWeek === 0
                ? `Belum ada turnamen di ${data.seasonInfo?.name || 'season ini'}`
                : 'Tidak ada data pemain untuk periode ini'
          }
        />
      )}

      {/* ── Leaderboard Content ── */}
      {!isHistoryLoading && data && displayPlayers.length > 0 && (
        <div className="space-y-3">
          {/* Season info badge */}
          <div className="flex items-center gap-2 px-1">
            <div className={`w-5 h-5 rounded ${ct.iconBg} flex items-center justify-center shrink-0`}>
              <Trophy className={`w-3 h-3 ${ct.neonText}`} />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Peringkat Minggu {data.weekNumber}
            </h3>
            <Badge className={`${ct.casinoBadge} ml-auto text-[10px]`}>
              {data.seasonInfo?.name || `S${data.seasonInfo?.number || '?'}`}
            </Badge>
          </div>

          {/* Top 3 Podium */}
          {displayPlayers.length >= 2 && (
            <div className={`rounded-2xl ${ct.bgSubtle} ${ct.border} overflow-hidden`}>
              <Top3Podium players={displayPlayers} division={effectiveDivision} />
            </div>
          )}

          {/* Player list — skip top 3 if podium is shown */}
          <div className="space-y-2 sm:max-h-[680px] sm:overflow-y-auto custom-scrollbar pr-0.5">
            <AnimatePresence mode="popLayout">
              {displayPlayers.slice(displayPlayers.length >= 2 ? 3 : 0).map((player, idx) => (
                <PlayerRow
                  key={player.playerId}
                  player={player}
                  idx={displayPlayers.length >= 2 ? idx + 3 : idx}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
