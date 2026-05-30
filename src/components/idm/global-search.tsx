'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  User,
  Shield,
  Trophy,
  X,
  Loader2,
  Command,
} from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { getAvatarUrl } from '@/lib/utils';
import { AvatarMedia } from '@/components/ui/avatar-media';

/* ═══ Types ═══ */
interface PlayerResult {
  id: string;
  gamertag: string;
  name: string;
  division: string;
  tier: string;
  points: number;
  totalWins: number;
  totalMvp: number;
  avatar?: string | null;
  club: { id: string; name: string; logo?: string | null } | null;
}

interface ClubResult {
  id: string;
  name: string;
  logo?: string | null;
  memberCount: number;
  division: string;
  wins: number;
  losses: number;
  points: number;
}

interface TournamentResult {
  id: string;
  name: string;
  weekNumber: number;
  division: string;
  status: string;
  format: string;
  prizePool: number;
  season: { id: string; name: string; number: number };
}

interface GlobalSearchResults {
  players: PlayerResult[];
  clubs: ClubResult[];
  tournaments: TournamentResult[];
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPlayer?: (player: PlayerResult) => void;
  onSelectClub?: (club: ClubResult) => void;
  onSelectTournament?: (tournament: TournamentResult) => void;
}

/* ═══ Division helpers ═══ */
function divisionLabel(d: string) {
  return d === 'male' ? '♂ Cowo' : d === 'female' ? '♀ Cewe' : d;
}

function divisionBadgeClass(d: string) {
  if (d === 'male') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  if (d === 'female') return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
  return 'bg-idm-gold-warm/10 text-idm-gold-warm border-idm-gold-warm/20';
}

function tierBadgeClass(tier: string) {
  if (tier === 'S') return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25';
  if (tier === 'A') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25';
  return 'bg-muted/30 text-muted-foreground border-muted/40';
}

function tournamentStatusLabel(s: string) {
  const map: Record<string, string> = {
    setup: 'Persiapan',
    registration: 'Pendaftaran',
    approval: 'Approval',
    team_generation: 'Buat Tim',
    bracket_generation: 'Buat Bracket',
    main_event: 'Berlangsung',
    finalization: 'Finalisasi',
    completed: 'Selesai',
  };
  return map[s] || s;
}

function tournamentStatusBadgeClass(s: string) {
  if (s === 'registration') return 'bg-green-500/10 text-green-400 border-green-500/20';
  if (s === 'main_event') return 'bg-idm-gold-warm/10 text-idm-gold-warm border-idm-gold-warm/20';
  if (s === 'completed') return 'bg-muted/30 text-muted-foreground border-muted/40';
  return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
}

