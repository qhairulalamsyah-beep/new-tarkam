'use client';

import { useState, useMemo } from 'react';
import { Users, Star, ArrowRight, Trophy, Music, Shield, Zap } from 'lucide-react';
import { SectionHeader } from './shared';
import { getAvatarUrl } from '@/lib/utils';
import { ClubLogoImage } from '@/components/idm/club-logo-image';
import { useAppStore } from '@/lib/store';
import type { StatsData } from '@/types/stats';

type DivisionFilter = 'all' | 'male' | 'female';
type PlayerItem = StatsData['topPlayers'][0] & { division?: string };

interface TopPlayersSectionProps {
  maleData: StatsData | undefined;
  femaleData: StatsData | undefined;
  onPlayerSelect: (player: PlayerItem | null) => void;
}

/* ── Tier badge colors: S=gold, A=blue, B=gray ── */
function getTierStyle(tier: string) {
  const t = tier?.toUpperCase();
  if (t === 'S') return { bg: 'bg-gradient-to-br from-yellow-400 to-amber-600', text: 'text-white', label: 'S' };
  if (t === 'A') return { bg: 'bg-gradient-to-br from-blue-400 to-blue-600', text: 'text-white', label: 'A' };
  return { bg: 'bg-gradient-to-br from-gray-400 to-gray-500', text: 'text-white', label: 'B' };
}

/* ── Division color for gamertag ── */
function getDivisionNameColor(division?: string) {
  if (division === 'female') return 'text-idm-female-light dark:text-[#FF5C9A]';
  return 'text-idm-male-light dark:text-[#57B5FF]';
}

/* ── Win Rate Progress Bar ── */
function WinRateBar({ totalWins, matches }: { totalWins: number; matches: number }) {
  const rate = matches > 0 ? Math.round((totalWins / matches) * 100) : 0;
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] text-muted-foreground/60 font-medium">Win Rate</span>
        <span className="text-[10px] font-bold text-idm-gold-warm">{rate}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-idm-gold-warm/10 overflow-hidden">
        <div
          className="top-player-winrate-bar h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${rate}%` }}
        />
      </div>
    </div>
  );
}

/* ── Player Card ── */
function PlayerCard({
  player,
  index,
  onClick,
}: {
  player: PlayerItem;
  index: number;
  onClick: () => void;
}) {
  const tierStyle = getTierStyle(player.tier);
  const avatarUrl = getAvatarUrl(
    player.gamertag,
    (player.division as 'male' | 'female') || 'male',
    player.avatar,
  );
  const clubName = typeof player.club === 'string' ? player.club : player.club?.name || '';
  const clubLogo = typeof player.club === 'object' && player.club !== null ? player.club.logo : null;

  const isFemale = player.division === 'female';
  const avatarBorderColor = isFemale ? 'border-idm-female/30 group-hover:border-idm-female/60' : 'border-idm-male/30 group-hover:border-idm-male/60';

  return (
    <div
      className="top-player-card stagger-item-fast group cursor-pointer"
      style={{ animationDelay: `${index * 60}ms` }}
      onClick={onClick}
    >
      <div className="relative bg-mid rounded-2xl border border-idm-gold-warm/10 overflow-hidden transition-all duration-300 group-hover:scale-[1.03] group-hover:shadow-[0_0_20px_color-mix(in_srgb,var(--color-idm-gold-warm)_18%,transparent),0_0_40px_color-mix(in_srgb,var(--color-idm-gold-warm)_6%,transparent)] group-hover:border-idm-gold-warm/35 top-player-card-glow">
        {/* Division-colored accent line at top */}
        <div className={`h-0.5 w-full ${isFemale ? 'bg-gradient-to-r from-transparent via-idm-female/40 to-transparent' : 'bg-gradient-to-r from-transparent via-idm-male/40 to-transparent'}`} />

        {/* Avatar + Info section */}
        <div className="p-4 flex flex-col items-center text-center">
          {/* Avatar */}
          <div className="relative mb-3">
            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 bg-idm-gold-warm/5 transition-all duration-300 ${avatarBorderColor}`}>
              <img
                src={avatarUrl}
                alt={player.gamertag}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            {/* Tier badge overlaid on avatar */}
            <span className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${tierStyle.bg} ${tierStyle.text} shadow-md border-2 border-mid`}>
              {tierStyle.label}
            </span>
          </div>

          {/* Gamertag — division-colored */}
          <h3 className={`text-sm font-bold truncate max-w-full group-hover:text-idm-gold-warm transition-colors duration-200 ${getDivisionNameColor(player.division)}`}>
            {player.gamertag}
          </h3>

          {/* Points (large number with pts suffix) */}
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black text-gradient-fury tabular-nums">
              {player.points.toLocaleString('id-ID')}
            </span>
            <span className="text-[10px] text-idm-gold-warm/60 font-semibold">pts</span>
          </div>

          {/* Win rate progress bar */}
          <div className="mt-3 w-full px-1">
            <WinRateBar totalWins={player.totalWins} matches={player.matches} />
          </div>

          {/* Club name (small text below) */}
          {clubName && (
            <div className="mt-2 flex items-center gap-1.5 justify-center">
              {clubLogo && (
                <ClubLogoImage
                  clubName={clubName}
                  dbLogo={clubLogo}
                  alt={clubName}
                  width={14}
                  height={14}
                  className="w-3.5 h-3.5 rounded object-cover"
                />
              )}
              <span className="text-[10px] text-muted-foreground/60 font-medium truncate max-w-[100px]">
                {clubName}
              </span>
            </div>
          )}

          {/* MVP count with star icon */}
          <div className="mt-2 flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-idm-gold-warm/70 fill-idm-gold-warm/40" />
            <span className="text-[11px] font-bold text-idm-gold-warm/80 tabular-nums">
              {player.totalMvp}
            </span>
            <span className="text-[9px] text-idm-gold-warm/50 font-medium">MVP</span>
          </div>
        </div>

        {/* Bottom hover accent line */}
        <div className="absolute bottom-0 left-[15%] right-[15%] h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--idm-gold-warm) 25%, transparent), transparent)' }} />
      </div>
    </div>
  );
}

