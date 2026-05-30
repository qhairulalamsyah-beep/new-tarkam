'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════
 * TARKAM IDM — Top Rank #1 Section
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Side-by-Side Full Avatar Card edition
 * Shows #1 ranked player from each division side by side with
 * standard casino-card styling, animated stats, and central VS badge.
 * Consistent with other section cards (Weekly Champion, etc.)
 * ═══════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import { Crown, Music, Shield, Zap, Trophy, Flame, Star, ChevronRight } from 'lucide-react';
import { AvatarMedia } from '@/components/ui/avatar-media';
import { Badge } from '@/components/ui/badge';
import { getAvatarUrl, clubToString } from '@/lib/utils';
import { getCommunityTheme } from '@/hooks/use-community-theme';
import { getDivisionTheme } from '@/hooks/use-division-theme';
import type { StatsData, TopPlayer } from '@/types/stats';


/* ═════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

type DivisionFilter = 'all' | 'male' | 'female';

type PlayerClickHandler = (player: TopPlayer & { division?: string }, division: 'male' | 'female') => void;

interface TopRankSectionProps {
  maleData?: StatsData;
  femaleData?: StatsData;
  selectedDivision?: DivisionFilter;
  onPlayerClick?: PlayerClickHandler;
}


/* ═══════════════════════════════════════════
   Division Config
   ═══════════════════════════════════════════ */

const DIVISION_CONFIG = {
  male: {
    label: '♂ Cowo',
    hex: '#57B5FF',
    darkOverlay: 'rgba(10,14,30,0.95)',
  },
  female: {
    label: '♀ Cewe',
    hex: '#FF5C9A',
    darkOverlay: 'rgba(30,10,20,0.95)',
  },
} as const;

type DivisionKey = keyof typeof DIVISION_CONFIG;


/* ═══════════════════════════════════════════
   Stat Bar — Animated fill on scroll
   ═══════════════════════════════════════════ */