/* ═══ Skeleton Loader ═══ */
function SearchSkeleton() {
  return (
    <div className="py-3 px-2 space-y-3">
      {/* Players group skeleton */}
      <div>
        <div className="h-4 w-24 bg-muted/30 rounded mb-2 mx-1 animate-pulse" />
        {[1, 2, 3].map(i => (
          <div key={`ps-${i}`} className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-muted/20 animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-28 bg-muted/20 rounded animate-pulse" />
              <div className="h-2.5 w-16 bg-muted/15 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
      {/* Clubs group skeleton */}
      <div>
        <div className="h-4 w-20 bg-muted/30 rounded mb-2 mx-1 animate-pulse" />
        {[1, 2].map(i => (
          <div key={`cs-${i}`} className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-lg bg-muted/20 animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-24 bg-muted/20 rounded animate-pulse" />
              <div className="h-2.5 w-14 bg-muted/15 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ GlobalSearch Component ═══ */
export function GlobalSearch({
  open,
  onOpenChange,
  onSelectPlayer,
  onSelectClub,
  onSelectTournament,
}: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input (300ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Reset query when dialog closes — via onOpenChange callback
  const handleClose = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setQuery('');
      setDebouncedQuery('');
    }
    onOpenChange(isOpen);
  }, [onOpenChange]);

  // Fetch search results with React Query
  const { data, isLoading } = useQuery<GlobalSearchResults>({
    queryKey: ['global-search', debouncedQuery],
    queryFn: async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30000,
    gcTime: 60000,
    placeholderData: (prev) => prev,
  });

  const hasResults = data && (
    data.players.length > 0 ||
    data.clubs.length > 0 ||
    data.tournaments.length > 0
  );

  const isSearching = isLoading && debouncedQuery.length >= 2;

  const handleSelectPlayer = useCallback((player: PlayerResult) => {
    onOpenChange(false);
    onSelectPlayer?.(player);
  }, [onOpenChange, onSelectPlayer]);

  const handleSelectClub = useCallback((club: ClubResult) => {
    onOpenChange(false);
    onSelectClub?.(club);
  }, [onOpenChange, onSelectClub]);

  const handleSelectTournament = useCallback((tournament: TournamentResult) => {
    onOpenChange(false);
    onSelectTournament?.(tournament);
  }, [onOpenChange, onSelectTournament]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleClose}
      title="Pencarian Global"
      description="Cari pemain, klub, atau turnamen"
      className="sm:max-w-lg"
      showCloseButton={false}
    >
      <div className="flex items-center border-b border-border/50 px-3">
        <Search className="w-4 h-4 shrink-0 text-muted-foreground mr-2" />
        <input
          placeholder="Cari pemain, klub, atau turnamen..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/60"
          autoFocus
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setDebouncedQuery(''); }}
            className="p-1 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
        <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border/50 bg-muted/30 px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-70">
          ESC
        </kbd>
      </div>

      <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
        {/* Not yet searched */}
        {debouncedQuery.length < 2 && !isSearching && (
          <div className="py-10 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-idm-gold-warm/5 flex items-center justify-center mx-auto mb-3">
              <Command className="w-5 h-5 text-idm-gold-warm/60" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Cari pemain, klub, atau turnamen...</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Ketik minimal 2 karakter untuk mulai
            </p>
            <div className="flex items-center justify-center gap-2 mt-3">
              <kbd className="inline-flex h-5 items-center gap-1 rounded border border-border/50 bg-muted/30 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span className="text-[9px]">⌘</span>K
              </kbd>
              <span className="text-[10px] text-muted-foreground/50">untuk membuka pencarian</span>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {isSearching && !data && <SearchSkeleton />}

        {/* No results */}
        {debouncedQuery.length >= 2 && !isSearching && !hasResults && (
          <div className="py-10 px-4 text-center">
            <Search className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm font-medium text-muted-foreground">Tidak ditemukan</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Coba kata kunci lain atau periksa ejaan
            </p>
          </div>
        )}

        {/* Results */}
        {data && hasResults && (
          <div className="py-1">
            {/* Players Group */}
            {data.players.length > 0 && (
              <div className="px-2 pt-1">
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <User className="w-3.5 h-3.5 text-idm-gold-warm/70" />
                  <span className="text-xs font-semibold text-muted-foreground">Pemain</span>
                  <Badge className="ml-auto text-[9px] bg-idm-gold-warm/10 text-idm-gold-warm border-0 px-1 py-0">
                    {data.players.length}
                  </Badge>
                </div>
                {data.players.map(player => {
                  const avatarSrc = getAvatarUrl(player.gamertag, player.division as 'male' | 'female', player.avatar);
                  return (
                    <div
                      key={player.id}
                      className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer hover:bg-idm-gold-warm/5 transition-colors group"
                      onClick={() => handleSelectPlayer(player)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSelectPlayer(player); }}
                    >
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 ring-1 ring-border/30 group-hover:ring-idm-gold-warm/30 transition-all">
                        <AvatarMedia
                          src={avatarSrc}
                          alt={player.gamertag}
                          width={36}
                          height={36}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold truncate">{player.gamertag}</span>
                          <Badge className={`text-[8px] px-1 py-0 border ${tierBadgeClass(player.tier)}`}>
                            {player.tier}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {player.club && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate">
                              <Shield className="w-2.5 h-2.5 shrink-0" />
                              {player.club.name}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground/60">
                            {player.points} pts · {player.totalWins}W
                          </span>
                        </div>
                      </div>
                      {/* Division Badge */}
                      <Badge className={`text-[8px] px-1.5 py-0 border shrink-0 ${divisionBadgeClass(player.division)}`}>
                        {divisionLabel(player.division)}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Separator */}
            {data.players.length > 0 && data.clubs.length > 0 && (
              <div className="my-1.5 mx-3 h-px bg-border/30" />
            )}

            {/* Clubs Group */}
            {data.clubs.length > 0 && (
              <div className="px-2 pt-1">
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <Shield className="w-3.5 h-3.5 text-idm-gold-warm/70" />
                  <span className="text-xs font-semibold text-muted-foreground">Klub</span>
                  <Badge className="ml-auto text-[9px] bg-idm-gold-warm/10 text-idm-gold-warm border-0 px-1 py-0">
                    {data.clubs.length}
                  </Badge>
                </div>
                {data.clubs.map(club => (
                  <div
                    key={club.id}
                    className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer hover:bg-idm-gold-warm/5 transition-colors group"
                    onClick={() => handleSelectClub(club)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSelectClub(club); }}
                  >
                    {/* Club icon */}
                    <div className="w-9 h-9 rounded-lg bg-idm-gold-warm/5 flex items-center justify-center shrink-0 ring-1 ring-border/30 group-hover:ring-idm-gold-warm/30 transition-all">
                      <Shield className="w-4 h-4 text-idm-gold-warm/60" />
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold truncate">{club.name}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          {club.memberCount} pemain
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                          · {club.wins}W/{club.losses}L · {club.points} pts
                        </span>
                      </div>
                    </div>
                    {/* Division Badge */}
                    <Badge className={`text-[8px] px-1.5 py-0 border shrink-0 ${divisionBadgeClass(club.division)}`}>
                      {divisionLabel(club.division)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Separator */}
            {(data.players.length > 0 || data.clubs.length > 0) && data.tournaments.length > 0 && (
              <div className="my-1.5 mx-3 h-px bg-border/30" />
            )}

            {/* Tournaments Group */}
            {data.tournaments.length > 0 && (
              <div className="px-2 pt-1">
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <Trophy className="w-3.5 h-3.5 text-idm-gold-warm/70" />
                  <span className="text-xs font-semibold text-muted-foreground">Turnamen</span>
                  <Badge className="ml-auto text-[9px] bg-idm-gold-warm/10 text-idm-gold-warm border-0 px-1 py-0">
                    {data.tournaments.length}
                  </Badge>
                </div>
                {data.tournaments.map(tournament => (
                  <div
                    key={tournament.id}
                    className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer hover:bg-idm-gold-warm/5 transition-colors group"
                    onClick={() => handleSelectTournament(tournament)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSelectTournament(tournament); }}
                  >
                    {/* Tournament icon */}
                    <div className="w-9 h-9 rounded-lg bg-idm-gold-warm/5 flex items-center justify-center shrink-0 ring-1 ring-border/30 group-hover:ring-idm-gold-warm/30 transition-all">
                      <Trophy className="w-4 h-4 text-idm-gold-warm/60" />
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold truncate">{tournament.name}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          Minggu {tournament.weekNumber}
                        </span>
                        {tournament.season && (
                          <span className="text-[10px] text-muted-foreground/60">
                            · S{tournament.season.number}
                          </span>
                        )}
                        {tournament.prizePool > 0 && (
                          <span className="text-[10px] text-idm-gold-warm/70">
                            · Rp{(tournament.prizePool / 1000).toFixed(0)}K
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Status + Division Badges */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge className={`text-[8px] px-1.5 py-0 border ${tournamentStatusBadgeClass(tournament.status)}`}>
                        {tournamentStatusLabel(tournament.status)}
                      </Badge>
                      <Badge className={`text-[8px] px-1.5 py-0 border ${divisionBadgeClass(tournament.division)}`}>
                        {divisionLabel(tournament.division)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer hint */}
      {debouncedQuery.length >= 2 && data && hasResults && (
        <div className="border-t border-border/30 px-3 py-2 flex items-center gap-3 text-[10px] text-muted-foreground/50">
          <span className="flex items-center gap-1">
            <kbd className="inline-flex h-4 items-center rounded border border-border/50 bg-muted/20 px-1 font-mono text-[9px]">↵</kbd>
            Buka
          </span>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex h-4 items-center rounded border border-border/50 bg-muted/20 px-1 font-mono text-[9px]">esc</kbd>
            Tutup
          </span>
        </div>
      )}
    </CommandDialog>
  );
}

/* ═══ Search Trigger Button ═══
   Can be placed in the navbar. Opens the global search on click.
   Also registers the Ctrl+K / Cmd+K keyboard shortcut.
*/
export function GlobalSearchTrigger({
  onClick,
  scrolled,
}: {
  onClick: () => void;
  scrolled?: boolean;
}) {
  // Register keyboard shortcut globally
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClick();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClick]);

  return (
    <button
      onClick={onClick}
      className={`btn-press inline-flex items-center gap-1.5 h-7 sm:h-8 px-2 sm:px-2.5 rounded-full text-[11px] sm:text-xs transition-all duration-200 cursor-pointer border active:scale-95 shrink-0 ${
        scrolled
          ? 'border-idm-gold-warm/15 bg-idm-gold-warm/5 hover:bg-idm-gold-warm/10 text-idm-gold-warm/70 hover:text-idm-gold-warm'
          : 'border-foreground/10 bg-foreground/5 hover:bg-foreground/10 text-foreground/50 hover:text-foreground/80 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white/50 dark:hover:text-white/80'
      }`}
      aria-label="Buka pencarian"
    >
      <Search className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Cari...</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 h-4 rounded border border-current/15 bg-current/5 px-1 font-mono text-[9px] opacity-60">
        <span className="text-[8px]">⌘</span>K
      </kbd>
    </button>
  );
}
