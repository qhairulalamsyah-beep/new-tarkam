'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, Lock, Calendar, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { getDivisionTheme } from '@/hooks/use-division-theme';

/* ─── Rarity System ─── */
const RARITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; glow: string; text: string }> = {
  common:    { label: 'Biasa',     color: '#9CA3AF', bg: 'bg-gray-500/10',       border: 'border-gray-500/20',       glow: 'shadow-gray-400/20',       text: 'text-gray-400' },
  uncommon:  { label: 'Tidak Biasa', color: '#34D399', bg: 'bg-emerald-500/10',    border: 'border-emerald-500/20',    glow: 'shadow-emerald-400/30',    text: 'text-emerald-400' },
  rare:      { label: 'Langka',    color: '#60A5FA', bg: 'bg-blue-500/10',       border: 'border-blue-500/20',       glow: 'shadow-blue-400/30',       text: 'text-blue-400' },
  legendary: { label: 'Legendaris', color: '#FBBF24', bg: 'bg-idm-gold-warm/10',  border: 'border-idm-gold-warm/20', glow: 'shadow-idm-gold-warm/40',  text: 'text-idm-gold-warm' },
};

// Map tier from DB to rarity
function tierToRarity(tier: string): 'common' | 'uncommon' | 'rare' | 'legendary' {
  switch (tier) {
    case 'gold': return 'legendary';
    case 'platinum': return 'rare';
    case 'silver': return 'uncommon';
    case 'diamond': return 'legendary';
    case 'bronze':
    default: return 'common';
  }
}

/* ─── Types ─── */
interface AchievementEntry {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  icon: string;
  tier: string;
  criteria?: Record<string, unknown>;
  earned: boolean;
  earnedAt?: string;
  context?: Record<string, unknown>;
}

interface AchievementShowcaseProps {
  playerId: string;
  division: string;
  /** Earned achievements from the player-achievements API */
  achievements: AchievementEntry[];
  /** All available achievements (includes locked ones) from the API */
  availableAchievements?: AchievementEntry[];
  /** Stats: { total, earned, remaining } */
  stats?: { total: number; earned: number; remaining: number };
  /** Player's totalWins for progress computation */
  totalWins?: number;
  /** Player's totalMvp for progress computation */
  totalMvp?: number;
  /** Player's points for progress computation */
  points?: number;
  /** Player's matches for progress computation */
  matches?: number;
}

/* ─── Progress computation from criteria ─── */
function computeProgress(
  criteria: Record<string, unknown> | undefined,
  stats: { totalWins: number; totalMvp: number; points: number; matches: number }
): { current: number; target: number } | null {
  if (!criteria || !criteria.type) return null;

  switch (criteria.type) {
    case 'wins':
      return { current: stats.totalWins, target: (criteria.count as number) || 1 };
    case 'top3_count':
      return { current: stats.totalWins, target: (criteria.count as number) || 5 };
    case 'participations':
      return { current: stats.matches, target: (criteria.count as number) || 10 };
    case 'mvp_count':
      return { current: stats.totalMvp, target: (criteria.count as number) || 1 };
    case 'mvp_streak':
      return { current: stats.totalMvp, target: (criteria.count as number) || 2 };
    case 'points':
      return { current: stats.points, target: (criteria.threshold as number) || 100 };
    default:
      return null;
  }
}

/* ─── Format date to Indonesian ─── */
function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

