'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play, Loader2, Zap, ChevronDown, ChevronUp, ExternalLink, Trophy,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { getTournaments, getMatches, getStats } from '@/lib/queries';
import { useDivisionTheme } from '@/hooks/use-division-theme';

/* ===== Types ===== */
interface LiveMatchTeam {
  id: string;
  name: string;
}

interface LiveMatch {
  id: string;
  round: number;
  matchNumber: number;
  bracket: string;
  status: string;
  format: string;
  score1: number | null;
  score2: number | null;
  team1Id: string | null;
  team2Id: string | null;
  winnerId: string | null;
  team1: LiveMatchTeam | null;
  team2: LiveMatchTeam | null;
  winner?: { id: string; name: string } | null;
}

interface LiveTournament {
  id: string;
  name: string;
  weekNumber: number;
  status: string;
  format: string;
  bpm: number | null;
}

/* ===== Status Badge Config ===== */
const MATCH_STATUS_CONFIG: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  live:     { bg: 'bg-red-500/10',   text: 'text-red-500',   icon: '🔴', label: 'LIVE' },
  ready:    { bg: 'bg-green-500/10',  text: 'text-green-500', icon: '🟢', label: 'Siap' },
  pending:  { bg: 'bg-yellow-500/10', text: 'text-yellow-500', icon: '⏳', label: 'Menunggu' },
  completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: '✅', label: 'Selesai' },
};

const BRACKET_SHORT: Record<string, string> = {
  upper: 'UB',
  lower: 'LB',
  grand_final: 'GF',
  group: 'GRP',
  swiss: 'SW',
};

/* ===== Props ===== */
interface LiveMatchFeedProps {
  division: string;
  onNavigateToTournament?: (tournamentId: string) => void;
}