/* ── Empty State ── */
function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="top-player-empty-ring relative w-20 h-20 mx-auto mb-4 rounded-full border-2 border-idm-gold-warm/10 flex items-center justify-center">
        <Trophy className="w-8 h-8 text-idm-gold-warm/20" />
      </div>
      <p className="text-sm text-muted-foreground/50 font-medium">Belum ada data pemain tersedia</p>
      <p className="text-xs text-muted-foreground/30 mt-1">Data pemain terbaik akan muncul di sini</p>
    </div>
  );
}

/* ── Main Component ── */
export function TopPlayersSection({ maleData, femaleData, onPlayerSelect }: TopPlayersSectionProps) {
  const [divisionFilter, setDivisionFilter] = useState<DivisionFilter>('all');
  const setCurrentView = useAppStore(s => s.setCurrentView);

  // Merge players based on division filter
  const displayPlayers = useMemo(() => {
    let male = (maleData?.topPlayers || []).map(p => ({ ...p, division: 'male' as const }));
    let female = (femaleData?.topPlayers || []).map(p => ({ ...p, division: 'female' as const }));

    if (divisionFilter === 'male') female = [];
    if (divisionFilter === 'female') male = [];

    return [...male, ...female]
      .sort((a, b) => b.points - a.points || a.gamertag.localeCompare(b.gamertag))
      .slice(0, 8);
  }, [maleData, femaleData, divisionFilter]);

  const totalPlayers = useMemo(() => {
    const male = (maleData?.topPlayers || []).map(p => ({ ...p, division: 'male' as const }));
    const female = (femaleData?.topPlayers || []).map(p => ({ ...p, division: 'female' as const }));
    if (divisionFilter === 'male') return male.length;
    if (divisionFilter === 'female') return female.length;
    return male.length + female.length;
  }, [maleData, femaleData, divisionFilter]);

  const hasMore = totalPlayers > 8;

  const handlePlayerClick = (player: PlayerItem) => {
    onPlayerSelect(player);
  };

  const navigateToPlayers = () => {
    setCurrentView('players');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  // Division filter config for pill tabs
  const divisionTabs: { key: DivisionFilter; label: string; icon: typeof Users }[] = [
    { key: 'all', label: 'Semua', icon: Users },
    { key: 'male', label: 'Cowo', icon: Music },
    { key: 'female', label: 'Cewe', icon: Shield },
  ];

  return (
    <section className="landing-section relative py-6 sm:py-12 px-4 overflow-hidden bg-deep border-y border-border/30 dark:border-0">
      {/* Background layers */}
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, color-mix(in srgb, var(--idm-gold-warm) 50%, transparent) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 20%, rgba(239,249,35,0.03) 0%, transparent 50%), radial-gradient(ellipse at 20% 60%, rgba(46,159,255,0.04) 0%, transparent 40%), radial-gradient(ellipse at 80% 60%, rgba(255,45,120,0.04) 0%, transparent 40%)' }} />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="stagger-item">
          <SectionHeader
            icon={Users}
            label="Top Pemain"
            title="Pemain Terbaik Tarkam"
            subtitle="Pemain dengan performa terbaik di arena Tarkam IDM"
          />
        </div>

        {/* Division Filter Pills (Semua / Cowo / Cewe) */}
        <div className="stagger-item-fast flex items-center justify-center mb-6" style={{ animationDelay: '30ms' }}>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-idm-gold-warm/5 border border-idm-gold-warm/10">
            {divisionTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setDivisionFilter(tab.key)}
                className={`compact-pill flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all whitespace-nowrap cursor-pointer ${
                  divisionFilter === tab.key
                    ? 'bg-idm-gold-warm/15 text-idm-gold-warm shadow-sm shadow-idm-gold-warm/10 border border-idm-gold-warm/25'
                    : 'text-muted-foreground/70 hover:text-foreground border border-transparent hover:bg-muted/40'
                }`}
                aria-label={`Filter ${tab.label}`}
                aria-pressed={divisionFilter === tab.key}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Player Grid */}
        {displayPlayers.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {displayPlayers.map((player, idx) => (
                <PlayerCard
                  key={`${player.id}-${player.division}`}
                  player={player}
                  index={idx}
                  onClick={() => handlePlayerClick(player)}
                />
              ))}
            </div>

            {/* "Lihat Semua" CTA Button — navigates to players page */}
            {hasMore && (
              <div className="flex justify-center mt-8">
                <div className="relative rounded-full p-[1.5px] bg-gradient-to-r from-idm-gold-warm/40 via-idm-gold-warm/80 to-idm-gold-warm/40 hover:from-idm-gold-warm/60 hover:via-idm-gold-warm hover:to-idm-gold-warm/60 transition-all duration-500">
                  <button
                    onClick={navigateToPlayers}
                    className="compact-pill relative inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-background text-idm-gold-warm text-xs font-semibold transition-all duration-300 hover:bg-idm-gold-warm/10 cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4" />
                    Lihat Semua
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
