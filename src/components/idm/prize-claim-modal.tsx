'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Trophy, Phone, MessageCircle, CheckCircle2, Truck, Package, XCircle, Clock, Send } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

/* ═══════════════════════════════════════════════════════
   PRIZE CLAIM MODAL
   Modal for players to claim tournament prizes
   ═══════════════════════════════════════════════════════ */

interface PrizeInfo {
  id: string;
  label?: string;
  name?: string;
  position?: number;
  prizeAmount?: number;
  value?: number;
  pointsPerPlayer?: number;
  recipientCount?: number;
  description?: string;
  prizeType?: string;
  imageUrl?: string;
}

interface TournamentInfo {
  id: string;
  name: string;
  weekNumber: number;
  division: string;
}

interface ClaimInfo {
  id: string;
  prizeId: string;
  prizeType: string;
  tournamentId: string | null;
  status: string;
  claimMethod: string;
  contactInfo: string | null;
  notes: string | null;
  claimedAt: string;
  verifiedAt: string | null;
  completedAt: string | null;
  prize: PrizeInfo | null;
  tournament: TournamentInfo | null;
}

interface PrizeClaimModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prize: PrizeInfo;
  tournament: TournamentInfo;
  existingClaim?: ClaimInfo | null;
  playerPhone?: string | null;
  playerGamertag?: string;
}

