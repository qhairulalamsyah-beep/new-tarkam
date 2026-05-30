'use client';

import React from 'react';
import {
  Loader2, Star, Crown, Zap, Trophy, Flame, Shield, Music,
  X, ChevronRight, Swords, Clock, ArrowLeft,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { getAvatarUrl, toStrictDivision } from '@/lib/utils';
import { AvatarMedia } from '@/components/ui/avatar-media';
import { useMatchDetail } from '@/lib/hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactionsBar } from '@/components/idm/reactions-bar';
import { CommentsSection } from '@/components/idm/comments-section';
import { MatchPrediction } from '@/components/idm/match-prediction';

/* ─── Types ─── */

interface PlayerInfo {
  id: string;
  gamertag: string;
  name: string;
  avatar?: string | null;
  division: string;
  tier: string;
  points: number;
  totalWins: number;
  totalMvp: number;
  matches: number;
  streak: number;
  maxStreak: number;
  winRate: number;
  club: { id: string; name: string; logo?: string | null } | null;
}

interface TeamInfo {
  id: string;
  name: string;
  players: PlayerInfo[];
}

interface MvpInfo {
  id: string;
  gamertag: string;
  name: string;
  avatar?: string | null;
  division: string;
  tier: string;
  points: number;
  totalWins: number;
  totalMvp: number;
  matches: number;
  streak: number;
}

interface TimelineEvent {
  order: number;
  playerId: string;
  amount: number;
  reason: string;
  description: string;
  createdAt: string;
}

interface H2HMatch {
  id: string;
  tournamentName: string;
  weekNumber: number;
  score1: number | null;
  score2: number | null;
  winnerId: string | null;
  completedAt: string | null;
  bracket: string;
  round: number;
}

interface MatchDetailData {
  id: string;
  tournamentId: string;
  round: number;
  matchNumber: number;
  bracket: string;
  groupLabel?: string | null;
  format: string;
  score1: number | null;
  score2: number | null;
  status: string;
  scheduledAt: string | null;
  completedAt: string | null;
  tournament: {
    id: string;
    name: string;
    weekNumber: number;
    division: string;
    status: string;
    defaultMatchFormat: string;
    season: { id: string; name: string; number: number };
  };
  team1: TeamInfo | null;
  team2: TeamInfo | null;
  winnerId: string | null;
  winner: { id: string; name: string } | null;
  loserId: string | null;
  mvpPlayer: MvpInfo | null;
  timeline: TimelineEvent[];
  headToHead: H2HMatch[];
}

export interface MatchDetailPageProps {
  matchId: string | null;
  onClose: () => void;
  preview?: {
    team1Name: string;
    team2Name: string;
    score1: number | null;
    score2: number | null;
    week?: number;
    status?: string;
    bracket?: string;
    round?: number;
    division?: string;
  };
}

/* ─── Division config ─── */
const DIVISION_HEX = {
  male: '#57B5FF',
  female: '#FF5C9A',
} as const;

/* ─── Bracket/Round label helper ─── */
function getRoundLabel(bracket: string, round: number): string {
  switch (bracket) {
    case 'grand_final': return '🏆 Grand Final';
    case 'third_place': return '🥉 3rd Place';
    case 'upper': return `Upper R${round}`;
    case 'lower': return `Lower R${round}`;
    case 'swiss': return `Swiss R${round}`;
    case 'group': return `Group R${round}`;
    default: return `R${round}`;
  }
}

/* ─── Stat Comparison Bar ─── */
function ComparisonBar({
  label,
  value1,
  value2,
  icon: Icon,
  divisionHex,
}: {
  label: string;
  value1: number;
  value2: number;
  icon: React.ElementType;
  divisionHex: string;
}) {
  const max = Math.max(value1, value2, 1);
  const pct1 = (value1 / max) * 100;
  const pct2 = (value2 / max) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-black tabular-nums text-foreground/90 w-10 text-right">{value1}</span>
        <div className="flex items-center gap-1.5 flex-1 justify-center">
          <Icon className="w-3 h-3 opacity-50" />
          <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">{label}</span>
        </div>
        <span className="text-sm font-black tabular-nums text-foreground/90 w-10 text-left">{value2}</span>
      </div>
      <div className="flex items-center gap-1.5 h-2.5">
        {/* Left bar (team1) */}
        <div className="flex-1 h-full rounded-full bg-muted/10 overflow-hidden flex justify-end">
          <motion.div
            className="h-full rounded-full"
            style={{ background: divisionHex }}
            initial={{ width: 0 }}
            animate={{ width: `${pct1}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        {/* Right bar (team2) */}
        <div className="flex-1 h-full rounded-full bg-muted/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: divisionHex, opacity: 0.7 }}
            initial={{ width: 0 }}
            animate={{ width: `${pct2}%` }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Head-to-Head Mini Card ─── */
function H2HMiniCard({ match, currentTeam1Id, currentTeam2Id }: {
  match: H2HMatch;
  currentTeam1Id: string;
  currentTeam2Id: string;
}) {
  // Determine which team won from the perspective of the current match's team1
  // In h2h, team1/team2 might be swapped relative to current match
  const isTeam1Winner = match.winnerId === currentTeam1Id;
  const isTeam2Winner = match.winnerId === currentTeam2Id;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/20 border border-border/10">
      <div className="text-[9px] text-muted-foreground font-semibold shrink-0">W{match.weekNumber}</div>
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <span className={`text-xs font-bold ${isTeam1Winner ? 'text-green-500' : ''}`}>
          {match.score1 ?? '-'}
        </span>
        <span className="text-[9px] text-muted-foreground">-</span>
        <span className={`text-xs font-bold ${isTeam2Winner ? 'text-green-500' : ''}`}>
          {match.score2 ?? '-'}
        </span>
      </div>
      <div className="text-[9px] text-muted-foreground truncate">{match.tournamentName}</div>
    </div>
  );
}

/* ─── Main Component ─── */
export function MatchDetailPage({ matchId, onClose, preview }: MatchDetailPageProps) {
  const dt = useDivisionTheme();

  // Use React Query hook for data fetching — avoids setState-in-effect lint issues
  const { data: matchDetailResponse, isLoading: loading } = useMatchDetail(matchId);
  const detail = (matchDetailResponse?.success && matchDetailResponse?.data)
    ? (matchDetailResponse.data as MatchDetailData)
    : null;

  const isOpen = matchId !== null;
  const data = detail;

  // Fallback to preview data while loading
  const tournament = data?.tournament;
  const division = tournament?.division || preview?.division || 'male';
  const divisionHex = DIVISION_HEX[division as keyof typeof DIVISION_HEX] || DIVISION_HEX.male;
  const week = tournament?.weekNumber ?? preview?.week ?? 0;
  const bracket = data?.bracket ?? preview?.bracket ?? 'upper';
  const round = data?.round ?? preview?.round ?? 1;
  const score1 = data?.score1 ?? preview?.score1 ?? null;
  const score2 = data?.score2 ?? preview?.score2 ?? null;
  const status = data?.status ?? preview?.status ?? 'pending';

  const team1 = data?.team1;
  const team2 = data?.team2;
  const team1Name = team1?.name ?? preview?.team1Name ?? 'Team 1';
  const team2Name = team2?.name ?? preview?.team2Name ?? 'Team 2';
  const mvpPlayer = data?.mvpPlayer;

  const isCompleted = status === 'completed';
  const isLive = status === 'live';
  const isUpcoming = !isLive && !isCompleted;
  const winner1 = isCompleted && score1 !== null && score2 !== null && score1 > score2;
  const winner2 = isCompleted && score1 !== null && score2 !== null && score2 > score1;
  const isDraw = isCompleted && score1 !== null && score2 !== null && score1 === score2;

  // Stats from team players (use first player as representative, or aggregate)
  const p1 = team1?.players?.[0];
  const p2 = team2?.players?.[0];

  const statusLabel = isCompleted ? 'Selesai' : isLive ? 'Live' : 'Akan Datang';
  const statusColor = isCompleted
    ? 'bg-green-500/10 text-green-500 border-green-500/20'
    : isLive
      ? 'bg-red-500/10 text-red-500 border-red-500/20'
      : `${dt.bg} ${dt.text}`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className={`modal-container modal-container-lg modal-enter-slide p-0 gap-0 overflow-hidden ${
          division === 'male' ? 'modal-container-male' : division === 'female' ? 'modal-container-female' : ''
        }`}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Detail Match — {team1Name} vs {team2Name}</DialogTitle>
        <DialogDescription className="sr-only">
          Detail pertandingan tarkam {team1Name} vs {team2Name}, skor {score1 ?? '-'}-{score2 ?? '-'}
        </DialogDescription>

        {/* ═══ Header: Back + Week, Round, Status ═══ */}
        <div className={`modal-header ${division === 'male' ? 'modal-header-male' : division === 'female' ? 'modal-header-female' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <button onClick={onClose} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-idm-gold-warm transition-colors" aria-label="Kembali">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="font-medium">Kembali</span>
            </button>
            {/* Close X button */}
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all" aria-label="Tutup">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${dt.bg} ${dt.text} text-[10px] font-bold`}>Week {week}</Badge>
            <Badge variant="outline" className="text-[10px] font-medium">{getRoundLabel(bracket, round)}</Badge>
            {data?.format && (
              <Badge variant="outline" className="text-[10px] font-medium">{data.format}</Badge>
            )}
            <Badge className={`${statusColor} text-[10px] font-bold border`}>
              {isLive && (
                <span className="relative flex h-1.5 w-1.5 mr-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                </span>
              )}
              {statusLabel}
            </Badge>
            {/* Division badge */}
            <Badge
              className="text-[9px] font-bold border-0 ml-auto"
              style={{ backgroundColor: `${divisionHex}15`, color: divisionHex }}
            >
              {division === 'male' ? '🕺 Cowo' : '💃 Cewe'}
            </Badge>
          </div>
          {/* Tournament name */}
          {tournament?.name && (
            <p className="text-[10px] text-muted-foreground mt-1.5 truncate">{tournament.name} · Season {tournament.season?.number ?? '?'}</p>
          )}
        </div>

        {/* ═══ VS Section — Side-by-side player cards ═══ */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            {/* Team 1 Card */}
            <div className={`flex-1 text-center transition-all duration-300 ${!winner1 && isCompleted && !isDraw ? 'opacity-50' : ''}`}>
              {/* Avatar */}
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-2">
                <div
                  className="absolute -inset-1 rounded-full"
                  style={{
                    background: winner1
                      ? `linear-gradient(135deg, ${divisionHex}, ${divisionHex}60, transparent, ${divisionHex}40)`
                      : `linear-gradient(135deg, ${divisionHex}30, ${divisionHex}10, transparent)`,
                    padding: '2px',
                  }}
                >
                  <div className="w-full h-full rounded-full bg-background/50" />
                </div>
                {p1 ? (
                  <AvatarMedia
                    src={getAvatarUrl(p1.gamertag, toStrictDivision(division), p1.avatar)}
                    alt={p1.gamertag}
                    width={80}
                    height={80}
                    className="w-full h-full object-cover rounded-full relative z-10"
                    loading="lazy"
                  />
                ) : (
                  <div className={`w-full h-full rounded-full ${dt.iconBg} flex items-center justify-center relative z-10`}>
                    <Music className={`w-6 h-6 ${dt.text}`} />
                  </div>
                )}
                {/* Winner Crown */}
                {winner1 && (
                  <motion.div
                    className="absolute -top-2 left-1/2 -translate-x-1/2 z-20"
                    initial={{ scale: 0, y: 10 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.3 }}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
                      style={{
                        background: 'linear-gradient(135deg, #EFF923, #F9CB25)',
                        boxShadow: `0 0 8px ${divisionHex}60`,
                      }}
                    >
                      <Crown className="w-3.5 h-3.5 text-stone-900" />
                    </div>
                  </motion.div>
                )}
              </div>
              {/* Name */}
              <p className={`text-sm font-bold truncate ${winner1 ? dt.neonText : 'text-foreground/80'}`}>
                {team1Name}
              </p>
              {p1 && (
                <p className="text-[10px] text-muted-foreground truncate">{p1.gamertag}</p>
              )}
              {p1?.club && (
                <p className="text-[9px] text-idm-gold-warm/60 truncate">{p1.club.name}</p>
              )}
            </div>

            {/* Score Center */}
            <div className="flex flex-col items-center shrink-0 px-3">
              <div className="flex items-center gap-3">
                <motion.span
                  className={`text-3xl sm:text-4xl font-black tabular-nums ${winner1 ? dt.neonGradient : 'text-foreground/30'}`}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  {score1 ?? '-'}
                </motion.span>
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isLive ? 'bg-red-500/10' : isCompleted ? `${dt.bgSubtle}` : `${dt.iconBg}`
                    }`}
                  >
                    {isLive ? (
                      <Radio className="w-4 h-4 text-red-500" />
                    ) : isCompleted ? (
                      <Swords className={`w-4 h-4 ${dt.neonText}`} />
                    ) : (
                      <Swords className={`w-4 h-4 ${dt.text}`} />
                    )}
                  </div>
                  <span className="text-[8px] text-muted-foreground font-semibold uppercase">
                    {isCompleted ? 'FT' : isLive ? 'LIVE' : 'vs'}
                  </span>
                </div>
                <motion.span
                  className={`text-3xl sm:text-4xl font-black tabular-nums ${winner2 ? dt.neonGradient : 'text-foreground/30'}`}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.05 }}
                >
                  {score2 ?? '-'}
                </motion.span>
              </div>
              {/* Score bar visual */}
              {score1 !== null && score2 !== null && (score1 + score2) > 0 && (
                <div className="mt-2 w-24 h-1.5 rounded-full bg-muted/10 overflow-hidden flex">
                  <motion.div
                    className="h-full rounded-l-full"
                    style={{ background: divisionHex }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(score1 / (score1 + score2)) * 100}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                  <motion.div
                    className="h-full rounded-r-full"
                    style={{ background: divisionHex, opacity: 0.5 }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(score2 / (score1 + score2)) * 100}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              )}
            </div>

            {/* Team 2 Card */}
            <div className={`flex-1 text-center transition-all duration-300 ${!winner2 && isCompleted && !isDraw ? 'opacity-50' : ''}`}>
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-2">
                <div
                  className="absolute -inset-1 rounded-full"
                  style={{
                    background: winner2
                      ? `linear-gradient(135deg, ${divisionHex}, ${divisionHex}60, transparent, ${divisionHex}40)`
                      : `linear-gradient(135deg, ${divisionHex}30, ${divisionHex}10, transparent)`,
                    padding: '2px',
                  }}
                >
                  <div className="w-full h-full rounded-full bg-background/50" />
                </div>
                {p2 ? (
                  <AvatarMedia
                    src={getAvatarUrl(p2.gamertag, toStrictDivision(division), p2.avatar)}
                    alt={p2.gamertag}
                    width={80}
                    height={80}
                    className="w-full h-full object-cover rounded-full relative z-10"
                    loading="lazy"
                  />
                ) : (
                  <div className={`w-full h-full rounded-full ${dt.iconBg} flex items-center justify-center relative z-10`}>
                    <Shield className={`w-6 h-6 ${dt.text}`} />
                  </div>
                )}
                {winner2 && (
                  <motion.div
                    className="absolute -top-2 left-1/2 -translate-x-1/2 z-20"
                    initial={{ scale: 0, y: 10 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.3 }}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
                      style={{
                        background: 'linear-gradient(135deg, #EFF923, #F9CB25)',
                        boxShadow: `0 0 8px ${divisionHex}60`,
                      }}
                    >
                      <Crown className="w-3.5 h-3.5 text-stone-900" />
                    </div>
                  </motion.div>
                )}
              </div>
              <p className={`text-sm font-bold truncate ${winner2 ? dt.neonText : 'text-foreground/80'}`}>
                {team2Name}
              </p>
              {p2 && (
                <p className="text-[10px] text-muted-foreground truncate">{p2.gamertag}</p>
              )}
              {p2?.club && (
                <p className="text-[9px] text-idm-gold-warm/60 truncate">{p2.club.name}</p>
              )}
            </div>
          </div>
        </div>

        {/* ═══ Loading indicator ═══ */}
        {loading && !data && (
          <div className="py-8 text-center">
            <Loader2 className={`w-5 h-5 mx-auto animate-spin ${dt.text}`} />
            <p className="text-[10px] text-muted-foreground mt-2">Memuat detail match...</p>
          </div>
        )}

        {/* ═══ Scrollable Content ═══ */}
        {data && (
          <div className="modal-body-compact modal-scroll space-y-4">

            {/* ═══ MVP Badge ═══ */}
            <AnimatePresence>
              {mvpPlayer && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="mx-5 p-3 sm:p-4 rounded-xl border"
                  style={{
                    background: `linear-gradient(135deg, rgba(239,249,35,0.08), rgba(249,203,37,0.04))`,
                    borderColor: 'rgba(239,249,35,0.15)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: 'linear-gradient(135deg, rgba(239,249,35,0.2), rgba(249,203,37,0.1))',
                      }}
                    >
                      <Star className="w-5 h-5 text-idm-gold-warm" />
                    </div>
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                        <AvatarMedia
                          src={getAvatarUrl(mvpPlayer.gamertag, toStrictDivision(division), mvpPlayer.avatar)}
                          alt={mvpPlayer.gamertag}
                          width={32}
                          height={32}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-idm-gold-warm truncate">{mvpPlayer.gamertag}</p>
                        <p className="text-[9px] text-muted-foreground">
                          {mvpPlayer.totalMvp}× MVP · {mvpPlayer.points} pts
                        </p>
                      </div>
                    </div>
                    <Badge
                      className="text-[9px] font-black border-0 shrink-0"
                      style={{
                        background: 'linear-gradient(135deg, #EFF923, #F9CB25)',
                        color: '#1c1917',
                      }}
                    >
                      ⭐ MVP
                    </Badge>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ═══ Team Rosters ═══ */}
            <div className="px-5 space-y-3">
              {/* Team 1 Roster */}
              {team1 && team1.players.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-bold ${winner1 ? dt.neonText : 'text-foreground/60'} uppercase tracking-wider`}>
                      {team1Name}
                    </span>
                    {winner1 && <Badge className="bg-green-500/10 text-green-500 text-[8px] border-0">Menang</Badge>}
                    <span className="text-[9px] text-muted-foreground">· {team1.players.length} pemain</span>
                  </div>
                  <div className="space-y-1">
                    {team1.players.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/20">
                        <div className="w-6 h-6 rounded-full overflow-hidden shrink-0">
                          <AvatarMedia
                            src={getAvatarUrl(p.gamertag, toStrictDivision(division), p.avatar)}
                            alt={p.gamertag}
                            width={24}
                            height={24}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <span className="text-[11px] font-semibold flex-1 truncate">{p.gamertag}</span>
                        <Badge className={`text-[7px] border-0 px-1 py-0 ${
                          p.tier === 'S' ? 'bg-idm-gold-warm/15 text-idm-gold-warm' :
                          p.tier === 'A' ? 'bg-purple-500/15 text-purple-500' :
                          'bg-muted/30 text-muted-foreground'
                        }`}>
                          {p.tier}
                        </Badge>
                        <span className="text-[9px] text-muted-foreground tabular-nums w-8 text-right">{p.points}p</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Divider */}
              <div className={`h-px ${dt.borderSubtle}`} />

              {/* Team 2 Roster */}
              {team2 && team2.players.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-bold ${winner2 ? dt.neonText : 'text-foreground/60'} uppercase tracking-wider`}>
                      {team2Name}
                    </span>
                    {winner2 && <Badge className="bg-green-500/10 text-green-500 text-[8px] border-0">Menang</Badge>}
                    <span className="text-[9px] text-muted-foreground">· {team2.players.length} pemain</span>
                  </div>
                  <div className="space-y-1">
                    {team2.players.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/20">
                        <div className="w-6 h-6 rounded-full overflow-hidden shrink-0">
                          <AvatarMedia
                            src={getAvatarUrl(p.gamertag, toStrictDivision(division), p.avatar)}
                            alt={p.gamertag}
                            width={24}
                            height={24}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <span className="text-[11px] font-semibold flex-1 truncate">{p.gamertag}</span>
                        <Badge className={`text-[7px] border-0 px-1 py-0 ${
                          p.tier === 'S' ? 'bg-idm-gold-warm/15 text-idm-gold-warm' :
                          p.tier === 'A' ? 'bg-purple-500/15 text-purple-500' :
                          'bg-muted/30 text-muted-foreground'
                        }`}>
                          {p.tier}
                        </Badge>
                        <span className="text-[9px] text-muted-foreground tabular-nums w-8 text-right">{p.points}p</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ═══ Stats Comparison ═══ */}
            {p1 && p2 && (
              <div className="px-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-4 h-4 rounded ${dt.iconBg} flex items-center justify-center`}>
                    <Flame className={`w-2.5 h-2.5 ${dt.text}`} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Perbandingan Stat</span>
                  <div className={`flex-1 h-px ${dt.borderSubtle}`} />
                </div>
                <div className="p-4 rounded-xl bg-muted/10 border border-border/5 space-y-3">
                  <ComparisonBar label="Poin" value1={p1.points} value2={p2.points} icon={Zap} divisionHex={divisionHex} />
                  <ComparisonBar label="Menang" value1={p1.totalWins} value2={p2.totalWins} icon={Trophy} divisionHex={divisionHex} />
                  <ComparisonBar label="Match" value1={p1.matches} value2={p2.matches} icon={Swords} divisionHex={divisionHex} />
                  <ComparisonBar label="Win Rate" value1={p1.winRate} value2={p2.winRate} icon={Flame} divisionHex={divisionHex} />
                  <ComparisonBar label="Streak" value1={p1.streak} value2={p2.streak} icon={Flame} divisionHex={divisionHex} />
                </div>
              </div>
            )}

            {/* ═══ Match Timeline ═══ */}
            <div className="px-5">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-4 h-4 rounded ${dt.iconBg} flex items-center justify-center`}>
                  <Clock className={`w-2.5 h-2.5 ${dt.text}`} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Timeline Skor</span>
                <div className={`flex-1 h-px ${dt.borderSubtle}`} />
              </div>
              {data.timeline.length > 0 ? (
                <div className="space-y-0 pl-3 relative">
                  {/* Vertical line */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-px" style={{ background: `linear-gradient(180deg, ${divisionHex}40, ${divisionHex}10, transparent)` }} />
                  {data.timeline.map((event, idx) => {
                    const isTeam1Player = team1?.players.some(p => p.id === event.playerId);
                    const isTeam2Player = team2?.players.some(p => p.id === event.playerId);
                    return (
                      <motion.div
                        key={event.id ?? idx}
                        className="flex items-start gap-3 py-2 relative"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: idx * 0.05 }}
                      >
                        {/* Dot on the line */}
                        <div
                          className="w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 z-10 flex items-center justify-center"
                          style={{
                            background: isTeam1Player ? divisionHex : isTeam2Player ? `${divisionHex}80` : 'bg-muted/30',
                            boxShadow: `0 0 6px ${divisionHex}40`,
                          }}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-background" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-foreground/80">
                              {event.reason}
                            </span>
                            {event.amount !== 0 && (
                              <Badge className="text-[7px] border-0 px-1 py-0 bg-idm-gold-warm/10 text-idm-gold-warm">
                                {event.amount > 0 ? '+' : ''}{event.amount}p
                              </Badge>
                            )}
                          </div>
                          {event.description && (
                            <p className="text-[9px] text-muted-foreground truncate">{event.description}</p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-4 text-center">
                  <Clock className="w-5 h-5 text-muted-foreground/20 mx-auto mb-1.5" />
                  <p className="text-[10px] text-muted-foreground/50">Detail skor belum tersedia</p>
                </div>
              )}
            </div>

            {/* ═══ Head-to-Head ═══ */}
            {data.headToHead.length > 0 && (
              <div className="px-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-4 h-4 rounded ${dt.iconBg} flex items-center justify-center`}>
                    <Swords className={`w-2.5 h-2.5 ${dt.text}`} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Head-to-Head</span>
                  <div className={`flex-1 h-px ${dt.borderSubtle}`} />
                  <Badge className={`${dt.bg} ${dt.text} text-[8px] border-0`}>{data.headToHead.length}</Badge>
                </div>
                <div className="space-y-1.5">
                  {data.headToHead.map((h2h) => (
                    <H2HMiniCard
                      key={h2h.id}
                      match={h2h}
                      currentTeam1Id={team1?.id ?? ''}
                      currentTeam2Id={team2?.id ?? ''}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ═══ Reactions ═══ */}
            {data && (
              <div className="px-5">
                <div className={`h-px ${dt.borderSubtle} mb-4`} />
                <ReactionsBar targetType="match" targetId={data.id} />
              </div>
            )}

            {/* ═══ Prediction ═══ */}
            {data && (
              <div className="px-5">
                <MatchPrediction
                  matchId={data.id}
                  team1={team1 ? { id: team1.id, name: team1.name } : null}
                  team2={team2 ? { id: team2.id, name: team2.name } : null}
                  matchStatus={status}
                  winnerId={data.winnerId}
                  division={division}
                />
              </div>
            )}

            {/* ═══ Comments ═══ */}
            {data && (
              <div className="px-5">
                <CommentsSection targetType="match" targetId={data.id} />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Radio icon (inline to avoid import issues) ─── */
function Radio({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
      <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
      <circle cx="12" cy="12" r="2" />
      <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
      <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
    </svg>
  );
}
