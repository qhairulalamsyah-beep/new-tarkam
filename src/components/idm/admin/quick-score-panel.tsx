'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Play, Check, Loader2, Search, Filter, Zap,
  ChevronDown, ChevronUp, ArrowRight, Clock, AlertTriangle,
  ListChecks, LayoutGrid, Keyboard, PartyPopper
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

/* ===== Types ===== */
interface QuickMatchTeam {
  id: string;
  name: string;
  teamPlayers?: { player: { gamertag: string } }[];
}

interface QuickMatch {
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
  mvpPlayerId: string | null;
  groupLabel?: string | null;
  team1: QuickMatchTeam | null;
  team2: QuickMatchTeam | null;
  winner?: { id: string; name: string } | null;
  mvpPlayer?: { id: string; gamertag: string } | null;
  completedAt?: string | null;
}

interface ScoreInputValue {
  s1: string;
  s2: string;
}

type MatchFilter = 'all' | 'ready' | 'live' | 'completed';

type RoundFilter = number | 'all'; // 'all' or specific round number
type BracketFilter = string | 'all'; // 'all' or specific bracket key

interface QuickScorePanelProps {
  matches: QuickMatch[];
  tournamentId: string;
  tournamentStatus: string;
  tournamentFormat?: string; // 'swiss' | 'single_elimination' | 'group_stage' | 'upper_semi'
  getTeamName: (id: string | null) => string;
  scoreInputs: Record<string, ScoreInputValue>;
  setScoreInputs: React.Dispatch<React.SetStateAction<Record<string, ScoreInputValue>>>;
  scoreMutation: any;
  startMatchMutation: any;
  undoScoreMutation: any;
  setConfirmDialog: (d: { open: boolean; title: string; description: string; onConfirm: () => void }) => void;
}

/* ===== Status Badge Colors ===== */
const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  pending:  { bg: 'bg-muted/50',  text: 'text-muted-foreground', label: 'Menunggu', icon: '⏳' },
  ready:    { bg: 'bg-green-500/10', text: 'text-green-500', label: 'Siap', icon: '🟢' },
  live:     { bg: 'bg-red-500/10',   text: 'text-red-500',   label: 'LIVE',   icon: '🔴' },
  main_event: { bg: 'bg-red-500/10', text: 'text-red-500',   label: 'LIVE',   icon: '🔴' },
  completed: { bg: 'bg-green-500/10', text: 'text-green-500', label: 'Selesai', icon: '✅' },
};

/* ===== Bracket Labels ===== */
const BRACKET_LABELS: Record<string, string> = {
  upper: 'Upper',
  lower: 'Lower',
  grand_final: 'Grand Final',
  group: 'Group',
  swiss: 'Swiss+DE',
  swiss_se: 'Swiss+SE',
};

/* ===== Score History Entry ===== */
interface ScoreHistoryEntry {
  id: string;
  matchId: string;
  team1Name: string;
  team2Name: string;
  score1: number;
  score2: number;
  timestamp: number;
  action: 'submit' | 'undo';
}

