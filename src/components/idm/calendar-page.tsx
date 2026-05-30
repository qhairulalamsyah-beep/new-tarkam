'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronLeft, ChevronRight, Clock, Trophy, Users, Music, Shield, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { smartRefetchInterval } from '@/lib/smart-polling';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */
interface CalendarTournament {
  id: string;
  name: string;
  weekNumber: number;
  division: string;
  status: string;
  registrationStatus: 'open' | 'closed' | 'upcoming' | 'live';
  format: string;
  defaultMatchFormat: string;
  prizePool: number;
  scheduledAt: string | null;
  startAt: string | null;
  endAt: string | null;
  registrationDeadline: string | null;
  participantCount: number;
  teamCount: number;
  season: {
    id: string;
    name: string;
    number: number;
    division: string;
    status: string;
  };
}

interface CalendarData {
  currentSeason: {
    id: string;
    name: string;
    number: number;
    division: string;
    status: string;
    startDate: string;
    endDate: string | null;
  } | null;
  seasons: Array<{
    id: string;
    name: string;
    number: number;
    division: string;
    status: string;
    startDate: string;
    endDate: string | null;
  }>;
  tournaments: CalendarTournament[];
  upcoming: CalendarTournament[];
  byMonth: Record<string, CalendarTournament[]>;
}

