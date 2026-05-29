'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, HandCoins, Crown, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrencyShort } from '@/lib/utils';
import { SectionHeader, AnimatedSection } from './shared';
import type { StatsData, SultanOfWeekly, TopDonor } from '@/types/stats';

/* ═══════════════════════════════════════════════════════
   DONOR LEADERBOARD SECTION — Landing Page
   Premium Apple-style "Leaderboard Penyawer" with
   Sultan of the Week hero card + top 8 donors list
   + Week Selector for browsing previous weeks
   ═══════════════════════════════════════════════════════ */

interface DonorLeaderboardSectionProps {
  maleData?: StatsData;
  femaleData?: StatsData;
  isDataLoading?: boolean;
}

/* ─── Constants ─── */
const MAROON = '#800020';
const MAROON_LIGHT = '#d4576a';
const RANK_MEDALS = ['🥇', '🥈', '🥉'];

/* ─── Division color constants ─── */
const DIVISION_COLORS = {
  male: { primary: '#57B5FF', light: '#8FCEFF', rgb: '87,181,255', rgbLight: '143,206,255' },
  female: { primary: '#FF5C9A', light: '#FF8FBC', rgb: '255,92,154', rgbLight: '255,143,188' },
} as const;

type DivisionFilter = 'all' | 'male' | 'female';
/** TimeRange: 'season' for overall, or a specific week number */
type TimeRange = 'season' | number;

/* ─── Enriched donor with per-division breakdown ─── */
interface DivisionDonor extends TopDonor {
  maleAmount: number;
  femaleAmount: number;
  divisions: ('male' | 'female')[];
  player?: TopDonor['player'];
}

/* ─── Helpers ─── */

