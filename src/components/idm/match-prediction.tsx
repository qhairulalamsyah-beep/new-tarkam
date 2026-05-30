'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { useMyPredictions, useMatchPredictionStats } from '@/lib/hooks';
import { submitPrediction } from '@/lib/queries/misc';
import { useQueryClient } from '@tanstack/react-query';
import { Target, Check, X, Loader2, Users, TrendingUp, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Division config ─── */
const DIVISION_STYLE = {
  male: {
    color: '#2E9FFF',
    bg: 'bg-idm-male/10',
    text: 'text-idm-male',
    border: 'border-idm-male/30',
    borderSelected: 'border-idm-male',
    bgSelected: 'bg-idm-male/15',
    ring: 'ring-idm-male/50',
  },
  female: {
    color: '#FF2D78',
    bg: 'bg-idm-female/10',
    text: 'text-idm-female',
    border: 'border-idm-female/30',
    borderSelected: 'border-idm-female',
    bgSelected: 'bg-idm-female/15',
    ring: 'ring-idm-female/50',
  },
} as const;

interface MatchPredictionProps {
  matchId: string;
  team1: { id: string; name: string } | null;
  team2: { id: string; name: string } | null;
  matchStatus: string; // 'pending' | 'ready' | 'live' | 'completed'
  winnerId?: string | null;
  division?: string; // 'male' | 'female'
  compact?: boolean; // compact mode for inline in match rows
}

export function MatchPrediction({
  matchId,
  team1,
  team2,
  matchStatus,
  winnerId,
  division = 'male',
  compact = false,
}: MatchPredictionProps) {
  const queryClient = useQueryClient();
  const playerAuth = useAppStore(s => s.playerAuth);
  const divStyle = DIVISION_STYLE[division as keyof typeof DIVISION_STYLE] || DIVISION_STYLE.male;

  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get user's prediction for this match
  const { data: myPredictions } = useMyPredictions(matchId, {
    enabled: !!playerAuth.isAuthenticated && !!matchId,
  });

  // Get community prediction stats
  const { data: stats } = useMatchPredictionStats(matchId, {
    enabled: !!matchId,
  });

  const myPrediction = myPredictions?.predictions?.[0] || null;
  const hasPredicted = !!myPrediction;
  const canPredict = !hasPredicted && (matchStatus === 'pending' || matchStatus === 'ready');
  const isCompleted = matchStatus === 'completed';
  const isLive = matchStatus === 'live';

  // Community split
  const team1Pct = stats?.team1?.percentage ?? 50;
  const team2Pct = stats?.team2?.percentage ?? 50;
  const totalPredictions = stats?.total ?? 0;

  // Handle prediction submission
  const handleSubmit = async () => {
    if (!selectedTeam || !playerAuth.isAuthenticated) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitPrediction({ matchId, predictedWinnerId: selectedTeam });
      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: ['my-predictions'] });
      queryClient.invalidateQueries({ queryKey: ['match-prediction-stats', matchId] });
    } catch (err: any) {
      setError(err.message || 'Gagal submit prediksi');
    } finally {
      setSubmitting(false);
    }
  };

  // Don't show prediction if both teams aren't set
  if (!team1 || !team2) return null;

  // ─── Compact mode (for inline use in match rows) ───
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-2 py-1">
        <Sparkles className="w-3 h-3 text-idm-gold-warm/60" />
        {hasPredicted && (
          <span className="text-[9px] text-idm-gold-warm/70 flex items-center gap-0.5">
            <Check className="w-2.5 h-2.5" />
            {team1.id === myPrediction.predictedWinnerId ? team1.name.slice(0, 6) : team2.name.slice(0, 6)}
          </span>
        )}
        {isCompleted && hasPredicted && (
          <span className={`text-[9px] flex items-center gap-0.5 ${myPrediction.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
            {myPrediction.isCorrect ? <><Check className="w-2.5 h-2.5" /> +{myPrediction.pointsEarned}p</> : <><X className="w-2.5 h-2.5" /></>}
          </span>
        )}
        {totalPredictions > 0 && (
          <span className="text-[8px] text-muted-foreground/50">{totalPredictions} prediksi</span>
        )}
      </div>
    );
  }

  // ─── Full prediction card ───
  return (
    <div className="casino-card casino-card-community rounded-xl overflow-hidden">
      {/* Neon accent bar */}
      <div className="casino-card-bar-community" />

      <div className="relative z-10 p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-idm-gold-warm/10 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-idm-gold-warm" />
            </div>
            <span className="text-xs font-bold text-idm-gold-warm uppercase tracking-wider">Prediksi</span>
          </div>
          {totalPredictions > 0 && (
            <div className="flex items-center gap-1.5">
              <Users className="w-3 h-3 text-muted-foreground/60" />
              <span className="text-[10px] text-muted-foreground">{totalPredictions} prediksi</span>
            </div>
          )}
        </div>

        {/* Login required message */}
        {!playerAuth.isAuthenticated && canPredict && (
          <div className="text-center py-3 px-4 rounded-lg bg-muted/10 border border-border/10">
            <p className="text-[11px] text-muted-foreground">Login untuk memprediksi match ini</p>
          </div>
        )}

        {/* Team selection cards — only show when user can predict */}
        {playerAuth.isAuthenticated && canPredict && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {/* Team 1 */}
              <button
                onClick={() => setSelectedTeam(team1.id)}
                className={`relative p-3 rounded-lg border-2 transition-all duration-200 text-center cursor-pointer ${
                  selectedTeam === team1.id
                    ? `${divStyle.borderSelected} ${divStyle.bgSelected} ring-2 ${divStyle.ring} shadow-sm`
                    : `border-border/20 bg-muted/5 hover:border-border/40 hover:bg-muted/10`
                }`}
                aria-label={`Prediksi ${team1.name} menang`}
              >
                {selectedTeam === team1.id && (
                  <motion.div
                    className="absolute top-1.5 right-1.5"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <div className="w-4 h-4 rounded-full bg-idm-gold-warm flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-stone-900" />
                    </div>
                  </motion.div>
                )}
                <span className="text-sm font-bold truncate block">{team1.name}</span>
              </button>

              {/* Team 2 */}
              <button
                onClick={() => setSelectedTeam(team2.id)}
                className={`relative p-3 rounded-lg border-2 transition-all duration-200 text-center cursor-pointer ${
                  selectedTeam === team2.id
                    ? `${divStyle.borderSelected} ${divStyle.bgSelected} ring-2 ${divStyle.ring} shadow-sm`
                    : `border-border/20 bg-muted/5 hover:border-border/40 hover:bg-muted/10`
                }`}
                aria-label={`Prediksi ${team2.name} menang`}
              >
                {selectedTeam === team2.id && (
                  <motion.div
                    className="absolute top-1.5 right-1.5"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <div className="w-4 h-4 rounded-full bg-idm-gold-warm flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-stone-900" />
                    </div>
                  </motion.div>
                )}
                <span className="text-sm font-bold truncate block">{team2.name}</span>
              </button>
            </div>

            {/* Submit button */}
            <AnimatePresence>
              {selectedTeam && (
                <motion.button
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-2.5 rounded-lg bg-idm-gold-warm text-stone-900 text-sm font-bold transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Mengirim...</>
                  ) : (
                    <><Target className="w-4 h-4" /> Submit Prediksi</>
                  )}
                </motion.button>
              )}
            </AnimatePresence>

            {/* Error message */}
            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[11px] text-red-400 text-center"
              >
                {error}
              </motion.p>
            )}
          </div>
        )}

        {/* User's existing prediction — show after submitting */}
        {hasPredicted && !isCompleted && (
          <div className={`p-3 rounded-lg ${divStyle.bg} border ${divStyle.border} flex items-center gap-2`}>
            <div className="w-5 h-5 rounded-full bg-idm-gold-warm/20 flex items-center justify-center shrink-0">
              <Check className="w-3 h-3 text-idm-gold-warm" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground">Prediksi kamu</p>
              <p className={`text-sm font-bold ${divStyle.text} truncate`}>
                {myPrediction.predictedWinnerId === team1.id ? team1.name : team2.name}
              </p>
            </div>
            <Badge className="bg-idm-gold-warm/10 text-idm-gold-warm text-[8px] border-0">
              {isLive ? 'Menunggu hasil...' : 'Terkirim'}
            </Badge>
          </div>
        )}

        {/* Result reveal — show after match is completed */}
        {hasPredicted && isCompleted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={`p-3 rounded-lg border-2 ${
              myPrediction.isCorrect
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                myPrediction.isCorrect ? 'bg-green-500/20' : 'bg-red-500/20'
              }`}>
                {myPrediction.isCorrect ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <X className="w-4 h-4 text-red-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${myPrediction.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                  {myPrediction.isCorrect ? 'Prediksi Benar!' : 'Prediksi Salah'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Kamu pilih: {myPrediction.predictedWinnerId === team1.id ? team1.name : team2.name}
                </p>
              </div>
              {myPrediction.isCorrect && myPrediction.pointsEarned > 0 && (
                <Badge className="bg-green-500/15 text-green-400 text-[9px] border-0">
                  +{myPrediction.pointsEarned}p
                </Badge>
              )}
            </div>
          </motion.div>
        )}

        {/* Community prediction split bar */}
        {totalPredictions > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground/70 flex items-center gap-1">
                <TrendingUp className="w-2.5 h-2.5" /> Komunitas
              </span>
            </div>
            {/* Prediction bar */}
            <div className="h-2 rounded-full bg-muted/20 overflow-hidden flex">
              <div
                className="h-full rounded-l-full transition-all duration-500"
                style={{
                  width: `${team1Pct}%`,
                  background: divStyle.color,
                  opacity: 0.8,
                }}
              />
              <div
                className="h-full rounded-r-full transition-all duration-500"
                style={{
                  width: `${team2Pct}%`,
                  background: divStyle.color,
                  opacity: 0.4,
                }}
              />
            </div>
            {/* Labels */}
            <div className="flex items-center justify-between text-[9px]">
              <span className={divStyle.text}>{team1Pct}% {team1.name}</span>
              <span className={`${divStyle.text} opacity-70`}>{team2.name} {team2Pct}%</span>
            </div>
          </div>
        )}

        {/* Badge progress hint */}
        {playerAuth.isAuthenticated && !compact && (
          <div className="pt-1 border-t border-border/10">
            <p className="text-[9px] text-muted-foreground/50 text-center">
              🎯 5 benar = Ramalan Awal · 🔮 10 = Dukun Tarkam · ⭐ 25 = Oracle
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