type DivisionFilter = 'all' | 'male' | 'female';

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */
const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const DAY_NAMES_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function formatCountdown(targetDate: string): string {
  const now = new Date();
  const target = new Date(targetDate);
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) return 'Sudah dimulai';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}h ${hours}j`;
  if (hours > 0) return `${hours}j ${minutes}m`;
  return `${minutes}m`;
}

function formatPrizePool(amount: number): string {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}jt`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}rb`;
  return `${amount}`;
}

function getDivisionColor(division: string): { bg: string; text: string; border: string; dot: string } {
  if (division === 'male') {
    return {
      bg: 'bg-idm-male/10',
      text: 'text-idm-male-light',
      border: 'border-idm-male/20',
      dot: 'bg-idm-male',
    };
  }
  return {
    bg: 'bg-idm-female/10',
    text: 'text-idm-female-light',
    border: 'border-idm-female/20',
    dot: 'bg-idm-female',
  };
}

function getRegistrationBadge(status: CalendarTournament['registrationStatus']) {
  switch (status) {
    case 'open':
      return { label: 'Daftar Buka', className: 'bg-green-500/15 text-green-400 border-green-500/25' };
    case 'closed':
      return { label: 'Daftar Tutup', className: 'bg-red-500/15 text-red-400 border-red-500/25' };
    case 'upcoming':
      return { label: 'Akan Datang', className: 'bg-idm-gold-warm/15 text-idm-gold-warm border-idm-gold-warm/25' };
    case 'live':
      return { label: 'LIVE', className: 'bg-green-500/20 text-green-400 border-green-500/30 animate-pulse' };
  }
}

/* ═══════════════════════════════════════════
   Month Calendar Grid
   ═══════════════════════════════════════════ */
function MonthCalendarGrid({
  year,
  month,
  tournaments,
  selectedDay,
  onDayClick,
}: {
  year: number;
  month: number; // 0-indexed
  tournaments: CalendarTournament[];
  selectedDay: number | null;
  onDayClick: (day: number) => void;
}) {
  // Get days in month and first day of week
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sunday

  // Map tournaments to days
  const tournamentsByDay = useMemo(() => {
    const map: Record<number, CalendarTournament[]> = {};
    for (const t of tournaments) {
      const dateStr = t.startAt || t.scheduledAt;
      if (dateStr) {
        const d = new Date(dateStr);
        if (d.getFullYear() === year && d.getMonth() === month) {
          const day = d.getDate();
          if (!map[day]) map[day] = [];
          map[day].push(t);
        }
      }
    }
    return map;
  }, [tournaments, year, month]);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();

  // Build calendar cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES_ID.map(day => (
          <div key={day} className="text-center text-[10px] font-semibold text-muted-foreground/60 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="h-14 sm:h-16" />;
          }

          const dayTournaments = tournamentsByDay[day] || [];
          const isToday = isCurrentMonth && day === todayDate;
          const isSelected = selectedDay === day;
          const hasMale = dayTournaments.some(t => t.division === 'male');
          const hasFemale = dayTournaments.some(t => t.division === 'female');
          const hasTournament = dayTournaments.length > 0;

          // Get unique week numbers per division for label
          const maleWeeks = [...new Set(dayTournaments.filter(t => t.division === 'male').map(t => t.weekNumber))];
          const femaleWeeks = [...new Set(dayTournaments.filter(t => t.division === 'female').map(t => t.weekNumber))];

          return (
            <button
              key={day}
              onClick={() => hasTournament && onDayClick(day)}
              className={`h-14 sm:h-16 flex flex-col items-center justify-start pt-1.5 rounded-xl transition-all duration-200 relative ${
                hasTournament
                  ? 'cursor-pointer hover:bg-idm-gold-warm/10 active:scale-95'
                  : 'cursor-default'
              } ${
                isSelected
                  ? 'bg-idm-gold-warm/15 ring-1 ring-idm-gold-warm/30'
                  : ''
              } ${
                isToday && !isSelected
                  ? 'bg-idm-gold-warm/5'
                  : ''
              }`}
            >
              <span className={`text-[11px] font-semibold leading-none ${
                isToday
                  ? 'text-idm-gold-warm'
                  : hasTournament
                    ? 'text-foreground'
                    : 'text-muted-foreground/50'
              }`}>
                {day}
              </span>
              {/* Tournament labels with division color */}
              {hasTournament && (
                <div className="flex flex-col items-center gap-0.5 mt-0.5 w-full px-0.5 overflow-hidden">
                  {hasMale && maleWeeks.length > 0 && (
                    <div className="flex items-center gap-0.5 bg-idm-male/15 text-idm-male-light border border-idm-male/20 rounded px-1 py-px w-full justify-center">
                      <span className="text-[7px] sm:text-[8px] font-bold leading-none truncate">♂ W{maleWeeks.join(',')}</span>
                    </div>
                  )}
                  {hasFemale && femaleWeeks.length > 0 && (
                    <div className="flex items-center gap-0.5 bg-idm-female/15 text-idm-female-light border border-idm-female/20 rounded px-1 py-px w-full justify-center">
                      <span className="text-[7px] sm:text-[8px] font-bold leading-none truncate">♀ W{femaleWeeks.join(',')}</span>
                    </div>
                  )}
                </div>
              )}
              {/* Today indicator */}
              {isToday && !hasTournament && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-idm-gold-warm" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Tournament Card
   ═══════════════════════════════════════════ */
function TournamentCard({ tournament }: { tournament: CalendarTournament }) {
  const divColors = getDivisionColor(tournament.division);
  const regBadge = getRegistrationBadge(tournament.registrationStatus);
  const DivisionIcon = tournament.division === 'male' ? Music : Shield;
  const divisionLabel = tournament.division === 'male' ? '♂ Cowo' : '♀ Cewe';

  const targetDate = tournament.startAt || tournament.scheduledAt;
  const isUpcoming = targetDate && new Date(targetDate).getTime() > Date.now();
  const isLive = tournament.registrationStatus === 'live';

  return (
    <div className="rounded-[20px] border border-idm-gold-warm/10 bg-card/60 overflow-hidden transition-all duration-300 hover:border-idm-gold-warm/20">
      <div className="p-3 sm:p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-7 h-7 rounded-lg ${divColors.bg} border ${divColors.border} flex items-center justify-center shrink-0`}>
              <DivisionIcon className="w-3.5 h-3.5" style={{ color: tournament.division === 'male' ? 'var(--idm-male-light)' : 'var(--idm-female-light)' }} />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold truncate">{tournament.name}</h4>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-semibold text-idm-gold-warm/80">W{tournament.weekNumber}</span>
                <span className="text-[10px] text-muted-foreground/50">•</span>
                <span className="text-[10px] text-muted-foreground/60">S{tournament.season.number}</span>
              </div>
            </div>
          </div>

          {/* Status badge */}
          <Badge className={`${regBadge.className} text-[8px] sm:text-[9px] font-bold border shrink-0`}>
            {isLive && <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1 animate-pulse" />}
            {regBadge.label}
          </Badge>
        </div>

        {/* Info row */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70 mb-2">
          {/* Division badge */}
          <span className={`inline-flex items-center gap-0.5 ${divColors.bg} ${divColors.text} ${divColors.border} border px-1.5 py-0.5 rounded-md text-[9px] font-bold`}>
            {divisionLabel}
          </span>

          {/* Format */}
          {tournament.defaultMatchFormat && (
            <span className="text-[9px] font-semibold text-muted-foreground/60">{tournament.defaultMatchFormat}</span>
          )}

          {/* Participants */}
          <span className="flex items-center gap-0.5 text-[9px]">
            <Users className="w-3 h-3" />
            {tournament.participantCount}
          </span>

          {/* Prize */}
          {tournament.prizePool > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] text-idm-gold-warm/70">
              <Trophy className="w-3 h-3" />
              {formatPrizePool(tournament.prizePool)}
            </span>
          )}
        </div>

        {/* Countdown / Date */}
        {targetDate && (
          <div className="flex items-center gap-1.5 pt-2 border-t border-idm-gold-warm/5">
            <Clock className="w-3 h-3 text-muted-foreground/50" />
            <span className="text-[10px] text-muted-foreground/70">
              {new Date(targetDate).toLocaleDateString('id-ID', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </span>
            {isUpcoming && !isLive && (
              <span className="ml-auto text-[10px] font-bold text-idm-gold-warm/80 tabular-nums">
                {formatCountdown(targetDate)}
              </span>
            )}
            {isLive && (
              <span className="ml-auto text-[10px] font-bold text-green-400 animate-pulse">
                ● LIVE
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Selected Day Detail
   ═══════════════════════════════════════════ */
function SelectedDayDetail({
  year,
  month,
  day,
  tournaments,
  divisionFilter,
  onClose,
}: {
  year: number;
  month: number;
  day: number;
  tournaments: CalendarTournament[];
  divisionFilter: DivisionFilter;
  onClose?: () => void;
}) {
  const dayTournaments = tournaments.filter(t => {
    const dateStr = t.startAt || t.scheduledAt;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) return false;
    if (divisionFilter === 'male' && t.division !== 'male') return false;
    if (divisionFilter === 'female' && t.division !== 'female') return false;
    return true;
  });

  if (dayTournaments.length === 0) return null;

  const dateLabel = new Date(year, month, day).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="rounded-[20px] border border-idm-gold-warm/15 bg-card/60 overflow-hidden animate-in fade-in-0 slide-in-from-right-2 duration-200">
      <div className="px-4 py-2.5 border-b border-idm-gold-warm/10 bg-idm-gold-warm/[0.03] flex items-center justify-between">
        <h4 className="text-xs font-bold text-idm-gold-warm flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          {dateLabel}
        </h4>
        {onClose && (
          <button
            onClick={onClose}
            className="w-5 h-5 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 transition-all cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
        {dayTournaments.map(t => (
          <TournamentCard key={t.id} tournament={t} />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Calendar Page — Main Component
   ═══════════════════════════════════════════ */
export function CalendarPage() {
  const [divisionFilter, setDivisionFilter] = useState<DivisionFilter>('all');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Data fetching
  const { data, isLoading } = useQuery<CalendarData>({
    queryKey: ['tournaments-calendar', divisionFilter === 'all' ? '' : divisionFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (divisionFilter !== 'all') params.set('division', divisionFilter);
      const res = await fetch(`/api/tournaments/calendar?${params}`);
      if (!res.ok) throw new Error('Failed to fetch calendar data');
      return res.json();
    },
    staleTime: 300000,
    refetchInterval: smartRefetchInterval(60_000, 300_000),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    gcTime: 300000,
    placeholderData: (prev) => prev,
  });

  // Filter tournaments by division
  const filteredTournaments = useMemo(() => {
    if (!data?.tournaments) return [];
    if (divisionFilter === 'all') return data.tournaments;
    return data.tournaments.filter(t => t.division === divisionFilter);
  }, [data, divisionFilter]);

  const filteredUpcoming = useMemo(() => {
    if (!data?.upcoming) return [];
    if (divisionFilter === 'all') return data.upcoming;
    return data.upcoming.filter(t => t.division === divisionFilter);
  }, [data, divisionFilter]);

  // Navigation
  const prevMonth = useCallback(() => {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    setSelectedDay(null);
  }, []);

  const nextMonth = useCallback(() => {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    setSelectedDay(null);
  }, []);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
    setSelectedDay(null);
  }, []);

  const handleDayClick = useCallback((day: number) => {
    setSelectedDay(prev => prev === day ? null : day);
  }, []);

  // Season info
  const currentSeason = data?.currentSeason;
  const seasonLabel = currentSeason
    ? `Season ${currentSeason.number}`
    : 'Tidak ada season aktif';

  return (
    <div className="bg-background">
      {/* ═══ Page Title Banner ═══ */}
      <div className="border-b border-idm-gold-warm/10 bg-gradient-to-b from-idm-gold-warm/[0.03] to-transparent px-4 py-5 sm:py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
              📅 Kalender Turnamen
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Jadwal pertandingan dan pendaftaran</p>
          </div>
          {currentSeason && (
            <Badge className="bg-idm-gold-warm/15 text-idm-gold-warm border border-idm-gold-warm/25 text-[10px] font-bold shrink-0">
              <Calendar className="w-3 h-3 mr-1" />
              {seasonLabel}
            </Badge>
          )}
        </div>
      </div>

      {/* ═══ Division Filter Pills ═══ */}
      <div className="max-w-7xl mx-auto px-4 pt-4 pb-2">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-idm-gold-warm/5 border border-idm-gold-warm/10 w-fit">
          {([
            { key: 'all' as DivisionFilter, label: 'Semua' },
            { key: 'male' as DivisionFilter, label: '♂ Cowo' },
            { key: 'female' as DivisionFilter, label: '♀ Cewe' },
          ]).map(div => (
            <button
              key={div.key}
              onClick={() => setDivisionFilter(div.key)}
              className={`compact-pill px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                divisionFilter === div.key
                  ? 'bg-idm-gold-warm/15 text-idm-gold-warm shadow-sm shadow-idm-gold-warm/10 border border-idm-gold-warm/25'
                  : 'text-muted-foreground/70 hover:text-foreground border border-transparent hover:bg-muted/40'
              }`}
            >
              {div.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ═══ Calendar Grid — Left Column ═══ */}
          <div className="lg:col-span-2 space-y-4">
            {/* Month Navigation */}
            <div className="rounded-[20px] border border-idm-gold-warm/10 bg-card/60 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-idm-gold-warm/10">
                <button
                  onClick={prevMonth}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-idm-gold-warm hover:bg-idm-gold-warm/10 transition-all cursor-pointer active:scale-95"
                  aria-label="Bulan sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">
                    {MONTH_NAMES_ID[month]} {year}
                  </h3>
                  {!((year === new Date().getFullYear()) && (month === new Date().getMonth())) && (
                    <button
                      onClick={goToToday}
                      className="text-[9px] font-bold text-idm-gold-warm/80 hover:text-idm-gold-warm px-1.5 py-0.5 rounded bg-idm-gold-warm/5 hover:bg-idm-gold-warm/10 transition-all cursor-pointer"
                    >
                      Hari ini
                    </button>
                  )}
                </div>
                <button
                  onClick={nextMonth}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-idm-gold-warm hover:bg-idm-gold-warm/10 transition-all cursor-pointer active:scale-95"
                  aria-label="Bulan berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Calendar */}
              <div className="p-3 sm:p-4">
                {isLoading ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="grid grid-cols-7 gap-0.5">
                      {Array.from({ length: 35 }).map((_, i) => (
                        <div key={i} className="h-14 sm:h-16 rounded-xl bg-muted/20" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <MonthCalendarGrid
                    year={year}
                    month={month}
                    tournaments={filteredTournaments}
                    selectedDay={selectedDay}
                    onDayClick={handleDayClick}
                  />
                )}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 px-4 pb-3 pt-1 border-t border-idm-gold-warm/5">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-idm-male/80" />
                  <span className="text-[9px] text-muted-foreground/60">♂ Cowo</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-idm-female/80" />
                  <span className="text-[9px] text-muted-foreground/60">♀ Cewe</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-idm-gold-warm" />
                  <span className="text-[9px] text-muted-foreground/60">Hari ini</span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ Right Panel — Detail & Upcoming ═══ */}
          <div className="space-y-3">
            {/* Selected Day Detail — shown on right side */}
            {selectedDay !== null && (
              <SelectedDayDetail
                year={year}
                month={month}
                day={selectedDay}
                tournaments={data?.tournaments || []}
                divisionFilter={divisionFilter}
                onClose={() => setSelectedDay(null)}
              />
            )}

            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-idm-gold-warm" />
              <h3 className="text-sm font-bold text-foreground">Akan Datang</h3>
              {filteredUpcoming.length > 0 && (
                <Badge className="bg-idm-gold-warm/15 text-idm-gold-warm border border-idm-gold-warm/25 text-[8px] font-bold ml-auto">
                  {filteredUpcoming.length}
                </Badge>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-[20px] border border-idm-gold-warm/10 bg-card/60 p-4 animate-pulse">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-muted/30" />
                      <div className="flex-1">
                        <div className="h-3 w-24 rounded bg-muted/30 mb-1" />
                        <div className="h-2 w-12 rounded bg-muted/20" />
                      </div>
                    </div>
                    <div className="h-2 w-full rounded bg-muted/20 mb-2" />
                    <div className="h-2 w-16 rounded bg-muted/15" />
                  </div>
                ))}
              </div>
            ) : filteredUpcoming.length === 0 ? (
              <div className="rounded-[20px] border border-idm-gold-warm/10 bg-card/60 p-6 text-center">
                <Calendar className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground/60">Belum ada turnamen yang dijadwalkan</p>
                <p className="text-[10px] text-muted-foreground/40 mt-1">Cek kembali nanti untuk update jadwal</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
                {filteredUpcoming.slice(0, 10).map(tournament => (
                  <TournamentCard key={tournament.id} tournament={tournament} />
                ))}
              </div>
            )}

            {/* Season Info Card */}
            {currentSeason && (
              <div className="rounded-[20px] border border-idm-gold-warm/10 bg-card/60 overflow-hidden mt-4">
                <div className="px-4 py-2.5 border-b border-idm-gold-warm/10 bg-idm-gold-warm/[0.03]">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-idm-gold-warm flex items-center gap-1.5">
                    <Trophy className="w-3 h-3" />
                    Info Season
                  </h4>
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground/60">Season</span>
                    <span className="text-xs font-bold text-foreground">S{currentSeason.number} — {currentSeason.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground/60">Status</span>
                    <Badge className={`text-[8px] font-bold border ${
                      currentSeason.status === 'active'
                        ? 'bg-green-500/15 text-green-400 border-green-500/25'
                        : 'bg-idm-gold-warm/15 text-idm-gold-warm border-idm-gold-warm/25'
                    }`}>
                      {currentSeason.status === 'active' ? 'AKTIF' : 'UPCOMING'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground/60">Mulai</span>
                    <span className="text-[10px] text-foreground/70">
                      {new Date(currentSeason.startDate).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