function getInitials(name: string): string {
  return name
    .split(/[\s_]+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatRupiahShort(amount: number): string {
  if (amount === 0) return 'Rp0';
  if (amount >= 1_000_000) return `Rp${(amount / 1_000_000).toFixed(1).replace('.0', '')}jt`;
  if (amount >= 100_000) return `Rp${(amount / 1000).toFixed(0)}K`;
  if (amount >= 10_000) return `Rp${(amount / 1000).toFixed(0)}K`;
  return `Rp${amount.toLocaleString('id-ID')}`;
}

/** Division badge — color-coded male/female */
function DivisionBadge({ division }: { division: 'male' | 'female' }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0 rounded text-[8px] font-bold uppercase tracking-wider border ${
        division === 'male'
          ? 'bg-idm-male/10 text-idm-male-light border-idm-male/30'
          : 'bg-idm-female/10 text-idm-female-light border-idm-female/30'
      }`}
    >
      {division === 'male' ? '♂ M' : '♀ F'}
    </span>
  );
}



/* ═══════════════════════════════════════════════════════
   SULTAN OF THE WEEK — Hero Card
   Division-colored frames: cowo (blue) / cewe (pink)
   Now supports showing Sultan for a specific week
   ═══════════════════════════════════════════════════════ */
function SultanOfWeeklyCard({
  sultans,
}: {
  sultans: SultanOfWeekly[];
}) {
  if (sultans.length === 0) return null;

  // Show up to 2 sultans (one per division if available)
  const displaySultans = sultans.slice(0, 2);
  const isMultiDivision = displaySultans.length > 1;

  // Determine primary division for outer card when single division
  const primaryDivision = displaySultans[0].tournamentDivision === 'female' ? 'female' : 'male';
  const primaryColors = DIVISION_COLORS[primaryDivision];

  return (
    <AnimatedSection variant="fadeUp" className="mb-6">
      <div
        className="relative overflow-hidden rounded-2xl backdrop-blur-sm bg-white/[0.07] dark:bg-white/[0.09] border shadow-[0_4px_30px_rgba(0,0,0,0.1)]"
        style={{
          borderColor: isMultiDivision
            ? 'rgba(255,255,255,0.08)'
            : `rgba(${primaryColors.rgb},0.25)`,
          background: isMultiDivision
            ? 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.03) 100%)'
            : `linear-gradient(135deg, rgba(${primaryColors.rgb},0.12) 0%, rgba(${primaryColors.rgbLight},0.08) 50%, rgba(${primaryColors.rgb},0.06) 100%)`,
        }}
      >
        {/* Top accent line — blended division colors for multi, single division color for single */}
        <div
          className="h-1"
          style={{
            background: isMultiDivision
              ? `linear-gradient(90deg, transparent, rgba(${DIVISION_COLORS.male.rgb},0.7), rgba(${DIVISION_COLORS.female.rgb},0.7), transparent)`
              : `linear-gradient(90deg, transparent, ${primaryColors.primary}, ${primaryColors.light}, ${primaryColors.primary}, transparent)`,
          }}
        />

        <div className="relative z-10 p-4 sm:p-6">
          {/* Badge row */}
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{
                backgroundColor: isMultiDivision
                  ? 'rgba(128,0,32,0.15)'
                  : `rgba(${primaryColors.rgb},0.15)`,
                border: isMultiDivision
                  ? '1.5px solid rgba(128,0,32,0.3)'
                  : `1.5px solid rgba(${primaryColors.rgb},0.3)`,
              }}
            >
              <Crown
                className="w-3.5 h-3.5"
                style={{ color: isMultiDivision ? MAROON_LIGHT : primaryColors.light }}
              />
            </div>
            <span
              className="text-xs sm:text-sm font-black uppercase tracking-wider"
              style={{ color: isMultiDivision ? MAROON_LIGHT : primaryColors.light }}
            >
              ❤️ Sultan of the Week
            </span>
            <span
              className="text-[10px] font-bold ml-auto shrink-0"
              style={{ color: isMultiDivision ? MAROON_LIGHT : primaryColors.light }}
            >
              Week {displaySultans[0].weekNumber}
            </span>
          </div>

          {/* Sultan(s) display — grid for multi-division, single row for one */}
          <div className={`grid ${isMultiDivision ? 'grid-cols-1 sm:grid-cols-2 gap-4' : 'grid-cols-1'}`}>
            {displaySultans.map((sultan, idx) => {
              const division = sultan.tournamentDivision === 'female' ? 'female' : 'male';
              const divColors = DIVISION_COLORS[division];
              const isCoSultan = sultan.isCoSultan && sultan.coSultans && sultan.coSultans.length > 0;
              const allSultansForDiv = isCoSultan
                ? [
                    { donorName: sultan.donorName, totalAmount: sultan.totalAmount, donationCount: sultan.donationCount, player: sultan.player },
                    ...(sultan.coSultans ?? [])
                      .filter(cs => cs.donorName !== sultan.donorName)
                      .map((cs) => ({
                        donorName: cs.donorName,
                        totalAmount: cs.totalAmount,
                        donationCount: cs.donationCount,
                        player: cs.player,
                      })),
                  ]
                : [{ donorName: sultan.donorName, totalAmount: sultan.totalAmount, donationCount: sultan.donationCount, player: sultan.player }];

              const divisionLabel = division === 'female' ? '💃 Cewe' : '🕺 Cowo';

              return (
                <div
                  key={`${sultan.tournamentDivision}-${idx}`}
                  className="relative overflow-hidden rounded-xl"
                  style={{
                    border: `1.5px solid rgba(${divColors.rgb},0.25)`,
                    background: `linear-gradient(135deg, rgba(${divColors.rgb},0.1) 0%, rgba(${divColors.rgbLight},0.06) 50%, rgba(${divColors.rgb},0.04) 100%)`,
                  }}
                >
                  {/* Division-colored top accent bar */}
                  <div
                    className="h-0.5"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${divColors.primary}, ${divColors.light}, ${divColors.primary}, transparent)`,
                    }}
                  />

                  <div className="p-3">
                    {/* Division badge */}
                    <div className="mb-2">
                      <span
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                        style={{
                          color: divColors.light,
                          backgroundColor: `rgba(${divColors.rgb},0.12)`,
                          borderColor: `rgba(${divColors.rgb},0.3)`,
                        }}
                      >
                        {divisionLabel}
                      </span>
                      {isCoSultan && (
                        <span className="text-[9px] font-bold ml-1.5 px-2 py-0.5 rounded-full border border-idm-gold-warm/20 bg-idm-gold-warm/5 text-idm-gold-warm">
                          ❤️‍🔥 Co-Sultan
                        </span>
                      )}
                    </div>

                    {/* Sultan entries */}
                    <div className="space-y-2">
                      {allSultansForDiv.map((s, sIdx) => {
                        const avatarInitials = getInitials(s.donorName);
                        const hasPlayerAvatar = s.player?.avatar;

                        return (
                          <div key={`${s.donorName}-${sIdx}`} className="flex items-center gap-3">
                            {/* Avatar */}
                            <div
                              className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden shrink-0"
                              style={{
                                border: `2px solid rgba(${divColors.rgb},0.35)`,
                                boxShadow: `0 0 12px rgba(${divColors.rgb},0.15)`,
                              }}
                            >
                              {hasPlayerAvatar ? (
                                <img
                                  src={s.player!.avatar!}
                                  alt={s.donorName}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div
                                  className="w-full h-full flex items-center justify-center"
                                  style={{ background: `linear-gradient(135deg, ${divColors.primary}, ${divColors.light})` }}
                                >
                                  <span className="text-[11px] font-bold text-white/90">{avatarInitials}</span>
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-sm sm:text-base font-black truncate"
                                style={{ color: divColors.light }}
                              >
                                {s.donorName}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs sm:text-sm font-bold" style={{ color: divColors.primary }}>
                                  {formatCurrencyShort(s.totalAmount)}
                                </span>
                                <span className="text-[9px] text-muted-foreground/90">
                                  {s.donationCount}x sawer
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Week info */}
          <div className="mt-3 pt-3" style={{ borderTop: isMultiDivision ? '1px solid rgba(255,255,255,0.06)' : `1px solid rgba(${primaryColors.rgb},0.12)` }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/60">
                {displaySultans.map(s => s.tournamentName).join(' • ')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}

/* ═══════════════════════════════════════════════════════
   WEEK SELECTOR — Scalable week navigation
   
   Strategy:
   • ≤ 2 weeks  → All pills visible, arrows disabled
   • ≥ 3 weeks  → Scrollable pills with ◀ ▶ arrows
                   (shows max 2 at a time, sliding window)
   
   Arrows always visible (disabled when can't scroll).
   Step per click = 1 week. Auto-centers on selected week.
   
   Handles any season length: 2 weeks, 9 weeks, even 20+.
   ═══════════════════════════════════════════════════════ */
function WeekSelector({
  availableWeeks,
  selectedWeek,
  onSelectWeek,
  latestWeek,
}: {
  availableWeeks: number[];
  selectedWeek: number;
  latestWeek: number;
  onSelectWeek: (week: number) => void;
}) {
  const totalWeeks = availableWeeks.length;
  const MAX_VISIBLE = 2;
  const needScroll = totalWeeks > MAX_VISIBLE;

  // ── Sliding window state (only used when needScroll) ──
  const [windowStart, setWindowStart] = useState(0);

  // Clamp windowStart to valid range (guards against stale state after data changes)
  const clampedStart = needScroll
    ? Math.max(0, Math.min(windowStart, totalWeeks - MAX_VISIBLE))
    : 0;

  // If selected week is outside the current window, auto-center it
  const selectedIdx = availableWeeks.indexOf(selectedWeek);
  const effectiveStart = useMemo(() => {
    if (!needScroll) return 0;
    if (selectedIdx < 0) return clampedStart;
    if (selectedIdx < clampedStart || selectedIdx >= clampedStart + MAX_VISIBLE) {
      // Selected week is off-screen → center the window on it
      return Math.max(0, Math.min(selectedIdx - Math.floor(MAX_VISIBLE / 2), totalWeeks - MAX_VISIBLE));
    }
    return clampedStart;
  }, [needScroll, selectedIdx, clampedStart, totalWeeks]);

  // Sync state when auto-centering kicks in
  if (effectiveStart !== clampedStart && effectiveStart !== windowStart) {
    setWindowStart(effectiveStart);
  }

  const visibleWeeks = needScroll
    ? availableWeeks.slice(effectiveStart, effectiveStart + MAX_VISIBLE)
    : availableWeeks;

  const canScrollLeft = effectiveStart > 0;
  const canScrollRight = effectiveStart + MAX_VISIBLE < totalWeeks;

  return (
    <div className="flex items-center gap-1">
      {/* Left arrow — always visible, disabled when can't scroll */}
      <button
        onClick={() => needScroll && setWindowStart(s => Math.max(0, s - 1))}
        disabled={!canScrollLeft}
        className={`compact-pill w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center rounded-full transition-all shrink-0 ${
          canScrollLeft
            ? 'hover:bg-idm-gold-warm/10 text-idm-gold-warm/60 cursor-pointer'
            : 'text-muted-foreground/20 cursor-not-allowed'
        }`}
        aria-label="Previous weeks"
      >
        <ChevronLeft className="w-3 h-3" />
      </button>

      {/* Leading ellipsis — indicates more weeks before visible range */}
      {needScroll && effectiveStart > 0 && (
        <span className="text-[8px] text-muted-foreground/40 px-0.5 shrink-0">…</span>
      )}

      {/* Week pills */}
      <div className="flex items-center gap-0.5 sm:gap-1">
        {visibleWeeks.map((week) => (
          <button
            key={week}
            onClick={() => onSelectWeek(week)}
            className={`compact-pill px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              selectedWeek === week
                ? week === latestWeek
                  ? 'bg-idm-gold-warm/15 text-idm-gold-warm shadow-[0_0_8px_color-mix(in_srgb,var(--color-idm-gold-warm)_15%,transparent)]'
                  : 'bg-idm-gold-warm/10 text-idm-gold-warm/80'
                : 'text-muted-foreground/50 hover:text-idm-gold-warm/60 hover:bg-idm-gold-warm/5'
            }`}
            aria-pressed={selectedWeek === week}
          >
            W{week}
            {week === latestWeek && (
              <span className="ml-0.5 text-[7px] text-idm-gold-warm/50">●</span>
            )}
          </button>
        ))}
      </div>

      {/* Trailing ellipsis — indicates more weeks after visible range */}
      {needScroll && effectiveStart + MAX_VISIBLE < totalWeeks && (
        <span className="text-[8px] text-muted-foreground/40 px-0.5 shrink-0">…</span>
      )}

      {/* Right arrow — always visible, disabled when can't scroll */}
      <button
        onClick={() => needScroll && setWindowStart(s => Math.min(totalWeeks - MAX_VISIBLE, s + 1))}
        disabled={!canScrollRight}
        className={`compact-pill w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center rounded-full transition-all shrink-0 ${
          canScrollRight
            ? 'hover:bg-idm-gold-warm/10 text-idm-gold-warm/60 cursor-pointer'
            : 'text-muted-foreground/20 cursor-not-allowed'
        }`}
        aria-label="Next weeks"
      >
        <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */
export function DonorLeaderboardSection({
  maleData,
  femaleData,
  isDataLoading,
}: DonorLeaderboardSectionProps) {
  const [divisionFilter, setDivisionFilter] = useState<DivisionFilter>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('season');
  // Reset filters tracking
  const filterKey = `${divisionFilter}-${timeRange}`;
  const prevFilterKey = useState(filterKey);

  // ── Pre-compute all data ──
  const { seasonDonors, weekDonorsMap, availableWeeks, weekSultansMap, latestWeekNumber } = useMemo(() => {
    // ── All Sultan of the Week entries ──
    const allSultans: SultanOfWeekly[] = [
      ...(maleData?.sultanOfWeekly || []),
      ...(femaleData?.sultanOfWeekly || []),
    ];

    // ── Available weeks (sorted ascending) ──
    const weekSet = new Set(allSultans.map(s => s.weekNumber));
    // Also add weeks from active tournament
    const maleWeek = maleData?.activeTournament?.weekNumber;
    const femaleWeek = femaleData?.activeTournament?.weekNumber;
    if (maleWeek) weekSet.add(maleWeek);
    if (femaleWeek) weekSet.add(femaleWeek);
    const availableWeeks = Array.from(weekSet).sort((a, b) => a - b);

    // ── Latest week number ──
    const latestWeekNumber = availableWeeks.length > 0 ? availableWeeks[availableWeeks.length - 1] : 0;

    // Helper: merge donors into donorMap
    const buildDonorMap = () => new Map<string, { donorName: string; totalAmount: number; donationCount: number; maleAmount: number; femaleAmount: number; player?: TopDonor['player'] }>();
    const mergeDonors = (donorMap: ReturnType<typeof buildDonorMap>, donors: TopDonor[], division: 'male' | 'female') => {
      for (const d of donors) {
        const key = d.donorName.toLowerCase().trim();
        const existing = donorMap.get(key);
        if (existing) {
          donorMap.set(key, {
            donorName: d.donorName,
            totalAmount: existing.totalAmount + d.totalAmount,
            donationCount: existing.donationCount + d.donationCount,
            maleAmount: existing.maleAmount + (division === 'male' ? d.totalAmount : 0),
            femaleAmount: existing.femaleAmount + (division === 'female' ? d.totalAmount : 0),
            player: existing.player || d.player,
          });
        } else {
          donorMap.set(key, {
            donorName: d.donorName,
            totalAmount: d.totalAmount,
            donationCount: d.donationCount,
            maleAmount: division === 'male' ? d.totalAmount : 0,
            femaleAmount: division === 'female' ? d.totalAmount : 0,
            player: d.player,
          });
        }
      }
    };
    const mergeDonorList = (donorMap: ReturnType<typeof buildDonorMap>, donorList: SultanOfWeekly['allDonors'], division: 'male' | 'female') => {
      if (!donorList?.length) return;
      for (const d of donorList) {
        const key = d.donorName.toLowerCase().trim();
        const existing = donorMap.get(key);
        if (existing) {
          donorMap.set(key, {
            donorName: d.donorName,
            totalAmount: existing.totalAmount + d.totalAmount,
            donationCount: existing.donationCount + d.donationCount,
            maleAmount: existing.maleAmount + (division === 'male' ? d.totalAmount : 0),
            femaleAmount: existing.femaleAmount + (division === 'female' ? d.totalAmount : 0),
            player: existing.player || d.player,
          });
        } else {
          donorMap.set(key, {
            donorName: d.donorName,
            totalAmount: d.totalAmount,
            donationCount: d.donationCount,
            maleAmount: division === 'male' ? d.totalAmount : 0,
            femaleAmount: division === 'female' ? d.totalAmount : 0,
            player: d.player,
          });
        }
      }
    };
    const toDivisionDonors = (donorMap: ReturnType<typeof buildDonorMap>): DivisionDonor[] =>
      Array.from(donorMap.values())
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .map((d) => ({
          donorName: d.donorName,
          totalAmount: d.totalAmount,
          donationCount: d.donationCount,
          maleAmount: d.maleAmount,
          femaleAmount: d.femaleAmount,
          divisions: [
            ...(d.maleAmount > 0 ? ['male' as const] : []),
            ...(d.femaleAmount > 0 ? ['female' as const] : []),
          ],
          player: d.player,
        }));

    // ── SEASON: accumulated from topDonors ──
    const seasonMap = buildDonorMap();
    if (maleData?.topDonors?.length) mergeDonors(seasonMap, maleData.topDonors, 'male');
    if (femaleData?.topDonors?.length) mergeDonors(seasonMap, femaleData.topDonors, 'female');

    // ── PER-WEEK: Build a map of weekNumber → donors ──
    const weekDonorsMap = new Map<number, DivisionDonor[]>();
    const weekSultansMap = new Map<number, SultanOfWeekly[]>();

    // Group sultans by week
    for (const sultan of allSultans) {
      const existing = weekSultansMap.get(sultan.weekNumber) || [];
      existing.push(sultan);
      weekSultansMap.set(sultan.weekNumber, existing);
    }

    // Build per-week donor lists from sultanOfWeekly.allDonors
    for (const sultan of allSultans) {
      if (!sultan.allDonors?.length) continue;
      const existingMap = weekDonorsMap.has(sultan.weekNumber)
        ? (() => {
            // Rebuild the map from the existing DivisionDonor array
            const map = buildDonorMap();
            const existingDonors = weekDonorsMap.get(sultan.weekNumber)!;
            for (const d of existingDonors) {
              map.set(d.donorName.toLowerCase().trim(), {
                donorName: d.donorName,
                totalAmount: d.totalAmount,
                donationCount: d.donationCount,
                maleAmount: d.maleAmount,
                femaleAmount: d.femaleAmount,
                player: d.player,
              });
            }
            return map;
          })()
        : buildDonorMap();

      mergeDonorList(existingMap, sultan.allDonors, sultan.tournamentDivision as 'male' | 'female');
      weekDonorsMap.set(sultan.weekNumber, toDivisionDonors(existingMap));
    }

    // Fallback for weeks that have no allDonors but have weeklyTopDonors
    if (!weekDonorsMap.has(latestWeekNumber)) {
      const fallbackMap = buildDonorMap();
      if (maleData?.weeklyTopDonors?.length) mergeDonors(fallbackMap, maleData.weeklyTopDonors, 'male');
      if (femaleData?.weeklyTopDonors?.length) mergeDonors(fallbackMap, femaleData.weeklyTopDonors, 'female');
      if (fallbackMap.size > 0) {
        weekDonorsMap.set(latestWeekNumber, toDivisionDonors(fallbackMap));
      }
    }

    return {
      seasonDonors: toDivisionDonors(seasonMap),
      weekDonorsMap,
      availableWeeks,
      weekSultansMap,
      latestWeekNumber,
    };
  }, [maleData, femaleData]);

  // ── Selected week for per-week view ──
  const selectedWeek = typeof timeRange === 'number' ? timeRange : latestWeekNumber;
  const weekDonors = weekDonorsMap.get(selectedWeek) || [];
  const weekSultans = weekSultansMap.get(selectedWeek) || [];
  const hasWeekDonors = weekDonorsMap.size > 0;

  // ── Active donors based on time range ──
  const activeDonors = timeRange === 'season' ? seasonDonors : weekDonors;

  // ── Filtered donors based on division toggle ──
  const filteredDonors = useMemo(() => {
    if (divisionFilter === 'all') return activeDonors;
    return activeDonors.filter((d) => d.divisions.includes(divisionFilter));
  }, [activeDonors, divisionFilter]);

  const totalDonation = filteredDonors.reduce((s, d) => s + d.totalAmount, 0);
  const totalMale = filteredDonors.reduce((s, d) => s + d.maleAmount, 0);
  const totalFemale = filteredDonors.reduce((s, d) => s + d.femaleAmount, 0);

  // ── Sultan to display ──
  // Season view → latest week's sultan; Week view → selected week's sultans
  const displaySultans = timeRange === 'season'
    ? (weekSultansMap.get(latestWeekNumber) || [])
    : weekSultans;

  // ── Loading skeleton ──
  if (isDataLoading) {
    return (
      <section className="landing-section relative py-6 sm:py-12 px-4 sm:px-6 lg:px-8 overflow-hidden bg-deep border-y border-border/30 dark:border-0">
        {/* Background — dot pattern (bottom-weighted) */}
        <div className="absolute inset-0 opacity-[0.018] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(239,249,35,0.5) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        {/* Radial glow — bottom-left emphasis (maroon/donor theme) */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 25% 80%, rgba(239,249,35,0.02) 0%, transparent 50%), radial-gradient(ellipse at 75% 20%, rgba(128,0,32,0.04) 0%, transparent 45%), radial-gradient(ellipse at 60% 60%, rgba(46,159,255,0.025) 0%, transparent 40%)' }} />

        <div className="relative z-10 max-w-7xl mx-auto">
          <SectionHeader
            icon={HandCoins}
            label="Penyawer"
            title="🏆 Leaderboard Penyawer"
            subtitle="Dukung turnamen favoritmu!"
          />
          <div className="sm:max-w-2xl sm:mx-auto space-y-4">
            <div className="skeleton-shimmer h-48 rounded-2xl" />
            <div className="skeleton-shimmer h-16 rounded-2xl" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer h-20 rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  // ── Empty state ──
  if (seasonDonors.length === 0 && weekDonors.length === 0) {
    return (
      <section className="landing-section relative py-6 sm:py-12 px-4 sm:px-6 lg:px-8 overflow-hidden bg-deep border-y border-border/30 dark:border-0">
        {/* Background — dot pattern (bottom-weighted) */}
        <div className="absolute inset-0 opacity-[0.018] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(239,249,35,0.5) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        {/* Radial glow — bottom-left emphasis (maroon/donor theme) */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 25% 80%, rgba(239,249,35,0.02) 0%, transparent 50%), radial-gradient(ellipse at 75% 20%, rgba(128,0,32,0.04) 0%, transparent 45%), radial-gradient(ellipse at 60% 60%, rgba(46,159,255,0.025) 0%, transparent 40%)' }} />

        <div className="relative z-10 max-w-7xl mx-auto">
          <SectionHeader
            icon={HandCoins}
            label="Penyawer"
            title="🏆 Leaderboard Penyawer"
            subtitle="Dukung turnamen favoritmu!"
          />

          <AnimatedSection variant="fadeUp" className="sm:max-w-2xl sm:mx-auto">
            <Card className="bg-background/70 backdrop-blur-sm border border-idm-gold-warm/10 rounded-2xl">
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col items-center justify-center py-10 rounded-2xl bg-idm-gold-warm/[0.03]">
                  <Heart className="w-12 h-12 mb-4 text-idm-gold-warm/20" />
                  <p className="text-sm font-semibold text-muted-foreground">Belum ada penyawer minggu ini</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Jadilah yang pertama menyawer!</p>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>
        </div>
      </section>
    );
  }

  return (
    <section className="landing-section relative py-6 sm:py-12 px-4 sm:px-6 lg:px-8 overflow-hidden bg-deep border-y border-border/30 dark:border-0">
      {/* Background — dot pattern (bottom-weighted) */}
      <div className="absolute inset-0 opacity-[0.018] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(239,249,35,0.5) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      {/* Radial glow — bottom-left emphasis (maroon/donor theme) */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 25% 80%, rgba(239,249,35,0.02) 0%, transparent 50%), radial-gradient(ellipse at 75% 20%, rgba(128,0,32,0.04) 0%, transparent 45%), radial-gradient(ellipse at 60% 60%, rgba(46,159,255,0.025) 0%, transparent 40%)' }} />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* ── Section Header ── */}
        <SectionHeader
          icon={HandCoins}
          label="Penyawer"
          title="🏆 Leaderboard Penyawer"
          subtitle="Dukung turnamen favoritmu!"
        />

        <div className="sm:max-w-2xl sm:mx-auto">
          {/* ── Toggles Row — two separate pill groups on one line ── */}
          <AnimatedSection variant="fadeUp" className="mb-6">
            <div className="flex items-center gap-1 sm:gap-2 justify-center sm:justify-between">
              {/* Time range toggle: Season vs Week selector */}
              <div className="flex items-center gap-0.5 sm:gap-1.5 p-0.5 sm:p-1 rounded-full bg-idm-gold-warm/[0.06] border border-idm-gold-warm/10 shrink-0">
                {/* Season button */}
                <button
                  onClick={() => setTimeRange('season')}
                  className={`compact-pill px-1.5 sm:px-3 py-0.5 sm:py-1.5 rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                    timeRange === 'season'
                      ? 'bg-idm-gold-warm/15 text-idm-gold-warm shadow-[0_0_8px_color-mix(in_srgb,var(--color-idm-gold-warm)_15%,transparent)]'
                      : 'text-muted-foreground/60 hover:text-idm-gold-warm/70'
                  }`}
                  aria-pressed={timeRange === 'season'}
                >
                  <span className="sm:hidden">Season</span><span className="hidden sm:inline">🏆 Season</span>
                </button>

                {/* Week selector — only shown when there are weeks available */}
                {availableWeeks.length > 0 && (
                  <>
                    <div className="w-px h-3 sm:h-4 bg-idm-gold-warm/15" />
                    <WeekSelector
                      availableWeeks={availableWeeks}
                      selectedWeek={typeof timeRange === 'number' ? timeRange : latestWeekNumber}
                      latestWeek={latestWeekNumber}
                      onSelectWeek={(week) => setTimeRange(week)}
                    />
                  </>
                )}
              </div>

              {/* Division toggle */}
              <div className="flex items-center gap-0 sm:gap-0.5 p-0.5 sm:p-1 rounded-full bg-idm-gold-warm/[0.06] border border-idm-gold-warm/10 shrink-0">
                {([
                  { key: 'all' as DivisionFilter, label: <><span className="sm:hidden">Semua</span><span className="hidden sm:inline">Semua</span></> },
                  { key: 'male' as DivisionFilter, label: <><span className="sm:hidden">Cowo</span><span className="hidden sm:inline">♂ Cowo</span></> },
                  { key: 'female' as DivisionFilter, label: <><span className="sm:hidden">Cewe</span><span className="hidden sm:inline">♀ Cewe</span></> },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setDivisionFilter(key)}
                    className={`compact-pill px-1.5 sm:px-3 py-0.5 sm:py-1.5 rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                      divisionFilter === key
                        ? 'bg-idm-gold-warm/15 text-idm-gold-warm shadow-[0_0_8px_color-mix(in_srgb,var(--color-idm-gold-warm)_15%,transparent)]'
                        : 'text-muted-foreground/60 hover:text-idm-gold-warm/70'
                    }`}
                    aria-pressed={divisionFilter === key}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </AnimatedSection>

          {/* ── Sultan of the Week Card ── */}
          {displaySultans.length > 0 && (
            <SultanOfWeeklyCard sultans={displaySultans} />
          )}

          {/* ── Leaderboard List ── */}
          <AnimatedSection variant="fadeUp">
            <Card className="backdrop-blur-sm bg-background/60 border border-idm-gold-warm/15 rounded-2xl overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
              <CardContent className="p-3 sm:p-4">
                {filteredDonors.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-xs text-muted-foreground">
                      {timeRange === 'season'
                        ? 'Belum ada penyawer musim ini'
                        : `Belum ada penyawer di Week ${selectedWeek}`
                      }
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-[280px] sm:max-h-[300px] overflow-y-auto custom-scrollbar-visible pr-1">
                    {filteredDonors.map((donor, i) => {
                      const medal = RANK_MEDALS[i] || null;

                      // Row background: top 3 get subtle glow, rest plain
                      const rowBg = i === 0
                        ? 'bg-gradient-to-r from-idm-gold-warm/[0.08] to-idm-gold-warm/[0.02] border-idm-gold-warm/20'
                        : i === 1
                        ? 'bg-gradient-to-r from-amber-400/[0.06] to-amber-400/[0.01] border-amber-400/15'
                        : i === 2
                        ? 'bg-gradient-to-r from-amber-500/[0.05] to-amber-500/[0.01] border-amber-500/12'
                        : 'hover:bg-idm-gold-warm/[0.03] border-transparent';

                      return (
                        <div
                          key={donor.donorName}
                          className={`flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-colors duration-200 border ${rowBg}`}
                        >
                          {/* Rank number */}
                          <span className="w-5 sm:w-6 text-center shrink-0">
                            {medal ? (
                              <span className="text-sm sm:text-base">{medal}</span>
                            ) : (
                              <span className="text-xs sm:text-sm font-bold text-muted-foreground/60">{i + 1}</span>
                            )}
                          </span>

                          {/* Avatar */}
                          <div
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden shrink-0"
                            style={donor.player?.avatar
                              ? { border: `2px solid ${i === 0 ? 'rgba(250,204,21,0.5)' : 'rgba(249,203,37,0.25)'}` }
                              : {}
                            }
                          >
                            {donor.player?.avatar ? (
                              <img
                                src={donor.player.avatar}
                                alt={donor.donorName}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div
                                className="w-full h-full flex items-center justify-center"
                                style={{
                                  background: i === 0
                                    ? 'linear-gradient(135deg, #EFF923, #F9CB25)'
                                    : 'linear-gradient(135deg, rgba(249,203,37,0.3), rgba(249,203,37,0.15))',
                                }}
                              >
                                <span className={`text-[10px] sm:text-[11px] font-bold ${i === 0 ? 'text-black/70' : 'text-idm-gold-warm/80'}`}>
                                  {getInitials(donor.donorName)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Name + badges */}
                          <div className="flex-1 min-w-0 flex items-center gap-1.5">
                            <span
                              className={`text-xs sm:text-sm font-bold truncate ${
                                i === 0 ? 'text-idm-gold-warm' : i === 1 ? 'text-amber-300' : i === 2 ? 'text-amber-400' : 'text-foreground/80'
                              }`}
                            >
                              {donor.donorName}
                            </span>
                            {/* Division badges — compact */}
                            {donor.divisions.map((div) => (
                              <DivisionBadge key={div} division={div} />
                            ))}
                          </div>

                          {/* Amount + sawer count — right aligned */}
                          <div className="text-right shrink-0">
                            <p className={`text-xs sm:text-sm font-bold ${i === 0 ? 'text-idm-gold-warm' : i === 1 ? 'text-amber-300' : 'text-idm-gold-warm/80'}`}>
                              {formatCurrencyShort(donor.totalAmount)}
                            </p>
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground/60">
                              {donor.donationCount}x sawer
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {/* Scroll indicator — show if more than visible */}
                    {filteredDonors.length > 5 && (
                      <div className="text-center py-1.5 text-[10px] text-muted-foreground/40 sticky bottom-0 bg-gradient-to-t from-background/80 to-transparent pointer-events-none">
                        ↕ Scroll untuk lihat semua ({filteredDonors.length} penyawer)
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </AnimatedSection>

          {/* ── Summary Bar + CTA ── */}
          <AnimatedSection variant="fadeUp" className="mt-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-idm-gold-warm/[0.04] border border-idm-gold-warm/10">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Total Saweran {timeRange === 'season' ? 'Season' : `Week ${selectedWeek}`} → Prize Pool
                  </p>
                  <p className="text-lg font-black bg-gradient-to-r from-idm-gold-warm to-amber-300 bg-clip-text text-transparent">
                    {formatCurrencyShort(totalDonation || 0)}
                  </p>
                  {/* Mobile: per-division breakdown under total */}
                  <div className="flex sm:hidden items-center gap-3 mt-1">
                    {totalMale > 0 && (
                      <span className="text-[10px] text-idm-male-light/80">
                        ♂ Cowo {formatRupiahShort(totalMale)}
                      </span>
                    )}
                    {totalFemale > 0 && (
                      <span className="text-[10px] text-idm-female-light/80">
                        ♀ Cewe {formatRupiahShort(totalFemale)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <Sparkles className="w-5 h-5 text-idm-gold-warm/30" />
                  {/* Desktop: per-division breakdown on the right */}
                  <div className="hidden sm:flex items-center gap-2 mt-1">
                    {totalMale > 0 && (
                      <span className="text-[10px] text-idm-male-light/80">
                        ♂ {formatRupiahShort(totalMale)}
                      </span>
                    )}
                    {totalFemale > 0 && (
                      <span className="text-[10px] text-idm-female-light/80">
                        ♀ {formatRupiahShort(totalFemale)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