// Status timeline config
const statusSteps = [
  { key: 'pending', label: 'Diajukan', icon: Clock, color: 'text-idm-gold-warm', bg: 'bg-idm-gold-warm/15', border: 'border-idm-gold-warm/25' },
  { key: 'verified', label: 'Diverifikasi', icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/15', border: 'border-green-500/25' },
  { key: 'processing', label: 'Diproses', icon: Package, color: 'text-blue-500', bg: 'bg-blue-500/15', border: 'border-blue-500/25' },
  { key: 'shipped', label: 'Dikirim', icon: Truck, color: 'text-sky-500', bg: 'bg-sky-500/15', border: 'border-sky-500/25' },
  { key: 'completed', label: 'Selesai', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/15', border: 'border-emerald-500/25' },
];

const statusOrder = ['pending', 'verified', 'processing', 'shipped', 'completed'];

function getStatusIndex(status: string): number {
  return statusOrder.indexOf(status);
}

function getStatusConfig(status: string) {
  return statusSteps.find(s => s.key === status) || statusSteps[0];
}

export function PrizeClaimModal({
  open,
  onOpenChange,
  prize,
  tournament,
  existingClaim,
  playerPhone,
  playerGamertag,
}: PrizeClaimModalProps) {
  const [contactInfo, setContactInfo] = useState(playerPhone || '');
  const [claimMethod, setClaimMethod] = useState<'whatsapp' | 'manual'>('whatsapp');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const qc = useQueryClient();

  const isAlreadyClaimed = !!existingClaim;
  const prizeAmount = prize.prizeAmount || prize.value || 0;
  const positionEmoji = (prize.position ?? 0) === 1 ? '🥇' : (prize.position ?? 0) === 2 ? '🥈' : (prize.position ?? 0) === 3 ? '🥉' : '🎁';
  const isMale = tournament.division === 'male';

  const handleSubmit = async () => {
    if (!contactInfo.trim()) {
      toast.error('Nomor WhatsApp wajib diisi');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/prize-claims', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prizeId: prize.id,
          prizeType: prize.name ? 'sponsored_prize' : 'tournament_prize',
          contactInfo: contactInfo.trim(),
          claimMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Gagal mengajukan klaim');
        return;
      }

      toast.success('Klaim hadiah berhasil diajukan! 🎉');
      qc.invalidateQueries({ queryKey: ['my-prize-claims'] });
      qc.invalidateQueries({ queryKey: ['prize-claims'] });
      onOpenChange(false);
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render status timeline for existing claims
  const renderTimeline = () => {
    if (!existingClaim) return null;

    const currentStatus = existingClaim.status;
    const isRejected = currentStatus === 'rejected';
    const currentIdx = getStatusIndex(currentStatus);

    return (
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-foreground">Status Klaim</h4>

        {isRejected ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <XCircle className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-500">Klaim Ditolak</p>
              {existingClaim.notes && (
                <p className="text-xs text-muted-foreground mt-0.5">{existingClaim.notes}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="relative">
            {/* Progress line background */}
            <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-border/40" />
            {/* Progress line filled */}
            <div
              className="absolute left-[11px] top-3 w-0.5 bg-idm-gold-warm transition-all duration-500"
              style={{ height: `${Math.max(0, (currentIdx / (statusOrder.length - 1)) * 100)}%` }}
            />

            <div className="space-y-3">
              {statusSteps.map((step, idx) => {
                const StepIcon = step.icon;
                const isCompleted = idx <= currentIdx;
                const isCurrent = idx === currentIdx;

                return (
                  <div key={step.key} className="flex items-center gap-3 relative">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 border transition-all ${
                      isCompleted
                        ? `${step.bg} ${step.border}`
                        : 'bg-muted/30 border-border/30'
                    } ${isCurrent ? 'ring-2 ring-offset-1 ring-offset-background ring-idm-gold-warm/30' : ''}`}>
                      <StepIcon className={`w-3 h-3 ${isCompleted ? step.color : 'text-muted-foreground/40'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${isCompleted ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                          {step.label}
                        </span>
                        {isCurrent && (
                          <Badge className="text-[8px] px-1.5 py-0 h-4 border-0 bg-idm-gold-warm/15 text-idm-gold-warm">
                            Sekarang
                          </Badge>
                        )}
                      </div>
                      {isCompleted && idx === 0 && existingClaim.claimedAt && (
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(existingClaim.claimedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      {isCompleted && idx === 1 && existingClaim.verifiedAt && (
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(existingClaim.verifiedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      {isCompleted && idx === 4 && existingClaim.completedAt && (
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(existingClaim.completedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Notes */}
        {existingClaim.notes && currentStatus !== 'rejected' && (
          <div className="p-2 rounded-lg bg-muted/20 border border-border/20">
            <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Catatan Admin:</p>
            <p className="text-xs text-foreground">{existingClaim.notes}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-idm-gold-warm" />
            Klaim Hadiah
          </DialogTitle>
          <DialogDescription>
            Ajukan klaim hadiah turnamen kamu
          </DialogDescription>
        </DialogHeader>

        {/* Prize Details Card */}
        <div className="rounded-xl border border-idm-gold-warm/20 bg-gradient-to-br from-idm-gold-warm/5 to-transparent p-4 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{positionEmoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-foreground truncate">
                {prize.label || prize.name || 'Hadiah'}
              </p>
              <p className="text-lg font-black text-idm-gold-warm">
                {formatCurrency(prizeAmount)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-base">{isMale ? '🕺' : '💃'}</span>
            <span>Tarkam {isMale ? 'Cowo' : 'Cewe'}, Week {tournament.weekNumber}</span>
          </div>
          {prize.pointsPerPlayer && prize.pointsPerPlayer > 0 && (
            <Badge variant="outline" className="text-[10px] border-idm-gold-warm/20 text-idm-gold-warm">
              +{prize.pointsPerPlayer} pts
            </Badge>
          )}
        </div>

        {isAlreadyClaimed ? (
          /* ─── EXISTING CLAIM: Show Timeline ─── */
          renderTimeline()
        ) : (
          /* ─── NEW CLAIM: Show Form ─── */
          <div className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-foreground">Metode Klaim</h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setClaimMethod('whatsapp')}
                  className={`flex items-center gap-2 p-3 rounded-xl border transition-all text-left ${
                    claimMethod === 'whatsapp'
                      ? 'border-green-500/30 bg-green-500/10 text-green-400'
                      : 'border-border/30 bg-muted/10 text-muted-foreground hover:bg-muted/20'
                  }`}
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <div>
                    <p className="text-xs font-bold">WhatsApp</p>
                    <p className="text-[10px] opacity-70">Via WhatsApp</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setClaimMethod('manual')}
                  className={`flex items-center gap-2 p-3 rounded-xl border transition-all text-left ${
                    claimMethod === 'manual'
                      ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                      : 'border-border/30 bg-muted/10 text-muted-foreground hover:bg-muted/20'
                  }`}
                >
                  <Phone className="w-4 h-4 shrink-0" />
                  <div>
                    <p className="text-xs font-bold">Manual</p>
                    <p className="text-[10px] opacity-70">Hubungi admin</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground">
                {claimMethod === 'whatsapp' ? 'Nomor WhatsApp' : 'Info Kontak'}
              </label>
              <Input
                placeholder={claimMethod === 'whatsapp' ? '08xxxxxxxxxx' : 'Nomor HP atau alamat'}
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                {claimMethod === 'whatsapp'
                  ? 'Admin akan menghubungi kamu via WhatsApp untuk verifikasi'
                  : 'Tim admin akan menghubungi kamu untuk proses klaim'}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {!isAlreadyClaimed && (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !contactInfo.trim()}
              className="bg-idm-gold-warm text-black hover:bg-idm-gold-warm/90 font-bold gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Mengirim...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Ajukan Klaim
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border/40"
          >
            {isAlreadyClaimed ? 'Tutup' : 'Batal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
