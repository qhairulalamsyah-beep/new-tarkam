'use client';

import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReactions } from '@/lib/hooks';
import { toggleReaction } from '@/lib/queries/misc';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
import { MessageCircle } from 'lucide-react';

/* ─── Reaction Types Config ─── */
const REACTION_CONFIG = [
  { type: 'fire',  emoji: '🔥', label: 'Fire' },
  { type: 'heart', emoji: '❤️', label: 'Love' },
  { type: 'clap',  emoji: '👏', label: 'Clap' },
  { type: 'laugh', emoji: '😂', label: 'Haha' },
  { type: 'shock', emoji: '😱', label: 'Shock' },
  { type: 'trophy', emoji: '🏆', label: 'GG' },
] as const;

/* ─── Props ─── */
export interface ReactionsBarProps {
  targetType: string;
  targetId: string;
  /** Compact mode: just emoji + count, no background pills */
  compact?: boolean;
  /** Show comment count icon alongside reactions */
  commentCount?: number;
  /** Optional className */
  className?: string;
}

/* ─── Single Reaction Button ─── */
function ReactionButton({
  emoji,
  label,
  count,
  isActive,
  compact,
  onClick,
  isToggling,
}: {
  emoji: string;
  label: string;
  count: number;
  isActive: boolean;
  compact?: boolean;
  onClick: () => void;
  isToggling: boolean;
}) {
  if (compact) {
    return (
      <button
        onClick={onClick}
        disabled={isToggling}
        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-xs transition-all duration-200 ${
          isActive
            ? 'bg-idm-gold-warm/15 text-idm-gold-warm'
            : 'text-muted-foreground hover:bg-muted/20'
        } ${isToggling ? 'opacity-50' : ''}`}
        title={label}
        aria-label={`${label} reaction${count > 0 ? ` (${count})` : ''}`}
        aria-pressed={isActive}
      >
        <span className="text-sm">{emoji}</span>
        {count > 0 && (
          <span className="text-[10px] font-semibold tabular-nums">{count}</span>
        )}
      </button>
    );
  }

  return (
    <motion.button
      onClick={onClick}
      disabled={isToggling}
      className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
        isActive
          ? 'border-idm-gold-warm/30 bg-idm-gold-warm/10 shadow-[0_0_8px_rgba(239,249,35,0.08)]'
          : 'border-border/20 bg-muted/5 hover:bg-muted/15 hover:border-border/40'
      } ${isToggling ? 'opacity-50' : ''}`}
      whileTap={{ scale: 0.9 }}
      title={label}
      aria-label={`${label} reaction${count > 0 ? ` (${count})` : ''}`}
      aria-pressed={isActive}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={`${emoji}-${isActive}`}
          className="text-base"
          initial={isActive ? { scale: 0.5, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
        >
          {emoji}
        </motion.span>
      </AnimatePresence>
      {count > 0 && (
        <motion.span
          className={`text-xs font-bold tabular-nums ${isActive ? 'text-idm-gold-warm' : 'text-muted-foreground'}`}
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        >
          {count}
        </motion.span>
      )}
    </motion.button>
  );
}

/* ─── Main Component ─── */
export function ReactionsBar({ targetType, targetId, compact, commentCount, className }: ReactionsBarProps) {
  const queryClient = useQueryClient();
  const playerAuth = useAppStore(s => s.playerAuth);
  const isLoggedIn = playerAuth.isAuthenticated;

  // Fetch reactions data
  const { data: reactionsData, isLoading } = useReactions(
    { targetType, targetId },
    { enabled: !!targetId }
  );

  const counts = reactionsData?.counts || {};
  const myReactions: string[] = reactionsData?.myReactions || [];
  const totalReactions = reactionsData?.total || 0;

  // Toggle reaction handler
  const handleReact = useCallback(async (type: string) => {
    if (!isLoggedIn) return;
    try {
      await toggleReaction({ type, targetType, targetId });
      // Invalidate reactions query to refetch
      await queryClient.invalidateQueries({ queryKey: ['reactions', targetType, targetId] });
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  }, [isLoggedIn, targetType, targetId, queryClient]);

  if (compact) {
    return (
      <div className={`flex items-center gap-0.5 ${className || ''}`}>
        {REACTION_CONFIG.map(({ type, emoji, label }) => {
          const count = counts[type] || 0;
          // In compact mode, only show reactions that have counts or that the user has reacted
          if (count === 0 && !myReactions.includes(type)) return null;
          return (
            <ReactionButton
              key={type}
              emoji={emoji}
              label={label}
              count={count}
              isActive={myReactions.includes(type)}
              compact
              onClick={() => handleReact(type)}
              isToggling={false}
            />
          );
        })}
        {commentCount !== undefined && commentCount > 0 && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-xs text-muted-foreground ml-0.5">
            <MessageCircle className="w-3 h-3" />
            <span className="text-[10px] font-semibold tabular-nums">{commentCount}</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className || ''}`}>
      {/* Section label */}
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-idm-gold-warm/10 flex items-center justify-center shrink-0">
          <span className="text-[9px]">💬</span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reaksi</span>
        {totalReactions > 0 && (
          <span className="text-[9px] text-muted-foreground/60 ml-auto">{totalReactions} reaksi</span>
        )}
      </div>

      {/* Reaction picker row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {REACTION_CONFIG.map(({ type, emoji, label }) => (
          <ReactionButton
            key={type}
            emoji={emoji}
            label={label}
            count={counts[type] || 0}
            isActive={myReactions.includes(type)}
            onClick={() => handleReact(type)}
            isToggling={false}
          />
        ))}

        {/* Login prompt if not logged in */}
        {!isLoggedIn && (
          <span className="text-[10px] text-muted-foreground/50 ml-2">Login untuk memberi reaksi</span>
        )}
      </div>
    </div>
  );
}
