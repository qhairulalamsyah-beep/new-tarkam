'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Copy, Share2, RefreshCw, Gift, Users, Star, Crown,
  Trophy, Check, Loader2, ExternalLink, MessageCircle, Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useReferralStats, generateReferralCode } from '@/lib/hooks';
import { useAppStore } from '@/lib/store';

// Reward tiers definition
const REWARD_TIERS = [
  { name: 'Starter', required: 1, points: 50, badge: null, icon: '🎯', description: '1 referral = 50 bonus points' },
  { name: 'Networker', required: 3, points: 150, badge: 'Networker', icon: '🤝', description: '3 referrals = 150 bonus points + "Networker" badge' },
  { name: 'Influencer', required: 5, points: 300, badge: 'Influencer', icon: '📢', description: '5 referrals = 300 bonus points + "Influencer" badge' },
  { name: 'Legend', required: 10, points: 500, badge: 'Legend', icon: '👑', description: '10 referrals = 500 bonus points + "Legend" badge + custom skin' },
];

export function ReferralSection() {
  const queryClient = useQueryClient();
  const playerAuth = useAppStore(s => s.playerAuth);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const { data: stats, isLoading, error } = useReferralStats({
    enabled: playerAuth.isAuthenticated,
  });

  const generateMutation = useMutation({
    mutationFn: generateReferralCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referral-stats'] });
      queryClient.invalidateQueries({ queryKey: ['referral-code'] });
      toast.success('Kode referral baru berhasil dibuat!');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Gagal membuat kode referral');
    },
  });

  if (!playerAuth.isAuthenticated) {
    return (
      <div className="p-4 rounded-2xl bg-idm-gold-warm/5 border border-idm-gold-warm/20">
        <div className="flex items-center gap-2 mb-2">
          <Gift className="w-4 h-4 text-idm-gold-warm" />
          <span className="text-sm font-semibold">Ajak Teman, Dapat Poin!</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Login untuk mendapatkan kode referral dan ajak teman bergabung. Setiap teman yang mendaftar lewat kode kamu = bonus poin!
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-40 animate-pulse bg-muted/20 rounded-lg" />
        <div className="h-20 animate-pulse bg-muted/20 rounded-2xl" />
        <div className="h-32 animate-pulse bg-muted/20 rounded-2xl" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20 text-center">
        <p className="text-xs text-red-400">Gagal memuat data referral</p>
      </div>
    );
  }

  const referralCode = stats.code;
  const referralLink = referralCode ? `https://tarkam.idm.fun/?ref=${referralCode}` : '';
  const registered = stats.stats?.registered || 0;
  const currentTierIndex = REWARD_TIERS.findIndex(t => t.required <= registered);
  const highestTier = currentTierIndex >= 0 ? REWARD_TIERS[currentTierIndex] : null;
  const nextTier = stats.nextTier;

  const handleCopyCode = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopiedCode(true);
      toast.success('Kode referral disalin!');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error('Gagal menyalin kode');
    }
  };

  const handleCopyLink = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
      toast.success('Link referral disalin!');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error('Gagal menyalin link');
    }
  };

  const handleShareWhatsApp = () => {
    if (!referralLink) return;
    const text = `🎮 Main Tarkam IDM bareng aku! Daftar pakai kode referral aku: ${referralCode}\n\n${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareTelegram = () => {
    if (!referralLink) return;
    const text = `🎮 Main Tarkam IDM bareng aku! Daftar pakai kode referral aku: ${referralCode}`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleGenerateNew = () => {
    generateMutation.mutate();
  };

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <Gift className="w-4 h-4 text-idm-gold-warm" />
        <span className="text-sm font-semibold">Ajak Teman, Dapat Poin!</span>
        {highestTier && (
          <Badge className="ml-auto bg-idm-gold-warm/20 text-idm-gold-warm text-[9px] border-0">
            {highestTier.icon} {highestTier.name}
          </Badge>
        )}
      </div>

      {/* ═══ Referral Code Card ═══ */}
      <div className="relative p-4 rounded-2xl bg-gradient-to-br from-idm-gold-warm/10 via-idm-gold-warm/5 to-transparent border border-idm-gold-warm/20 overflow-hidden">
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-idm-gold-warm/5 rounded-full -translate-y-8 translate-x-8" />
        <div className="absolute bottom-0 left-0 w-16 h-16 bg-idm-gold-warm/3 rounded-full translate-y-4 -translate-x-4" />

        <div className="relative z-10">
          <p className="text-[10px] text-idm-gold-warm/70 font-semibold uppercase tracking-widest mb-2">Kode Referral Kamu</p>
          {referralCode ? (
            <div className="flex items-center gap-2 mb-3">
              <code className="text-xl sm:text-2xl font-black tracking-wider text-idm-gold-warm drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]">
                {referralCode}
              </code>
            </div>
          ) : (
            <div className="mb-3">
              <p className="text-sm text-muted-foreground">Belum ada kode referral</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={handleCopyCode}
              disabled={!referralCode}
              className="h-8 text-xs bg-idm-gold-warm hover:bg-idm-gold-warm/90 text-background font-bold"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copiedCode ? 'Disalin!' : 'Salin Kode'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyLink}
              disabled={!referralLink}
              className="h-8 text-xs border-idm-gold-warm/30 text-idm-gold-warm hover:bg-idm-gold-warm/10"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 mr-1" /> : <ExternalLink className="w-3.5 h-3.5 mr-1" />}
              {copiedLink ? 'Disalin!' : 'Salin Link'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateNew}
              disabled={generateMutation.isPending}
              className="h-8 text-xs border-border/30 text-muted-foreground hover:text-foreground"
            >
              {generateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
              Kode Baru
            </Button>
          </div>
        </div>
      </div>

      {/* ═══ Share Buttons ═══ */}
      {referralLink && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Bagikan:</span>
          <Button
            size="sm"
            variant="outline"
            onClick={handleShareWhatsApp}
            className="h-7 text-[10px] border-green-500/30 text-green-500 hover:bg-green-500/10"
          >
            <MessageCircle className="w-3 h-3 mr-1" />
            WhatsApp
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleShareTelegram}
            className="h-7 text-[10px] border-sky-500/30 text-sky-500 hover:bg-sky-500/10"
          >
            <Send className="w-3 h-3 mr-1" />
            Telegram
          </Button>
        </div>
      )}

      {/* ═══ Stats Dashboard ═══ */}
      <div className="grid grid-cols-4 gap-2">
        <div className="p-2.5 rounded-xl bg-muted/5 border border-border/10 text-center">
          <p className="text-lg font-black text-idm-gold-warm">{stats.stats?.total || 0}</p>
          <p className="text-[8px] text-muted-foreground uppercase tracking-widest font-semibold">Total</p>
        </div>
        <div className="p-2.5 rounded-xl bg-green-500/5 border border-green-500/10 text-center">
          <p className="text-lg font-black text-green-500">{stats.stats?.registered || 0}</p>
          <p className="text-[8px] text-muted-foreground uppercase tracking-widest font-semibold">Sukses</p>
        </div>
        <div className="p-2.5 rounded-xl bg-yellow-500/5 border border-yellow-500/10 text-center">
          <p className="text-lg font-black text-yellow-500">{stats.stats?.pending || 0}</p>
          <p className="text-[8px] text-muted-foreground uppercase tracking-widest font-semibold">Pending</p>
        </div>
        <div className="p-2.5 rounded-xl bg-idm-gold-warm/5 border border-idm-gold-warm/10 text-center">
          <p className="text-lg font-black text-idm-gold-warm">{stats.stats?.pointsEarned || 0}</p>
          <p className="text-[8px] text-muted-foreground uppercase tracking-widest font-semibold">Poin</p>
        </div>
      </div>

      {/* ═══ Progress to Next Reward Tier ═══ */}
      {nextTier && (
        <div className="p-3 rounded-2xl bg-idm-gold-warm/5 border border-idm-gold-warm/15">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">{nextTier.icon || '🎯'}</span>
              <span className="text-xs font-semibold text-idm-gold-warm">Menuju {nextTier.name}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {registered}/{nextTier.required} referral
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-muted/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-idm-gold-warm to-yellow-300 transition-all duration-700"
              style={{ width: `${Math.min(100, (registered / nextTier.required) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            {nextTier.required - registered > 0
              ? `Ajak ${nextTier.required - registered} teman lagi untuk mendapat bonus ${nextTier.points} poin${nextTier.badge ? ` + badge "${nextTier.badge}"` : ''}!`
              : 'Tier tercapai! 🎉'
            }
          </p>
        </div>
      )}

      {/* ═══ Reward Tiers ═══ */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Tier Hadiah</p>
        {REWARD_TIERS.map((tier) => {
          const achieved = registered >= tier.required;
          return (
            <div
              key={tier.name}
              className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                achieved
                  ? 'bg-idm-gold-warm/10 border-idm-gold-warm/30'
                  : 'bg-muted/5 border-border/10 opacity-60'
              }`}
            >
              <span className="text-lg">{tier.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold ${achieved ? 'text-idm-gold-warm' : 'text-muted-foreground'}`}>
                    {tier.name}
                  </span>
                  {achieved && <Check className="w-3 h-3 text-idm-gold-warm" />}
                  {tier.badge && achieved && (
                    <Badge className="bg-idm-gold-warm/20 text-idm-gold-warm text-[8px] border-0 h-4 px-1.5">
                      {tier.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{tier.description}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-xs font-black ${achieved ? 'text-idm-gold-warm' : 'text-muted-foreground/50'}`}>
                  +{tier.points}
                </p>
                <p className="text-[8px] text-muted-foreground">pts</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ Referral List ═══ */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">
          Teman yang Diajak ({stats.referrals?.length || 0})
        </p>
        {(!stats.referrals || stats.referrals.length === 0) ? (
          <div className="p-4 rounded-xl bg-muted/5 border border-border/10 text-center">
            <Users className="w-5 h-5 text-muted-foreground/30 mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">Belum ada teman yang diajak</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">Bagikan kode referral kamu untuk mulai mendapat poin!</p>
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
            {stats.referrals.map((ref: {
              id: string;
              status: string;
              rewardPoints: number;
              createdAt: string;
              referredUser: { gamertag: string; avatar: string | null; division: string; tier: string } | null;
              referredEmail: string | null;
            }) => (
              <div
                key={ref.id}
                className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/5 border border-border/5"
              >
                {/* Status indicator */}
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  ref.status === 'pending' ? 'bg-yellow-500' :
                  ref.status === 'registered' ? 'bg-green-500' :
                  ref.status === 'rewarded' ? 'bg-idm-gold-warm' :
                  'bg-muted-foreground'
                }`} />

                {/* User info */}
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold truncate block">
                    {ref.referredUser?.gamertag || ref.referredEmail || 'Menunggu...'}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    {ref.status === 'pending' ? 'Menunggu registrasi' :
                     ref.status === 'registered' ? 'Terdaftar' :
                     ref.status === 'rewarded' ? 'Bonus dikasih' :
                     ref.status}
                  </span>
                </div>

                {/* Points earned */}
                {ref.rewardPoints > 0 && (
                  <Badge className="bg-idm-gold-warm/15 text-idm-gold-warm text-[9px] border-0 h-5 px-1.5 font-bold">
                    +{ref.rewardPoints}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