export function QuickScorePanel({
  matches,
  tournamentId,
  tournamentStatus,
  tournamentFormat,
  getTeamName,
  scoreInputs,
  setScoreInputs,
  scoreMutation,
  startMatchMutation,
  undoScoreMutation,
  setConfirmDialog,
}: QuickScorePanelProps) {
  // State
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('all');
  const [roundFilter, setRoundFilter] = useState<RoundFilter>('all');
  const [bracketFilter, setBracketFilter] = useState<BracketFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showKeyboardHints, setShowKeyboardHints] = useState(false);
  const [scoreHistory, setScoreHistory] = useState<ScoreHistoryEntry[]>([]);
  const [focusedMatchId, setFocusedMatchId] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'s1' | 's2' | null>(null);

  // Refs for keyboard navigation
  const inputRefs = useRef<Record<string, { s1: HTMLInputElement | null; s2: HTMLInputElement | null }>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // Filtered and sorted matches
  const playableMatches = useMemo(() => {
    return matches.filter(m => m.team1Id && m.team2Id);
  }, [matches]);

  // Available rounds & brackets for filter pills
  const availableRounds = useMemo(() => {
    const rounds = [...new Set(playableMatches.map(m => m.round))].sort((a, b) => a - b);
    return rounds;
  }, [playableMatches]);

  const availableBrackets = useMemo(() => {
    const brackets = [...new Set(playableMatches.map(m => m.bracket))];
    return brackets;
  }, [playableMatches]);

  const filteredMatches = useMemo(() => {
    let result = playableMatches;

    // Filter by status
    if (matchFilter !== 'all') {
      result = result.filter(m => {
        if (matchFilter === 'ready') return m.status === 'ready' || m.status === 'pending';
        if (matchFilter === 'live') return m.status === 'live' || m.status === 'main_event';
        if (matchFilter === 'completed') return m.status === 'completed';
        return true;
      });
    }

    // Filter by round
    if (roundFilter !== 'all') {
      result = result.filter(m => m.round === roundFilter);
    }

    // Filter by bracket
    if (bracketFilter !== 'all') {
      result = result.filter(m => m.bracket === bracketFilter);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m => {
        const t1 = m.team1?.name?.toLowerCase() || '';
        const t2 = m.team2?.name?.toLowerCase() || '';
        const t1p = m.team1?.teamPlayers?.map(tp => tp.player.gamertag.toLowerCase()).join(' ') || '';
        const t2p = m.team2?.teamPlayers?.map(tp => tp.player.gamertag.toLowerCase()).join(' ') || '';
        return t1.includes(q) || t2.includes(q) || t1p.includes(q) || t2p.includes(q);
      });
    }

    // Sort: live first, then ready, then pending, then completed
    const statusOrder: Record<string, number> = { live: 0, main_event: 0, ready: 1, pending: 2, completed: 3 };
    result.sort((a, b) => {
      const ao = statusOrder[a.status] ?? 9;
      const bo = statusOrder[b.status] ?? 9;
      if (ao !== bo) return ao - bo;
      return a.round - b.round || a.matchNumber - b.matchNumber;
    });

    return result;
  }, [playableMatches, matchFilter, roundFilter, bracketFilter, searchQuery]);

  // Stats — respects round/bracket filter for contextual counts
  const stats = useMemo(() => {
    // Base stats from ALL playable matches (for progress bar)
    const allLive = playableMatches.filter(m => m.status === 'live' || m.status === 'main_event').length;
    const allReady = playableMatches.filter(m => m.status === 'ready' || m.status === 'pending').length;
    const allCompleted = playableMatches.filter(m => m.status === 'completed').length;
    const allTotal = playableMatches.length;
    const progressPct = allTotal > 0 ? Math.round((allCompleted / allTotal) * 100) : 0;

    // Filtered stats (for display when filters active)
    const filteredLive = filteredMatches.filter(m => m.status === 'live' || m.status === 'main_event').length;
    const filteredReady = filteredMatches.filter(m => m.status === 'ready' || m.status === 'pending').length;
    const filteredCompleted = filteredMatches.filter(m => m.status === 'completed').length;
    const filteredTotal = filteredMatches.length;

    const isFiltered = roundFilter !== 'all' || bracketFilter !== 'all';

    return {
      live: isFiltered ? filteredLive : allLive,
      ready: isFiltered ? filteredReady : allReady,
      completed: isFiltered ? filteredCompleted : allCompleted,
      total: isFiltered ? filteredTotal : allTotal,
      progressPct,
      isFiltered,
      allLive, allReady, allCompleted, allTotal,
    };
  }, [playableMatches, filteredMatches, roundFilter, bracketFilter]);

  // Auto-focus first empty score input
  useEffect(() => {
    if (matchFilter === 'live' || matchFilter === 'all') {
      const firstLive = filteredMatches.find(m =>
        (m.status === 'live' || m.status === 'main_event') &&
        (!scoreInputs[m.id]?.s1 && !scoreInputs[m.id]?.s2)
      );
      if (firstLive && inputRefs.current[firstLive.id]?.s1) {
        // Don't auto-focus to avoid annoying behavior on mobile
        // inputRefs.current[firstLive.id].s1?.focus();
      }
    }
  }, [matchFilter, filteredMatches]);

  // Handle score submission — declared BEFORE keyboard effect that references it
  const handleSubmitScore = useCallback((matchId: string) => {
    const si = scoreInputs[matchId];
    if (!si?.s1 || !si?.s2) return;

    const s1 = parseInt(si.s1);
    const s2 = parseInt(si.s2);
    const match = playableMatches.find(m => m.id === matchId);
    if (!match) return;

    if (isNaN(s1) || isNaN(s2)) {
      toast.error('Skor harus berupa angka!');
      return;
    }
    if (s1 < 0 || s2 < 0) {
      toast.error('Skor tidak boleh negatif!');
      return;
    }
    const isGroupBracket = match.bracket === 'group' || match.bracket === 'swiss';
    if (s1 === s2 && !isGroupBracket) {
      toast.error('Skor tidak boleh seri di bracket eliminasi!');
      return;
    }

    const t1Name = getTeamName(match.team1Id);
    const t2Name = getTeamName(match.team2Id);

    setConfirmDialog({
      open: true,
      title: 'Konfirmasi Skor?',
      description: `${t1Name} ${s1} - ${s2} ${t2Name}${s1 === s2 ? ' (Seri)' : ''}`,
      onConfirm: () => {
        scoreMutation.mutate(
          { tournamentId, matchId, score1: s1, score2: s2 },
          {
            onSuccess: () => {
              setScoreHistory(prev => [{
                id: `${Date.now()}-${matchId}`,
                matchId,
                team1Name: t1Name,
                team2Name: t2Name,
                score1: s1,
                score2: s2,
                timestamp: Date.now(),
                action: 'submit',
              }, ...prev.slice(0, 19)]);
              // Clear inputs after submit
              setScoreInputs(prev => {
                const next = { ...prev };
                delete next[matchId];
                return next;
              });
            },
          }
        );
      },
    });
  }, [scoreInputs, playableMatches, tournamentId, getTeamName, scoreMutation, setConfirmDialog, setScoreInputs]);

  // Handle undo score — also declared before keyboard effect
  const handleUndoScore = useCallback((match: QuickMatch) => {
    setConfirmDialog({
      open: true,
      title: 'Undo Skor?',
      description: `Batalkan skor ${getTeamName(match.team1Id)} ${match.score1} - ${match.score2} ${getTeamName(match.team2Id)}? Stats pemain akan dikembalikan.`,
      onConfirm: () => {
        undoScoreMutation.mutate(
          { tournamentId, matchId: match.id },
          {
            onSuccess: () => {
              setScoreHistory(prev => [{
                id: `${Date.now()}-${match.id}`,
                matchId: match.id,
                team1Name: getTeamName(match.team1Id),
                team2Name: getTeamName(match.team2Id),
                score1: match.score1 ?? 0,
                score2: match.score2 ?? 0,
                timestamp: Date.now(),
                action: 'undo',
              }, ...prev.slice(0, 19)]);
            },
          }
        );
      },
    });
  }, [tournamentId, getTeamName, undoScoreMutation, setConfirmDialog]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if no dialog is open and we're in the quick score panel
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowKeyboardHints(prev => !prev);
      }

      // Tab between score inputs
      if (e.key === 'Enter' && focusedMatchId && focusedField) {
        e.preventDefault();
        const currentMatch = filteredMatches.find(m => m.id === focusedMatchId);
        if (!currentMatch) return;

        if (focusedField === 's1') {
          // Move to s2
          inputRefs.current[focusedMatchId]?.s2?.focus();
        } else if (focusedField === 's2') {
          // Submit the score if both fields are filled
          const si = scoreInputs[focusedMatchId];
          if (si?.s1 && si?.s2) {
            handleSubmitScore(focusedMatchId);
          }
        }
      }

      // Navigate between matches with arrow keys
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.altKey) {
        e.preventDefault();
        const currentIdx = filteredMatches.findIndex(m => m.id === focusedMatchId);
        const nextIdx = e.key === 'ArrowDown'
          ? Math.min(currentIdx + 1, filteredMatches.length - 1)
          : Math.max(currentIdx - 1, 0);
        const nextMatch = filteredMatches[nextIdx];
        if (nextMatch) {
          setFocusedMatchId(nextMatch.id);
          setFocusedField('s1');
          inputRefs.current[nextMatch.id]?.s1?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedMatchId, focusedField, filteredMatches, scoreInputs, handleSubmitScore]);

  // Bulk start all ready matches
  const handleStartAllReady = useCallback(() => {
    const readyMatches = playableMatches.filter(m =>
      (m.status === 'ready' || m.status === 'pending') && m.team1Id && m.team2Id
    );
    if (readyMatches.length === 0) {
      toast.info('Tidak ada match yang siap dimulai');
      return;
    }
    setConfirmDialog({
      open: true,
      title: `Start ${readyMatches.length} Match?`,
      description: `Semua match yang siap akan dimulai sekaligus.`,
      onConfirm: () => {
        readyMatches.forEach((m, i) => {
          setTimeout(() => {
            startMatchMutation.mutate({ tournamentId, matchId: m.id });
          }, i * 200); // Stagger to avoid rate limiting
        });
      },
    });
  }, [playableMatches, tournamentId, startMatchMutation, setConfirmDialog]);

  // Format time ago
  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Baru saja';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} menit lalu`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} jam lalu`;
    return `${Math.floor(diff / 86400000)} hari lalu`;
  };

  const isMutating = scoreMutation.isPending || startMatchMutation.isPending || undoScoreMutation.isPending;

  // All matches completed celebration
  const allCompleted = stats.allTotal > 0 && stats.allCompleted === stats.allTotal && stats.allLive === 0 && stats.allReady === 0;

  return (
    <div className="space-y-3" ref={containerRef}>
      {/* ── All Matches Completed Celebration ── */}
      {allCompleted && (
        <div className="relative overflow-hidden rounded-lg border border-idm-gold-warm/30 bg-gradient-to-r from-idm-gold-warm/10 via-idm-gold-warm/5 to-idm-gold-warm/10 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-idm-gold-warm/20 shrink-0">
              <PartyPopper className="w-5 h-5 text-idm-gold-warm" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-idm-gold-warm">Semua Match Selesai! 🎉</p>
              <p className="text-xs text-muted-foreground">{stats.allCompleted} pertandingan telah diselesaikan. Lanjutkan ke finalisasi.</p>
            </div>
          </div>
          {/* Decorative shimmer */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>
      )}
      {/* ── Stats Bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Progress */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-idm-gold-warm transition-all duration-500"
              style={{ width: `${stats.progressPct}%` }}
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            {stats.completed}/{stats.total} ({stats.progressPct}%)
          </span>
        </div>

        {/* Status counts */}
        <div className="flex items-center gap-1.5">
          {stats.live > 0 && (
            <Badge className="text-xs border-0 bg-red-500/10 text-red-500 gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {stats.live} Live
            </Badge>
          )}
          {stats.ready > 0 && (
            <Badge className="text-xs border-0 bg-green-500/10 text-green-500">
              {stats.ready} Siap
            </Badge>
          )}
          {stats.completed > 0 && (
            <Badge className="text-xs border-0 bg-emerald-500/10 text-emerald-400">
              {stats.completed} Selesai
            </Badge>
          )}
        </div>
      </div>

      {/* ── Filter + Search + Actions ── */}
      <div className="space-y-2">
        {/* Row 1: Status filter + Search + Actions */}
        <div className="flex items-center gap-2">
          {/* Status filter pills */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/30 flex-shrink-0">
            {([
              { key: 'all' as const, label: 'Semua', count: stats.total },
              { key: 'live' as const, label: '🔴 Live', count: stats.live },
              { key: 'ready' as const, label: '🟢 Siap', count: stats.ready },
              { key: 'completed' as const, label: '✅ Done', count: stats.completed },
            ]).map(f => (
              <button
                key={f.key}
                onClick={() => setMatchFilter(f.key)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                  matchFilter === f.key
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label} {f.count > 0 && <span className="opacity-60">({f.count})</span>}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Cari tim/player..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 text-xs pl-8 bg-muted/30 border-border/50 focus:border-idm-gold-warm/30"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {stats.ready > 0 && tournamentStatus === 'main_event' && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1 border-green-500/30 text-green-500 hover:bg-green-500/10"
                disabled={startMatchMutation.isPending}
                onClick={handleStartAllReady}
              >
                <Zap className="w-3 h-3" />
                <span className="hidden sm:inline">Start</span> All ({stats.ready})
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground"
              onClick={() => setShowKeyboardHints(!showKeyboardHints)}
              title="Keyboard shortcuts"
            >
              <Keyboard className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Row 2: Round + Bracket filters (only when multiple options) */}
        {(availableRounds.length > 1 || availableBrackets.length > 1) && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Round filter */}
            {availableRounds.length > 1 && (
              <div className="flex items-center gap-1 p-0.5 rounded-md bg-muted/20">
                <button
                  onClick={() => setRoundFilter('all')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    roundFilter === 'all'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  R:All
                </button>
                {availableRounds.map(r => {
                  const roundMatches = playableMatches.filter(m => m.round === r);
                  const roundCompleted = roundMatches.filter(m => m.status === 'completed').length;
                  const roundTotal = roundMatches.length;
                  const isRoundActive = roundMatches.some(m => m.status === 'live' || m.status === 'main_event');
                  return (
                    <button
                      key={r}
                      onClick={() => setRoundFilter(r)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors flex items-center gap-1 ${
                        roundFilter === r
                          ? 'bg-background shadow-sm text-foreground'
                          : isRoundActive
                            ? 'text-red-500 hover:text-red-400'
                            : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {isRoundActive && <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />}
                      R{r}
                      <span className="opacity-50">{roundCompleted}/{roundTotal}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Bracket filter */}
            {availableBrackets.length > 1 && (
              <div className="flex items-center gap-1 p-0.5 rounded-md bg-muted/20">
                <button
                  onClick={() => setBracketFilter('all')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    bracketFilter === 'all'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  B:All
                </button>
                {availableBrackets.map(b => {
                  const bracketLabel = BRACKET_LABELS[b] || b;
                  const bracketMatches = playableMatches.filter(m => m.bracket === b);
                  const bracketLive = bracketMatches.some(m => m.status === 'live' || m.status === 'main_event');
                  return (
                    <button
                      key={b}
                      onClick={() => setBracketFilter(b)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors flex items-center gap-1 ${
                        bracketFilter === b
                          ? 'bg-background shadow-sm text-foreground'
                          : bracketLive
                            ? 'text-red-500 hover:text-red-400'
                            : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {bracketLive && <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />}
                      {bracketLabel}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Active filter indicator */}
            {(roundFilter !== 'all' || bracketFilter !== 'all') && (
              <button
                onClick={() => { setRoundFilter('all'); setBracketFilter('all'); }}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium text-idm-gold-warm hover:bg-idm-gold-warm/10 transition-colors"
              >
                ✕ Reset filter
              </button>
            )}
          </div>
        )}

        {/* Keyboard Hints */}
        {showKeyboardHints && (
          <div className="p-2.5 rounded-lg bg-muted/30 border border-border/30 text-xs space-y-1">
            <p className="font-semibold text-muted-foreground mb-1">⌨️ Keyboard Shortcuts</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
              <span><kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Enter</kbd> Pindah field / Submit skor</span>
              <span><kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Alt+↑↓</kbd> Navigasi match</span>
              <span><kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">/</kbd> Toggle shortcut hints</span>
              <span><kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Tab</kbd> Pindah ke field berikutnya</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Score History Feed ── */}
      {scoreHistory.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Riwayat Skor</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
            {scoreHistory.map(entry => (
              <div
                key={entry.id}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs ${
                  entry.action === 'undo' ? 'bg-orange-500/5 border border-orange-500/10' : 'bg-green-500/5 border border-green-500/10'
                }`}
              >
                <span className="text-sm">{entry.action === 'undo' ? '⏪' : '✅'}</span>
                <span className="font-medium">
                  {entry.team1Name} {entry.score1} - {entry.score2} {entry.team2Name}
                </span>
                <span className="text-muted-foreground ml-auto text-[10px]">{formatTimeAgo(entry.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Score Table ── */}
      {filteredMatches.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {searchQuery ? 'Tidak ditemukan match untuk pencarian ini' : 'Tidak ada match untuk filter ini'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredMatches.map(match => {
            const isLive = match.status === 'live' || match.status === 'main_event';
            const isCompleted = match.status === 'completed';
            const isReady = match.status === 'ready' || match.status === 'pending';
            const sc = STATUS_CONFIG[match.status] || STATUS_CONFIG.pending;
            const si = scoreInputs[match.id] || { s1: '', s2: '' };
            const t1Name = getTeamName(match.team1Id);
            const t2Name = getTeamName(match.team2Id);
            const bracketLabel = BRACKET_LABELS[match.bracket] || match.bracket;
            const matchLabel = match.groupLabel || `R${match.round}M${match.matchNumber}`;
            const isFocused = focusedMatchId === match.id;

            return (
              <div
                key={match.id}
                className={`rounded-lg border transition-all ${
                  isLive ? 'bg-red-500/[0.03] border-red-500/15' :
                  isCompleted ? 'bg-muted/20 border-border/15' :
                  isReady ? 'bg-green-500/[0.03] border-green-500/15' :
                  'bg-muted/10 border-border/10'
                } ${isFocused ? 'ring-1 ring-idm-gold-warm/40' : ''}`}
              >
                {/* Match header row */}
                <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-border/5">
                  <Badge className={`text-[10px] border-0 ${sc.bg} ${sc.text}`}>
                    {sc.icon} {sc.label}
                  </Badge>
                  <Badge className="text-[10px] border-0 bg-muted/50">{matchLabel}</Badge>
                  <Badge className="text-[10px] border-0 bg-muted/50">{match.format}</Badge>
                  {bracketLabel && (
                    <Badge className="text-[10px] border-0 bg-muted/50">{bracketLabel}</Badge>
                  )}
                  {match.winner && (
                    <span className="text-[10px] text-idm-gold-warm font-semibold ml-auto">👑 {match.winner.name}</span>
                  )}
                  {match.mvpPlayer && (
                    <span className="text-[10px] text-idm-gold-warm">⭐ {match.mvpPlayer.gamertag}</span>
                  )}
                </div>

                {/* Score row */}
                <div className="flex items-center gap-2 px-2.5 py-2">
                  {/* Team 1 */}
                  <div className={`flex-1 min-w-0 ${match.winnerId === match.team1Id ? 'font-bold text-idm-gold-warm' : ''}`}>
                    <span className="text-xs font-medium truncate block">{t1Name}</span>
                    <span className="text-[10px] text-muted-foreground truncate block">
                      {match.team1?.teamPlayers?.map(tp => tp.player.gamertag).join(', ')}
                    </span>
                  </div>

                  {/* Score inputs / display */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isLive && tournamentStatus === 'main_event' ? (
                      <>
                        <Input
                          ref={el => {
                            if (!inputRefs.current[match.id]) inputRefs.current[match.id] = { s1: null, s2: null };
                            inputRefs.current[match.id].s1 = el;
                          }}
                          type="number"
                          min={0}
                          placeholder="0"
                          value={si.s1}
                          onChange={e => setScoreInputs(prev => ({ ...prev, [match.id]: { ...prev[match.id], s1: e.target.value, s2: prev[match.id]?.s2 ?? '' } }))}
                          onFocus={() => { setFocusedMatchId(match.id); setFocusedField('s1'); }}
                          className="w-14 h-8 text-sm text-center font-mono bg-muted/30 border-border/50 focus:border-idm-gold-warm/40"
                          disabled={isMutating}
                        />
                        <span className="text-xs text-muted-foreground font-medium">-</span>
                        <Input
                          ref={el => {
                            if (!inputRefs.current[match.id]) inputRefs.current[match.id] = { s1: null, s2: null };
                            inputRefs.current[match.id].s2 = el;
                          }}
                          type="number"
                          min={0}
                          placeholder="0"
                          value={si.s2}
                          onChange={e => setScoreInputs(prev => ({ ...prev, [match.id]: { ...prev[match.id], s2: e.target.value, s1: prev[match.id]?.s1 ?? '' } }))}
                          onFocus={() => { setFocusedMatchId(match.id); setFocusedField('s2'); }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSubmitScore(match.id);
                            }
                          }}
                          className="w-14 h-8 text-sm text-center font-mono bg-muted/30 border-border/50 focus:border-idm-gold-warm/40"
                          disabled={isMutating}
                        />
                        <Button
                          size="sm"
                          className="h-8 px-2.5 text-xs bg-idm-gold-warm hover:bg-idm-gold-warm/80 text-black gap-1"
                          disabled={!si.s1 || !si.s2 || isMutating}
                          onClick={() => handleSubmitScore(match.id)}
                        >
                          {scoreMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Submit
                        </Button>
                      </>
                    ) : isCompleted ? (
                      <span className="font-mono font-bold text-sm px-2">
                        {match.score1} - {match.score2}
                      </span>
                    ) : isReady && tournamentStatus === 'main_event' ? (
                      <Button
                        size="sm"
                        className="h-8 px-2.5 text-xs bg-green-600 hover:bg-green-700 text-white gap-1"
                        disabled={startMatchMutation.isPending}
                        onClick={() => startMatchMutation.mutate({ tournamentId, matchId: match.id })}
                      >
                        {startMatchMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        Start
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">vs</span>
                    )}
                  </div>

                  {/* Team 2 */}
                  <div className={`flex-1 min-w-0 text-right ${match.winnerId === match.team2Id ? 'font-bold text-idm-gold-warm' : ''}`}>
                    <span className="text-xs font-medium truncate block">{t2Name}</span>
                    <span className="text-[10px] text-muted-foreground truncate block">
                      {match.team2?.teamPlayers?.map(tp => tp.player.gamertag).join(', ')}
                    </span>
                  </div>

                  {/* Undo button for completed matches */}
                  {isCompleted && tournamentStatus === 'main_event' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[10px] text-orange-400 hover:text-orange-300 hover:bg-orange-400/10 shrink-0"
                      disabled={undoScoreMutation.isPending}
                      onClick={() => handleUndoScore(match)}
                    >
                      {undoScoreMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : '⏪ Undo'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Empty state hint ── */}
      {playableMatches.length === 0 && (
        <div className="py-6 text-center">
          <p className="text-sm text-muted-foreground">Belum ada match dengan tim yang sudah ditentukan</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Generate bracket terlebih dahulu</p>
        </div>
      )}
    </div>
  );
}