/* ===== Component ===== */
export function LiveMatchFeed({ division, onNavigateToTournament }: LiveMatchFeedProps) {
  const dt = useDivisionTheme();
  const qc = useQueryClient();
  const [expandedTournaments, setExpandedTournaments] = useState<Set<string>>(new Set());

  // ─── Get season ID ───
  const { data: stats } = useQuery({
    queryKey: ['stats', division],
    queryFn: () => getStats(division),
  });
  const seasonId = stats?.season?.id;

  // ─── Fetch active (main_event) tournaments ───
  const { data: liveTournaments, isLoading: isLoadingTournaments } = useQuery<LiveTournament[]>({
    queryKey: ['admin-live-tournaments', seasonId],
    queryFn: async () => {
      if (!seasonId) return [];
      const data = await getTournaments({ seasonId, status: 'main_event' });
      const list = Array.isArray(data) ? data : [];
      // Sort by weekNumber desc, limit to 3
      return list
        .filter((t: any) => t.status === 'main_event')
        .sort((a: any, b: any) => b.weekNumber - a.weekNumber)
        .slice(0, 3)
        .map((t: any) => ({
          id: t.id,
          name: t.name,
          weekNumber: t.weekNumber,
          status: t.status,
          format: t.format,
          bpm: t.bpm,
        }));
    },
    enabled: !!seasonId,
    refetchInterval: 15000,
  });

  // ─── Fetch matches for each tournament ───
  const tournamentIds = liveTournaments?.map(t => t.id) || [];

  const { data: matchesData, isLoading: isLoadingMatches } = useQuery({
    queryKey: ['admin-live-matches', tournamentIds],
    queryFn: async () => {
      if (tournamentIds.length === 0) return {};
      const results: Record<string, LiveMatch[]> = {};
      await Promise.all(
        tournamentIds.map(async (tid) => {
          try {
            const res = await getMatches({ tournamentId: tid, limit: 100 });
            results[tid] = Array.isArray(res?.data) ? res.data : [];
          } catch {
            results[tid] = [];
          }
        })
      );
      return results;
    },
    enabled: tournamentIds.length > 0,
    refetchInterval: 15000,
  });

  // ─── Start Match Mutation ───
  const startMatchMutation = useMutation({
    mutationFn: async ({ tournamentId, matchId }: { tournamentId: string; matchId: string }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/start-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ matchId }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-live-matches'] });
      qc.invalidateQueries({ queryKey: ['admin-live-tournaments'] });
      toast.success('Match dimulai!');
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  // ─── Toggle tournament expanded ───
  const toggleExpanded = (tid: string) => {
    setExpandedTournaments(prev => {
      const next = new Set(prev);
      if (next.has(tid)) next.delete(tid);
      else next.add(tid);
      return next;
    });
  };

  // ─── Loading state ───
  if (isLoadingTournaments || isLoadingMatches) {
    return (
      <Card className="border-red-500/20 bg-red-500/[0.02]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-red-500 font-bold">LIVE EVENT</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // ─── No live tournaments ───
  if (!liveTournaments || liveTournaments.length === 0) {
    return null;
  }

  return (
    <Card className="border-red-500/20 bg-red-500/[0.02]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <span className="text-red-500 font-bold">LIVE EVENT</span>
          <Badge className="text-[10px] border-0 bg-red-500/10 text-red-500">{liveTournaments.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {liveTournaments.map((tournament) => {
          const matches = matchesData?.[tournament.id] || [];
          const isExpanded = expandedTournaments.has(tournament.id);

          // Match stats
          const liveMatches = matches.filter(m => m.status === 'live');
          const readyMatches = matches.filter(m => m.status === 'ready' || m.status === 'pending');
          const completedMatches = matches.filter(m => m.status === 'completed');
          const totalMatches = matches.length;
          const playableMatches = matches.filter(m => m.team1Id && m.team2Id);
          const completedPlayable = playableMatches.filter(m => m.status === 'completed').length;
          const totalPlayable = playableMatches.length;
          const progressPct = totalPlayable > 0 ? Math.round((completedPlayable / totalPlayable) * 100) : 0;

          // Auto-expand if there are live matches
          const shouldExpand = isExpanded || liveMatches.length > 0;

          return (
            <div
              key={tournament.id}
              className="rounded-lg border border-red-500/15 bg-red-500/[0.03] overflow-hidden"
            >
              {/* Tournament Header */}
              <button
                type="button"
                onClick={() => toggleExpanded(tournament.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-red-500/[0.05] transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-red-500/10 shrink-0">
                    <Zap className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{tournament.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge className="text-[10px] border-0 bg-red-500/10 text-red-500">🔴 LIVE</Badge>
                      <span className="text-xs text-muted-foreground">Week {tournament.weekNumber}</span>
                      {tournament.bpm && (
                        <span className="text-xs text-muted-foreground">🎵 {tournament.bpm} BPM</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Compact stats pills */}
                  <div className="hidden sm:flex items-center gap-1">
                    {liveMatches.length > 0 && (
                      <Badge className="text-[10px] border-0 bg-red-500/10 text-red-500 gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        {liveMatches.length}
                      </Badge>
                    )}
                    {readyMatches.length > 0 && (
                      <Badge className="text-[10px] border-0 bg-green-500/10 text-green-500">{readyMatches.length} siap</Badge>
                    )}
                    {completedPlayable > 0 && (
                      <Badge className="text-[10px] border-0 bg-emerald-500/10 text-emerald-400">{completedPlayable}/{totalPlayable}</Badge>
                    )}
                  </div>
                  {shouldExpand ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Expanded: Progress bar + Match feed */}
              {shouldExpand && (
                <div className="px-3 pb-3 space-y-2">
                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-idm-gold-warm transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                      {completedPlayable}/{totalPlayable} ({progressPct}%)
                    </span>
                  </div>

                  {/* Match feed — compact list */}
                  <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
                    {/* Live matches first */}
                    {liveMatches.map(match => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        tournamentId={tournament.id}
                        onStart={startMatchMutation}
                        onGoToScoring={() => onNavigateToTournament?.(tournament.id)}
                      />
                    ))}
                    {/* Ready matches */}
                    {readyMatches.filter(m => m.team1Id && m.team2Id).map(match => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        tournamentId={tournament.id}
                        onStart={startMatchMutation}
                        onGoToScoring={() => onNavigateToTournament?.(tournament.id)}
                      />
                    ))}
                    {/* Completed matches — show last 3 */}
                    {completedMatches.slice(-3).reverse().map(match => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        tournamentId={tournament.id}
                        onStart={startMatchMutation}
                        onGoToScoring={() => onNavigateToTournament?.(tournament.id)}
                      />
                    ))}
                  </div>

                  {/* Go to Scoring button */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-xs gap-1.5 border-red-500/20 text-red-500 hover:bg-red-500/10 hover:text-red-400"
                    onClick={() => onNavigateToTournament?.(tournament.id)}
                  >
                    <Trophy className="w-3 h-3" />
                    Input Skor
                    <ExternalLink className="w-2.5 h-2.5 ml-auto opacity-60" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* ===== Compact Match Card ===== */
function MatchCard({
  match,
  tournamentId,
  onStart,
  onGoToScoring,
}: {
  match: LiveMatch;
  tournamentId: string;
  onStart: any;
  onGoToScoring: () => void;
}) {
  const isLive = match.status === 'live';
  const isCompleted = match.status === 'completed';
  const isReady = match.status === 'ready' || match.status === 'pending';
  const sc = MATCH_STATUS_CONFIG[match.status] || MATCH_STATUS_CONFIG.pending;
  const t1Name = match.team1?.name || 'TBD';
  const t2Name = match.team2?.name || 'TBD';
  const bracketShort = BRACKET_SHORT[match.bracket] || match.bracket;
  const matchLabel = `R${match.round}M${match.matchNumber}`;

  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
        isLive ? 'bg-red-500/[0.06] border border-red-500/10' :
        isCompleted ? 'bg-muted/20 border border-border/5' :
        isReady && match.team1Id && match.team2Id ? 'bg-green-500/[0.04] border border-green-500/10' :
        'bg-muted/10'
      }`}
    >
      {/* Status icon */}
      <span className="shrink-0 text-xs">{sc.icon}</span>

      {/* Match label */}
      <Badge className="text-[9px] border-0 bg-muted/50 px-1 py-0 shrink-0">{matchLabel}</Badge>
      {bracketShort && (
        <Badge className="text-[9px] border-0 bg-muted/50 px-1 py-0 shrink-0">{bracketShort}</Badge>
      )}

      {/* Team names + score */}
      <div className="flex-1 min-w-0 flex items-center gap-1">
        <span className={`truncate ${match.winnerId === match.team1Id ? 'font-bold text-idm-gold-warm' : ''}`}>
          {t1Name}
        </span>
        {isCompleted && match.score1 !== null && match.score2 !== null ? (
          <span className="font-mono font-semibold shrink-0 text-idm-gold-warm">
            {match.score1}-{match.score2}
          </span>
        ) : isLive ? (
          <span className="text-muted-foreground shrink-0">vs</span>
        ) : (
          <span className="text-muted-foreground shrink-0">vs</span>
        )}
        <span className={`truncate ${match.winnerId === match.team2Id ? 'font-bold text-idm-gold-warm' : ''}`}>
          {t2Name}
        </span>
      </div>

      {/* Action button */}
      {isReady && match.team1Id && match.team2Id && (
        <Button
          size="sm"
          className="h-6 px-2 text-[10px] bg-green-600 hover:bg-green-700 text-white gap-0.5 shrink-0"
          disabled={onStart.isPending}
          onClick={(e) => {
            e.stopPropagation();
            onStart.mutate({ tournamentId, matchId: match.id });
          }}
        >
          {onStart.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5" />}
          Start
        </Button>
      )}
      {isLive && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[10px] text-idm-gold-warm hover:text-idm-gold-warm/80 hover:bg-idm-gold-warm/10 gap-0.5 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onGoToScoring();
          }}
        >
          Score →
        </Button>
      )}
    </div>
  );
}