/* ─── Single Achievement Card ─── */
function AchievementCard({
  achievement,
  isEarned,
  earnedAt,
  progress,
  index,
  division,
}: {
  achievement: AchievementEntry;
  isEarned: boolean;
  earnedAt?: string;
  progress: { current: number; target: number } | null;
  index: number;
  division: string;
}) {
  const dt = getDivisionTheme(division as 'male' | 'female');
  const rarity = tierToRarity(achievement.tier);
  const rarityConfig = RARITY_CONFIG[rarity];
  const progressPercent = progress ? Math.min(100, Math.round((progress.current / progress.target) * 100)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={cn(
        'group relative rounded-xl p-3 transition-all duration-300 border',
        isEarned
          ? cn('bg-background hover:scale-[1.02]', rarityConfig.border, `hover:${rarityConfig.glow}`)
          : 'bg-muted/5 border-border/10 opacity-50 grayscale hover:opacity-70'
      )}
    >
      {/* Glow overlay for earned legendary */}
      {isEarned && rarity === 'legendary' && (
        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-br from-idm-gold-warm/5 via-transparent to-idm-gold-warm/5" />
          <motion.div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: `radial-gradient(circle at 50% 50%, rgba(251,191,36,0.08) 0%, transparent 70%)`,
            }}
          />
        </div>
      )}

      <div className="relative z-10 flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all',
          isEarned
            ? cn(rarityConfig.bg, 'border', rarityConfig.border)
            : 'bg-muted/20 border border-border/15'
        )}>
          {isEarned ? (
            <span>{achievement.icon || '🏆'}</span>
          ) : (
            <Lock className="w-4 h-4 text-muted-foreground/40" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={cn(
              'text-xs font-semibold truncate',
              isEarned ? 'text-foreground' : 'text-muted-foreground/60'
            )}>
              {isEarned ? achievement.displayName : '???'}
            </span>
            {/* Rarity badge */}
            {isEarned && (
              <span className={cn(
                'text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full',
                rarityConfig.bg, rarityConfig.text
              )}>
                {rarityConfig.label}
              </span>
            )}
          </div>

          <p className={cn(
            'text-[10px] leading-relaxed line-clamp-2',
            isEarned ? 'text-muted-foreground' : 'text-muted-foreground/40'
          )}>
            {isEarned ? achievement.description : 'Belum terbuka'}
          </p>

          {/* Earned date */}
          {isEarned && earnedAt && (
            <div className="flex items-center gap-1 mt-1">
              <Calendar className="w-2.5 h-2.5 text-muted-foreground/40" />
              <span className="text-[9px] text-muted-foreground/50">{formatDate(earnedAt)}</span>
            </div>
          )}

          {/* Progress bar for locked achievements */}
          {!isEarned && progress && progress.target > 0 && (
            <div className="mt-1.5">
              <div className="flex items-center justify-between text-[9px] mb-0.5">
                <span className="text-muted-foreground/50">{progress.current}/{progress.target}</span>
                <span className={cn('font-bold', rarityConfig.text)}>{progressPercent}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden">
                <motion.div
                  className={cn('h-full rounded-full', rarityConfig.bg.replace('/10', '/40'))}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.8, delay: index * 0.04, ease: 'easeOut' }}
                  style={{ backgroundColor: rarityConfig.color + '66' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Featured Achievement (large display) ─── */
function FeaturedAchievement({
  achievement,
  earnedAt,
  division,
  index,
}: {
  achievement: AchievementEntry;
  earnedAt?: string;
  division: string;
  index: number;
}) {
  const dt = getDivisionTheme(division as 'male' | 'female');
  const rarity = tierToRarity(achievement.tier);
  const rarityConfig = RARITY_CONFIG[rarity];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1, duration: 0.4, type: 'spring', stiffness: 200 }}
      className={cn(
        'relative rounded-2xl p-4 border overflow-hidden group',
        rarityConfig.border,
        rarity === 'legendary' ? 'bg-gradient-to-br from-idm-gold-warm/5 via-background to-idm-gold-warm/5' : rarityConfig.bg
      )}
    >
      {/* Animated glow for legendary */}
      {rarity === 'legendary' && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <motion.div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 30% 20%, rgba(251,191,36,0.1) 0%, transparent 50%),
                           radial-gradient(ellipse at 70% 80%, rgba(251,191,36,0.06) 0%, transparent 50%)`,
            }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Traveling sparkle */}
          <motion.div
            className="absolute"
            style={{
              width: '40%', height: '2px', top: 0, left: 0,
              background: `linear-gradient(90deg, transparent, rgba(251,191,36,0.5), transparent)`,
            }}
            animate={{ x: ['-120%', '320%'] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear', delay: index * 0.5 }}
          />
        </div>
      )}

      <div className="relative z-10 text-center">
        {/* Large icon */}
        <div className={cn(
          'w-14 h-14 rounded-2xl mx-auto mb-2 flex items-center justify-center text-2xl border',
          rarityConfig.bg, rarityConfig.border,
          rarity === 'legendary' ? 'shadow-lg shadow-idm-gold-warm/20' : ''
        )}>
          <span>{achievement.icon || '🏆'}</span>
        </div>

        <h4 className="text-sm font-bold mb-0.5">{achievement.displayName}</h4>
        <p className="text-[10px] text-muted-foreground line-clamp-2 mb-1.5">{achievement.description}</p>

        {/* Rarity + Date */}
        <div className="flex items-center justify-center gap-2">
          <span className={cn(
            'text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full',
            rarityConfig.bg, rarityConfig.text
          )}>
            {rarityConfig.label}
          </span>
          {earnedAt && (
            <span className="text-[9px] text-muted-foreground/50">{formatDate(earnedAt)}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT: AchievementShowcase
   ═══════════════════════════════════════════════════════════ */
export function AchievementShowcase({
  playerId,
  division,
  achievements,
  availableAchievements,
  stats,
  totalWins = 0,
  totalMvp = 0,
  points = 0,
  matches = 0,
}: AchievementShowcaseProps) {
  const dt = getDivisionTheme(division as 'male' | 'female');
  const [showLocked, setShowLocked] = useState(false);

  // Earned achievements with their details
  const earnedMap = new Map<string, { earnedAt?: string; context?: Record<string, unknown> }>();
  for (const a of achievements) {
    earnedMap.set(a.id, { earnedAt: a.earnedAt, context: a.context });
  }

  // Build full list: all available achievements with earned status
  const allAchievements: Array<AchievementEntry & { earnedAt?: string; earned: boolean }> = availableAchievements
    ? availableAchievements.map(a => ({
        ...a,
        earned: earnedMap.has(a.id),
        earnedAt: earnedMap.get(a.id)?.earnedAt,
      }))
    : achievements.map(a => ({ ...a, earned: true }));

  // Separate earned and locked
  const earnedList = allAchievements.filter(a => a.earned);
  const lockedList = allAchievements.filter(a => !a.earned);

  // Featured achievements: top 3 most rare/recent earned
  const featuredAchievements = earnedList
    .sort((a, b) => {
      const rarityOrder = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
      const rarityA = rarityOrder[tierToRarity(a.tier)] ?? 99;
      const rarityB = rarityOrder[tierToRarity(b.tier)] ?? 99;
      if (rarityA !== rarityB) return rarityA - rarityB;
      // Then by date (newest first)
      return (b.earnedAt || '').localeCompare(a.earnedAt || '');
    })
    .slice(0, 3);

  // Stats
  const total = stats?.total ?? allAchievements.length;
  const earned = stats?.earned ?? earnedList.length;
  const completionPercent = total > 0 ? Math.round((earned / total) * 100) : 0;

  // Category counts
  const categoryCounts: Record<string, { earned: number; total: number }> = {};
  for (const a of allAchievements) {
    const cat = a.category || 'other';
    if (!categoryCounts[cat]) categoryCounts[cat] = { earned: 0, total: 0 };
    categoryCounts[cat].total++;
    if (a.earned) categoryCounts[cat].earned++;
  }

  const categoryLabels: Record<string, string> = {
    tournament: '⚔️ Turnamen',
    mvp: '⭐ MVP',
    points: '📊 Poin',
    club: '🛡️ Klub',
    other: '🎯 Lainnya',
  };

  const playerStats = { totalWins, totalMvp, points, matches };

  // Sort for display: earned first (by rarity then date), then locked
  const displayList = [
    ...earnedList.sort((a, b) => {
      const rarityOrder = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
      const rarityA = rarityOrder[tierToRarity(a.tier)] ?? 99;
      const rarityB = rarityOrder[tierToRarity(b.tier)] ?? 99;
      if (rarityA !== rarityB) return rarityA - rarityB;
      return (b.earnedAt || '').localeCompare(a.earnedAt || '');
    }),
    ...(showLocked ? lockedList : []),
  ];

  return (
    <div className="mb-4">
      {/* ─── Header with Stats ─── */}
      <div className="flex items-center gap-2 mb-3">
        <Award className={cn('w-4 h-4', dt.text)} />
        <h3 className="text-sm font-semibold">Prestasi</h3>
        <div className="ml-auto flex items-center gap-2">
          <Badge className={cn(dt.casinoBadge, 'text-[8px]')}>
            {earned}/{total}
          </Badge>
          {completionPercent > 0 && (
            <Badge className="bg-idm-gold-warm/15 text-idm-gold-warm text-[8px] border-0">
              {completionPercent}%
            </Badge>
          )}
        </div>
      </div>

      {/* ─── Completion Progress Bar ─── */}
      {total > 0 && (
        <div className="mb-4">
          <div className="h-2 rounded-full bg-muted/20 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-idm-gold-warm/80 to-idm-gold-warm"
              initial={{ width: 0 }}
              animate={{ width: `${completionPercent}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[9px] text-muted-foreground/50">
              {earned} terbuka dari {total} prestasi
            </span>
            {completionPercent === 100 && (
              <span className="text-[9px] text-idm-gold-warm font-bold flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> Lengkap!
              </span>
            )}
          </div>
        </div>
      )}

      {/* ─── Featured Achievements (top 3 rare/recent) ─── */}
      {featuredAchievements.length > 0 && (
        <div className="mb-4">
          <div className="grid grid-cols-3 gap-2">
            {featuredAchievements.map((a, i) => (
              <FeaturedAchievement
                key={a.id}
                achievement={a}
                earnedAt={a.earnedAt}
                division={division}
                index={i}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── Category Breakdown ─── */}
      {Object.keys(categoryCounts).length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {Object.entries(categoryCounts).map(([cat, counts]) => (
            <div
              key={cat}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/10 border border-border/10"
            >
              <span className="text-[9px] font-medium text-muted-foreground">
                {categoryLabels[cat] || cat}
              </span>
              <span className={cn(
                'text-[9px] font-bold',
                counts.earned === counts.total ? 'text-idm-gold-warm' : 'text-muted-foreground/60'
              )}>
                {counts.earned}/{counts.total}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ─── Achievement Grid ─── */}
      <div className={cn(
        'rounded-2xl border',
        dt.borderSubtle,
        'overflow-hidden'
      )}>
        <div className={cn('p-3', dt.bgSubtle)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {displayList.map((a, i) => (
              <AchievementCard
                key={a.id}
                achievement={a}
                isEarned={a.earned}
                earnedAt={a.earnedAt}
                progress={a.earned ? null : computeProgress(a.criteria as Record<string, unknown>, playerStats)}
                index={i}
                division={division}
              />
            ))}
          </div>

          {/* Empty state */}
          {displayList.length === 0 && (
            <div className="text-center py-6">
              <Award className={cn('w-8 h-8 mx-auto mb-2 opacity-30', dt.text)} />
              <p className="text-xs text-muted-foreground">Belum ada prestasi terbuka</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Mainkan turnamen untuk mendapatkan achievement!</p>
            </div>
          )}
        </div>

        {/* Toggle locked achievements */}
        {lockedList.length > 0 && (
          <button
            onClick={() => setShowLocked(!showLocked)}
            className={cn(
              'w-full flex items-center justify-center gap-1.5 py-2 text-[10px] font-medium transition-colors',
              'border-t', dt.borderSubtle,
              'hover:bg-muted/5',
              showLocked ? dt.text : 'text-muted-foreground/50'
            )}
          >
            {showLocked ? (
              <>
                Sembunyikan terkunci
                <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                {lockedList.length} prestasi terkunci
                <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Inline Achievement Badges (for next to gamertag) ─── */
export function AchievementBadgesInline({
  achievements,
  maxShow = 3,
}: {
  achievements: AchievementEntry[];
  maxShow?: number;
}) {
  if (!achievements || achievements.length === 0) return null;

  // Sort by rarity (legendary first) then by date
  const sorted = [...achievements].sort((a, b) => {
    const rarityOrder = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
    const rarityA = rarityOrder[tierToRarity(a.tier)] ?? 99;
    const rarityB = rarityOrder[tierToRarity(b.tier)] ?? 99;
    return rarityA - rarityB;
  });

  const display = sorted.slice(0, maxShow);
  const remaining = sorted.length - maxShow;

  return (
    <div className="flex items-center gap-0.5">
      {display.map(a => {
        const rarity = tierToRarity(a.tier);
        const rarityConfig = RARITY_CONFIG[rarity];
        return (
          <motion.span
            key={a.id}
            className={cn(
              'inline-flex items-center justify-center w-6 h-6 rounded-md text-xs border transition-transform hover:scale-110',
              rarityConfig.bg,
              rarityConfig.border
            )}
            title={a.displayName}
            whileHover={{ scale: 1.2 }}
          >
            {a.icon || '🏆'}
          </motion.span>
        );
      })}
      {remaining > 0 && (
        <span className="text-[9px] text-muted-foreground/50 ml-0.5">+{remaining}</span>
      )}
    </div>
  );
}