function StatBar({
  label,
  value,
  maxValue,
  barBg,
  delay,
  isVisible,
  icon: Icon,
}: {
  label: string;
  value: number;
  maxValue: number;
  barBg: string;
  delay: number;
  isVisible: boolean;
  icon: React.ElementType;
}) {
  const percentage = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;

  return (
    <div className="space-y-1.5" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3 h-3 opacity-50" />
          <span className="text-[11px] sm:text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">
            {label}
          </span>
        </div>
        <span className="text-sm sm:text-base font-black tabular-nums text-foreground/90">
          {value}
        </span>
      </div>
      <div className="h-2 sm:h-2.5 rounded-full bg-muted/15 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barBg}`}
          style={{
            width: isVisible ? `${percentage}%` : '0%',
            transitionDelay: `${delay}ms`,
          }}
        />
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════
   Single Player Full Avatar Card
   ═══════════════════════════════════════════ */

function PlayerFullCard({
  player,
  division,
  isVisible,
  onViewPlayer,
}: {
  player: TopPlayer | undefined;
  division: DivisionKey;
  isVisible: boolean;
  onViewPlayer?: PlayerClickHandler;
}) {
  const config = DIVISION_CONFIG[division];
  const divisionHex = config.hex;
  const divisionLabel = config.label;

  const clubName = clubToString(player?.club as Parameters<typeof clubToString>[0]) || '';
  const avatarUrl = player ? getAvatarUrl(player.gamertag, division, player.avatar) : '';

  const maxPoints = Math.max(player?.points || 100, 100);
  const maxWins = Math.max(player?.totalWins || 20, 20);
  const maxLosses = Math.max((player?.matches || 0) - (player?.totalWins || 0), 5);
  const maxMatches = Math.max(player?.matches || 30, 30);
  const maxMvp = Math.max(player?.totalMvp || 5, 5);

  const losses = (player?.matches || 0) - (player?.totalWins || 0);

  const barBg = division === 'male' ? 'bg-idm-male' : 'bg-idm-female';
  const barBgGold = 'bg-idm-gold-warm';
  const barBgMaroon = 'bg-red-700';
  const barBgEmerald = 'bg-emerald-500';
  const barBgOrange = 'bg-orange-500';

  const dt = getDivisionTheme(division);

  if (!player) {
    return (
      <div className={`flex-1 ${dt.casinoCard} overflow-hidden flex flex-col items-center justify-center min-h-[400px]`} style={{ borderRadius: '28px' }}>
        <div className={dt.casinoBar} />
        <Crown className="w-12 h-12 text-idm-gold-warm/15 mb-3" />
        <p className="text-sm text-muted-foreground/40 text-center">Belum ada data pemain</p>
      </div>
    );
  }

  return (
    <div className={`flex-1 ${dt.casinoCard} overflow-hidden relative`} style={{ borderRadius: '28px' }}>
      <div className={dt.casinoBar} />

      {/* Division accent line at top */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] z-20"
        style={{ background: `linear-gradient(90deg, transparent, ${divisionHex}50, transparent)` }}
      />

      {/* Card content */}
      <div className="relative p-5 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center">

          {/* ═══ Full Avatar Container ═══ */}
          <div className="relative w-48 h-56 sm:w-56 sm:h-64 lg:w-64 lg:h-72 rounded-2xl overflow-hidden">
            {/* Background gradient behind avatar */}
            <div
              className="absolute inset-0 transition-colors duration-700"
              style={{
                background: `linear-gradient(180deg, ${divisionHex}25 0%, ${divisionHex}08 50%, transparent 100%)`,
              }}
            />

            {/* Large Avatar Image */}
            <div className="absolute inset-0 flex items-start justify-center pt-2 sm:pt-3">
              <div
                className="relative w-36 h-36 sm:w-44 sm:h-44 lg:w-48 lg:h-48 rounded-full overflow-hidden"
                style={{
                  boxShadow: `0 0 16px ${divisionHex}15`,
                }}
              >
                {/* Ring border */}
                <div
                  className="absolute -inset-1 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${divisionHex}60, ${divisionHex}20, transparent, ${divisionHex}40)`,
                    padding: '2px',
                  }}
                >
                  <div className="w-full h-full rounded-full bg-background/50" />
                </div>

                <AvatarMedia
                  src={avatarUrl}
                  alt={player.gamertag}
                  fill
                  sizes="(max-width: 768px) 144px, 192px"
                  className="object-cover object-top rounded-full"
                  loading="lazy"
                />
              </div>
            </div>

            {/* ── #1 Rank Badge ── */}
            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-20">
              <div
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-black"
                style={{
                  background: 'linear-gradient(135deg, #EFF923, #F9CB25)',
                  color: '#1c1917',
                  boxShadow: '0 0 12px rgba(239,249,35,0.4), 0 0 24px rgba(239,249,35,0.15)',
                  animation: isVisible ? 'badge-float-glow 2.5s ease-in-out infinite' : undefined,
                }}
              >
                <Crown className="w-3 h-3" />
                #1
              </div>
            </div>

            {/* ── Bottom overlay: Gamertag & Division ── */}
            <div className="absolute bottom-0 left-0 right-0 z-10">
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(180deg, transparent 0%, ${config.darkOverlay} 100%)`,
                }}
              />
              <div className="relative px-3 sm:px-4 pb-3 sm:pb-4 pt-8">
                <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-white leading-tight text-center">
                  {player.gamertag}
                </h3>
                <div className="flex items-center gap-1.5 justify-center mt-1">
                  {clubName && (
                    <span className="text-[10px] sm:text-[11px] font-semibold text-idm-gold-warm/70">
                      {clubName}
                    </span>
                  )}
                  {clubName && <span className="text-white/20">·</span>}
                  <span
                    className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-bold uppercase"
                    style={{ color: divisionHex }}
                  >
                    {division === 'male' ? <Music className="w-2.5 h-2.5" /> : <Shield className="w-2.5 h-2.5" />}
                    {divisionLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ Animated Stat Bars ═══ */}
          <div className="w-full space-y-2.5 sm:space-y-3 mt-5 sm:mt-6">
            <StatBar label="Points" value={player.points || 0} maxValue={maxPoints} barBg={barBg} delay={0} isVisible={isVisible} icon={Zap} />
            <StatBar label="Wins" value={player.totalWins || 0} maxValue={maxWins} barBg={barBgGold} delay={50} isVisible={isVisible} icon={Trophy} />
            <StatBar label="Losses" value={losses} maxValue={maxLosses} barBg={barBgMaroon} delay={100} isVisible={isVisible} icon={Flame} />
            <StatBar label="Matches" value={player.matches || 0} maxValue={maxMatches} barBg={barBgEmerald} delay={150} isVisible={isVisible} icon={Flame} />
            <StatBar label="MVP" value={player.totalMvp || 0} maxValue={maxMvp} barBg={barBgOrange} delay={200} isVisible={isVisible} icon={Star} />
          </div>

          {/* ═══ CTA Button ═══ */}
          {onViewPlayer && (
            <div className="w-full mt-4 sm:mt-5">
              <button
                onClick={() => onViewPlayer({
                  id: player.id,
                  name: player.gamertag,
                  gamertag: player.gamertag,
                  avatar: player.avatar,
                  tier: player.tier,
                  points: player.points,
                  totalWins: player.totalWins,
                  totalMvp: player.totalMvp,
                  streak: player.streak,
                  maxStreak: player.maxStreak,
                  matches: player.matches,
                  club: player.club,
                  city: player.city,
                  division,
                }, division)}
                className="compact-pill btn-press group/btn w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-95 border"
                style={{
                  backgroundColor: `${divisionHex}12`,
                  borderColor: `${divisionHex}25`,
                  color: divisionHex,
                }}
              >
                <Crown className="w-3.5 h-3.5" />
                Lihat Profil
                <ChevronRight className="w-3 h-3 group-hover/btn:translate-x-0.5 transition-transform" />
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}


/* ═══════════════════════════════════════════
   Ghost Player Full Card — Empty state skeleton
   Matches the layout of PlayerFullCard but with
   skeleton placeholders and muted styling.
   ═══════════════════════════════════════════ */

function GhostPlayerFullCard({ division }: { division: DivisionKey }) {
  const config = DIVISION_CONFIG[division];
  const divisionHex = config.hex;
  const divisionLabel = config.label;
  const dt = getDivisionTheme(division);

  const ghostStats = [
    { label: 'Points', barBg: division === 'male' ? 'bg-idm-male/30' : 'bg-idm-female/30', width: '75%' },
    { label: 'Wins', barBg: 'bg-idm-gold-warm/30', width: '60%' },
    { label: 'Losses', barBg: 'bg-red-700/30', width: '40%' },
    { label: 'Matches', barBg: 'bg-emerald-500/30', width: '55%' },
    { label: 'MVP', barBg: 'bg-orange-500/30', width: '30%' },
  ];

  return (
    <div className={`flex-1 ${dt.casinoCard} overflow-hidden relative opacity-50`} style={{ borderRadius: '28px' }}>
      <div className={dt.casinoBar} />

      {/* Division accent line at top */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] z-20"
        style={{ background: `linear-gradient(90deg, transparent, ${divisionHex}30, transparent)` }}
      />

      {/* Card content */}
      <div className="relative p-5 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center">

          {/* ═══ Ghost Avatar Container ═══ */}
          <div className="relative w-48 h-56 sm:w-56 sm:h-64 lg:w-64 lg:h-72 rounded-2xl overflow-hidden">
            {/* Background gradient */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg, ${divisionHex}10 0%, ${divisionHex}04 50%, transparent 100%)`,
              }}
            />

            {/* Ghost circle avatar placeholder */}
            <div className="absolute inset-0 flex items-start justify-center pt-2 sm:pt-3">
              <div
                className="relative w-36 h-36 sm:w-44 sm:h-44 lg:w-48 lg:h-48 rounded-full overflow-hidden"
                style={{
                  boxShadow: `0 0 16px ${divisionHex}08`,
                }}
              >
                {/* Ring border — ghost version */}
                <div
                  className="absolute -inset-1 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${divisionHex}25, ${divisionHex}10, transparent, ${divisionHex}15)`,
                    padding: '2px',
                  }}
                >
                  <div className="w-full h-full rounded-full bg-muted/20 flex items-center justify-center">
                    <Crown className="w-10 h-10 text-idm-gold-warm/15" />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Ghost #1 Rank Badge ── */}
            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-20">
              <div
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-black"
                style={{
                  background: 'linear-gradient(135deg, rgba(239,249,35,0.15), rgba(249,203,37,0.1))',
                  color: 'rgba(28,25,23,0.3)',
                  border: '1px solid rgba(239,249,35,0.1)',
                }}
              >
                <Crown className="w-3 h-3 text-idm-gold-warm/30" />
                #1
              </div>
            </div>

            {/* ── Bottom overlay: Ghost gamertag ── */}
            <div className="absolute bottom-0 left-0 right-0 z-10">
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(180deg, transparent 0%, ${config.darkOverlay} 100%)`,
                }}
              />
              <div className="relative px-3 sm:px-4 pb-3 sm:pb-4 pt-8 flex flex-col items-center">
                {/* Ghost gamertag */}
                <div className="h-6 w-28 rounded bg-white/10 mb-1.5" />
                {/* Ghost club + division */}
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-16 rounded bg-idm-gold-warm/10" />
                  <span className="text-white/10">·</span>
                  <span
                    className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-bold uppercase opacity-30"
                    style={{ color: divisionHex }}
                  >
                    {division === 'male' ? <Music className="w-2.5 h-2.5" /> : <Shield className="w-2.5 h-2.5" />}
                    {divisionLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ Ghost Stat Bars ═══ */}
          <div className="w-full space-y-2.5 sm:space-y-3 mt-5 sm:mt-6">
            {ghostStats.map((stat) => (
              <div key={stat.label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-muted/20" />
                    <span className="text-[11px] sm:text-xs font-bold text-muted-foreground/30 uppercase tracking-wider">
                      {stat.label}
                    </span>
                  </div>
                  <div className="h-4 w-8 rounded bg-muted/20" />
                </div>
                <div className="h-2 sm:h-2.5 rounded-full bg-muted/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${stat.barBg}`}
                    style={{ width: stat.width }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* ═══ Ghost CTA Button ═══ */}
          <div className="w-full mt-4 sm:mt-5">
            <div
              className="w-full h-10 rounded-xl border"
              style={{
                backgroundColor: `${divisionHex}08`,
                borderColor: `${divisionHex}12`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════
   Main Section — Top Rank #1
   ═══════════════════════════════════════════ */

export function TopRankSection({ maleData, femaleData, selectedDivision = 'all', onPlayerClick }: TopRankSectionProps) {
  const showMale = selectedDivision === 'all' || selectedDivision === 'male';
  const showFemale = selectedDivision === 'all' || selectedDivision === 'female';

  const maleFeatured = maleData?.topPlayers?.[0];
  const femaleFeatured = femaleData?.topPlayers?.[0];

  const ct = getCommunityTheme();

  // Determine if we have any real data or need ghost state
  const hasAnyData = !!(maleFeatured || femaleFeatured);

  return (
    <div className={`${ct.casinoCard} overflow-hidden relative ${!hasAnyData ? 'opacity-70' : ''}`} style={{ borderRadius: '28px' }}>
      <div className={ct.casinoBar} />

      {/* Header — consistent with other section cards */}
      <div className={`flex items-center gap-2.5 px-3 lg:px-6 py-3 border-b ${ct.borderSubtle}`}>
        <div className={`w-5 h-5 lg:w-6 lg:h-6 rounded ${ct.iconBg} flex items-center justify-center shrink-0`}>
          <Crown className={`w-3 h-3 lg:w-3.5 lg:h-3.5 ${ct.neonText}`} />
        </div>
        <h3 className="text-xs lg:text-sm font-semibold uppercase tracking-wider">
          👑 Top Rank #1
        </h3>
        <span className="text-[9px] font-bold uppercase tracking-wider text-idm-gold-warm">
          {showMale && showFemale ? 'COWO & CEWE' : showMale ? '♂ COWO' : '♀ CEWE'}
        </span>
        {hasAnyData ? (
          <Badge className={`ml-auto ${ct.casinoBadge} text-[9px]`}>
            #1
          </Badge>
        ) : (
          <Badge className="ml-auto bg-muted/20 text-muted-foreground/40 border border-border/10 text-[9px] font-bold">
            TBA
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-4 lg:p-6">
        {/* ═══ Side-by-Side Player Cards ═══ */}
        <div className="flex flex-col lg:flex-row items-stretch gap-4 lg:gap-0">

          {/* Male Player Card */}
          {showMale && (
            maleFeatured ? (
              <PlayerFullCard
                player={maleFeatured}
                division="male"
                isVisible={true}
                onViewPlayer={onPlayerClick}
              />
            ) : (
              <GhostPlayerFullCard division="male" />
            )
          )}

          {/* Central VS Badge — Desktop */}
          {showMale && showFemale && (
            <div className="hidden lg:flex items-center justify-center w-20 shrink-0 relative" aria-hidden="true">
              {/* Vertical divider */}
              <div className="absolute top-8 bottom-8 left-1/2 w-px bg-gradient-to-b from-transparent via-idm-gold-warm/20 to-transparent" />
              {/* VS circle */}
              <div className="relative z-10 w-14 h-14 rounded-full bg-background border-2 border-idm-gold-warm/30 flex items-center justify-center shadow-sm">
                <span className="text-sm font-black text-idm-gold-warm">VS</span>
              </div>
            </div>
          )}

          {/* VS Badge — Mobile/Tablet (horizontal) */}
          {showMale && showFemale && (
            <div className="flex lg:hidden items-center justify-center relative py-2" aria-hidden="true">
              <div className="absolute left-8 right-8 top-1/2 h-px bg-gradient-to-r from-idm-male/20 via-idm-gold-warm/20 to-idm-female/20" />
              <div className="relative z-10 w-11 h-11 rounded-full bg-background border-2 border-idm-gold-warm/30 flex items-center justify-center shadow-sm">
                <span className="text-xs font-black text-idm-gold-warm">VS</span>
              </div>
            </div>
          )}

          {/* Female Player Card */}
          {showFemale && (
            femaleFeatured ? (
              <PlayerFullCard
                player={femaleFeatured}
                division="female"
                isVisible={true}
                onViewPlayer={onPlayerClick}
              />
            ) : (
              <GhostPlayerFullCard division="female" />
            )
          )}
        </div>
      </div>
    </div>
  );
}
