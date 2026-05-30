'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { usePredictionLeaderboard } from '@/lib/hooks';
import { getAvatarUrl, toStrictDivision } from '@/lib/utils';
import { AvatarMedia } from '@/components/ui/avatar-media';
import { Trophy, Target, TrendingUp, Medal, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

/* ─── Rank badge styling ─── */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-yellow-400 to-amber-600 shadow-lg shadow-amber-500/30">
        <span className="text-xs font-black text-stone-900">1</span>
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-gray-300 to-gray-500 shadow-lg shadow-gray-400/20">
        <span className="text-xs font-black text-stone-900">2</span>
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-600 to-amber-800 shadow-lg shadow-amber-600/20">
        <span className="text-xs font-black text-stone-200">3</span>
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center bg-muted/20 border border-border/20">
      <span className="text-xs font-bold text-muted-foreground">{rank}</span>
    </div>
  );
}

interface PredictionLeaderboardProps {
  limit?: number;
  className?: string;
}

export function PredictionLeaderboard({ limit = 10, className = '' }: PredictionLeaderboardProps) {
  const { data, isLoading } = usePredictionLeaderboard(limit);
  const leaderboard = data?.leaderboard || [];

  if (isLoading) {
    return (
      <div className={`casino-card casino-card-community rounded-xl overflow-hidden ${className}`}>
        <div className="casino-card-bar-community" />
        <div className="relative z-10 p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-idm-gold-warm" />
        </div>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className={`casino-card casino-card-community rounded-xl overflow-hidden ${className}`}>
        <div className="casino-card-bar-community" />
        <div className="relative z-10 p-6 text-center">
          <Target className="w-8 h-8 text-idm-gold-warm/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Belum ada prediksi yang diselesaikan</p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">Leaderboard akan muncul setelah match selesai</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`casino-card casino-card-community rounded-xl overflow-hidden ${className}`}>
      {/* Neon accent bar */}
      <div className="casino-card-bar-community" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-idm-gold-warm/10 flex items-center justify-center">
              <Trophy className="w-3 h-3 text-idm-gold-warm" />
            </div>
            <span className="text-xs font-bold text-idm-gold-warm uppercase tracking-wider">Top Prediktor</span>
          </div>
          <Badge className="bg-idm-gold-warm/10 text-idm-gold-warm text-[8px] border-0">
            {leaderboard.length} pemain
          </Badge>
        </div>

        {/* Leaderboard list */}
        <div className="max-h-96 overflow-y-auto px-2 pb-3 space-y-1" style={{ scrollbarWidth: 'thin' }}>
          {leaderboard.map((entry: any, idx: number) => (
            <motion.div
              key={entry.accountId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.03 }}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
                idx < 3 ? 'bg-idm-gold-warm/[0.03] border border-idm-gold-warm/5' : 'hover:bg-muted/10'
              }`}
            >
              {/* Rank */}
              <RankBadge rank={entry.rank} />

              {/* Avatar */}
              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                <AvatarMedia
                  src={getAvatarUrl(entry.gamertag, toStrictDivision(entry.division), entry.avatar)}
                  alt={entry.gamertag}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>

              {/* Name & Stats */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold truncate">{entry.gamertag}</span>
                  {entry.division && (
                    <span className={`text-[8px] px-1 py-0 rounded ${
                      entry.division === 'male' ? 'bg-idm-male/10 text-idm-male' : 'bg-idm-female/10 text-idm-female'
                    }`}>
                      {entry.division === 'male' ? '♂' : '♀'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{entry.correct}/{entry.total} benar</span>
                  <span className="text-muted-foreground/30">·</span>
                  <span className="flex items-center gap-0.5">
                    <TrendingUp className="w-2.5 h-2.5" />
                    {entry.accuracy}%
                  </span>
                </div>
              </div>

              {/* Points */}
              <div className="text-right shrink-0">
                <div className="flex items-center gap-1">
                  <Medal className="w-3 h-3 text-idm-gold-warm/60" />
                  <span className="text-sm font-bold text-idm-gold-warm">{entry.points}</span>
                </div>
                <p className="text-[8px] text-muted-foreground/50">poin</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Badge progress hint */}
        <div className="px-4 pb-3 pt-1 border-t border-border/10">
          <p className="text-[9px] text-muted-foreground/50 text-center">
            🎯 5 benar = Ramalan Awal · 🔮 10 = Dukun Tarkam · ⭐ 25 = Oracle
          </p>
        </div>
      </div>
    </div>
  );
}
