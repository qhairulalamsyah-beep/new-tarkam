'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  Truck,
  Search,
  Eye,
  ChevronDown,
  Phone,
  MessageCircle,
  User,
  Calendar,
  StickyNote,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

/* ═══════════════════════════════════════════════════════
   ADMIN PRIZE CLAIMS TAB
   Manages prize claims from tournament winners
   ═══════════════════════════════════════════════════════ */

interface PlayerInfo {
  id: string;
  gamertag: string;
  name: string;
  division: string;
  avatar: string | null;
  phone: string | null;
}

interface AccountInfo {
  id: string;
  username: string;
}

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

interface ClaimData {
  id: string;
  prizeId: string;
  prizeType: string;
  tournamentId: string | null;
  playerId: string;
  accountId: string | null;
  status: string;
  claimMethod: string;
  contactInfo: string | null;
  notes: string | null;
  claimedAt: string;
  verifiedAt: string | null;
  completedAt: string | null;
  player: PlayerInfo;
  account: AccountInfo | null;
  prize: PrizeInfo | null;
  tournament: TournamentInfo | null;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending: { label: 'Pending', color: 'text-idm-gold-warm', bg: 'bg-idm-gold-warm/15', icon: Clock },
  verified: { label: 'Verified', color: 'text-green-500', bg: 'bg-green-500/15', icon: CheckCircle2 },
  processing: { label: 'Diproses', color: 'text-blue-500', bg: 'bg-blue-500/15', icon: Package },
  shipped: { label: 'Dikirim', color: 'text-sky-500', bg: 'bg-sky-500/15', icon: Truck },
  completed: { label: 'Selesai', color: 'text-emerald-500', bg: 'bg-emerald-500/15', icon: CheckCircle2 },
  rejected: { label: 'Ditolak', color: 'text-red-500', bg: 'bg-red-500/15', icon: XCircle },
};

const statusOrder = ['pending', 'verified', 'processing', 'shipped', 'completed'];

export function AdminPrizeClaimsTab({ division }: { division: string }) {
  const dt = useDivisionTheme();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClaim, setSelectedClaim] = useState<ClaimData | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Fetch claims
  const { data: claimsData, isLoading } = useQuery({
    queryKey: ['prize-claims', division, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: statusFilter,
        division,
        limit: '100',
      });
      const res = await fetch(`/api/prize-claims?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch claims');
      return res.json();
    },
  });

  const claims: ClaimData[] = claimsData?.claims || [];

  // Filter by search query
  const filteredClaims = claims.filter(claim => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      claim.player.gamertag.toLowerCase().includes(q) ||
      claim.player.name.toLowerCase().includes(q) ||
      claim.contactInfo?.toLowerCase().includes(q) ||
      claim.prize?.label?.toLowerCase().includes(q) ||
      claim.prize?.name?.toLowerCase().includes(q)
    );
  });

  // Stats
  const stats = {
    total: claims.length,
    pending: claims.filter(c => c.status === 'pending').length,
    verified: claims.filter(c => c.status === 'verified').length,
    processing: claims.filter(c => c.status === 'processing').length,
    completed: claims.filter(c => c.status === 'completed').length,
    rejected: claims.filter(c => c.status === 'rejected').length,
  };

  // Update claim status mutation
  const updateClaim = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const res = await fetch(`/api/prize-claims/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update claim');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['prize-claims', division] });
      setIsDetailOpen(false);
      setSelectedClaim(null);
      setAdminNotes('');
      const statusLabels: Record<string, string> = {
        verified: 'diverifikasi',
        processing: 'diproses',
        shipped: 'dikirim',
        completed: 'diselesaikan',
        rejected: 'ditolak',
      };
      toast.success(`Klaim berhasil ${statusLabels[variables.status] || 'diperbarui'}`);
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const openDetail = (claim: ClaimData) => {
    setSelectedClaim(claim);
    setAdminNotes(claim.notes || '');
    setIsDetailOpen(true);
  };

  const handleQuickAction = (claim: ClaimData, status: string) => {
    updateClaim.mutate({ id: claim.id, status });
  };

  const getPrizeAmount = (claim: ClaimData) => {
    return claim.prize?.prizeAmount || claim.prize?.value || 0;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-idm-gold-warm" />
        <h2 className="text-lg font-bold text-foreground">Klaim Hadiah</h2>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { key: 'total', label: 'Total', count: stats.total, color: 'text-foreground', bg: 'bg-muted/30' },
          { key: 'pending', label: 'Pending', count: stats.pending, color: 'text-idm-gold-warm', bg: 'bg-idm-gold-warm/10' },
          { key: 'verified', label: 'Verified', count: stats.verified, color: 'text-green-500', bg: 'bg-green-500/10' },
          { key: 'processing', label: 'Diproses', count: stats.processing, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { key: 'completed', label: 'Selesai', count: stats.completed, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { key: 'rejected', label: 'Ditolak', count: stats.rejected, color: 'text-red-500', bg: 'bg-red-500/10' },
        ].map(stat => (
          <button
            key={stat.key}
            onClick={() => setStatusFilter(stat.key === 'total' ? 'all' : stat.key)}
            className={`p-2 rounded-xl border transition-all text-center ${
              (stat.key === 'total' && statusFilter === 'all') || statusFilter === stat.key
                ? `${stat.bg} border-current/20`
                : 'border-border/20 bg-card/30 hover:bg-muted/20'
            }`}
          >
            <p className={`text-lg font-black ${stat.color}`}>{stat.count}</p>
            <p className="text-[10px] font-medium text-muted-foreground">{stat.label}</p>
          </button>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Cari gamertag, nama, atau kontak..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-sm h-9"
          />
        </div>
      </div>

      {/* Claims List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 rounded-xl bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : filteredClaims.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Trophy className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-bold text-muted-foreground/50">Belum ada klaim hadiah</p>
          <p className="text-xs text-muted-foreground/40 mt-1">Klaim hadiah akan muncul setelah pemenang mengajukan</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[calc(100vh-320px)]">
          <div className="space-y-2 pr-2">
            {filteredClaims.map(claim => {
              const sc = statusConfig[claim.status] || statusConfig.pending;
              const StatusIcon = sc.icon;
              const prizeAmount = getPrizeAmount(claim);
              const isMale = claim.player.division === 'male';
              const positionEmoji = (claim.prize?.position ?? 0) === 1 ? '🥇' : (claim.prize?.position ?? 0) === 2 ? '🥈' : (claim.prize?.position ?? 0) === 3 ? '🥉' : '🎁';

              return (
                <div
                  key={claim.id}
                  className={`p-3 rounded-xl border transition-all hover:shadow-sm ${
                    claim.status === 'pending'
                      ? 'border-idm-gold-warm/20 bg-idm-gold-warm/[0.03]'
                      : 'border-border/20 bg-card/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-muted/30 border border-border/30 text-sm">
                      {claim.player.avatar ? (
                        <img src={claim.player.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span>{positionEmoji}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground truncate">
                          {claim.player.gamertag}
                        </span>
                        <Badge className={`text-[9px] border-0 ${sc.bg} ${sc.color} px-1.5 py-0 h-4`}>
                          <StatusIcon className="w-2.5 h-2.5 mr-0.5" />
                          {sc.label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {isMale ? '🕺' : '💃'} {isMale ? 'Cowo' : 'Cewe'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-idm-gold-warm">
                          {formatCurrency(prizeAmount)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {claim.prize?.label || claim.prize?.name || 'Hadiah'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        {claim.contactInfo && (
                          <span className="flex items-center gap-0.5">
                            {claim.claimMethod === 'whatsapp' ? (
                              <MessageCircle className="w-2.5 h-2.5" />
                            ) : (
                              <Phone className="w-2.5 h-2.5" />
                            )}
                            {claim.contactInfo}
                          </span>
                        )}
                        <span className="flex items-center gap-0.5">
                          <Calendar className="w-2.5 h-2.5" />
                          {new Date(claim.claimedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {claim.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleQuickAction(claim, 'verified')}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors"
                            title="Verify"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleQuickAction(claim, 'rejected')}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                            title="Reject"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {claim.status === 'verified' && (
                        <button
                          onClick={() => handleQuickAction(claim, 'processing')}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors"
                          title="Process"
                        >
                          <Package className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {claim.status === 'processing' && (
                        <button
                          onClick={() => handleQuickAction(claim, 'shipped')}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-sky-500/10 text-sky-500 hover:bg-sky-500/20 transition-colors"
                          title="Ship"
                        >
                          <Truck className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {claim.status === 'shipped' && (
                        <button
                          onClick={() => handleQuickAction(claim, 'completed')}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                          title="Complete"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => openDetail(claim)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-muted/20 text-muted-foreground hover:bg-muted/30 transition-colors"
                        title="Detail"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-idm-gold-warm" />
              Detail Klaim Hadiah
            </DialogTitle>
            <DialogDescription>
              Informasi lengkap dan status klaim hadiah
            </DialogDescription>
          </DialogHeader>

          {selectedClaim && (
            <div className="space-y-4">
              {/* Player Info */}
              <div className="p-3 rounded-xl border border-border/20 bg-card/30 space-y-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pemain</h4>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-muted/30 border border-border/30">
                    {selectedClaim.player.avatar ? (
                      <img src={selectedClaim.player.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-sm">🎮</span>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{selectedClaim.player.gamertag}</p>
                    <p className="text-xs text-muted-foreground">{selectedClaim.player.name} · {selectedClaim.player.division === 'male' ? '🕺 Cowo' : '💃 Cewe'}</p>
                  </div>
                </div>
                {selectedClaim.contactInfo && (
                  <div className="flex items-center gap-2 text-xs">
                    {selectedClaim.claimMethod === 'whatsapp' ? (
                      <MessageCircle className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Phone className="w-3.5 h-3.5 text-blue-500" />
                    )}
                    <span>{selectedClaim.contactInfo}</span>
                  </div>
                )}
                {selectedClaim.player.phone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="w-3 h-3" />
                    <span>{selectedClaim.player.phone}</span>
                  </div>
                )}
              </div>

              {/* Prize Info */}
              <div className="p-3 rounded-xl border border-idm-gold-warm/20 bg-idm-gold-warm/[0.03] space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Hadiah</h4>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">
                    {(selectedClaim.prize?.position ?? 0) === 1 ? '🥇' : (selectedClaim.prize?.position ?? 0) === 2 ? '🥈' : (selectedClaim.prize?.position ?? 0) === 3 ? '🥉' : '🎁'}
                  </span>
                  <div>
                    <p className="font-bold text-sm">{selectedClaim.prize?.label || selectedClaim.prize?.name || 'Hadiah'}</p>
                    <p className="text-base font-black text-idm-gold-warm">{formatCurrency(getPrizeAmount(selectedClaim))}</p>
                  </div>
                </div>
                {selectedClaim.tournament && (
                  <p className="text-xs text-muted-foreground">
                    {selectedClaim.tournament.division === 'male' ? '🕺' : '💃'} Week {selectedClaim.tournament.weekNumber} · {selectedClaim.tournament.name}
                  </p>
                )}
              </div>

              {/* Status Timeline */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</h4>
                <div className="flex items-center gap-1 flex-wrap">
                  {statusOrder.map((s, idx) => {
                    const sc = statusConfig[s];
                    const currentIdx = statusOrder.indexOf(selectedClaim.status);
                    const isCompleted = idx <= currentIdx && selectedClaim.status !== 'rejected';
                    const isCurrent = s === selectedClaim.status;

                    return (
                      <div key={s} className="flex items-center gap-1">
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold ${
                          isCompleted ? `${sc.bg} ${sc.color}` : 'bg-muted/20 text-muted-foreground/40'
                        } ${isCurrent ? 'ring-1 ring-current/30' : ''}`}>
                          {isCompleted ? '✓' : `${idx + 1}`}
                          {sc.label}
                        </div>
                        {idx < statusOrder.length - 1 && (
                          <ChevronDown className="w-3 h-3 text-muted-foreground/30 -rotate-90" />
                        )}
                      </div>
                    );
                  })}
                </div>
                {selectedClaim.status === 'rejected' && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-xs font-bold text-red-500">Klaim Ditolak</span>
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-muted/10 border border-border/15">
                  <span className="text-muted-foreground">Diajukan</span>
                  <p className="font-medium">{new Date(selectedClaim.claimedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                {selectedClaim.verifiedAt && (
                  <div className="p-2 rounded-lg bg-green-500/5 border border-green-500/15">
                    <span className="text-green-500">Diverifikasi</span>
                    <p className="font-medium">{new Date(selectedClaim.verifiedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                )}
                {selectedClaim.completedAt && (
                  <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                    <span className="text-emerald-500">Selesai</span>
                    <p className="font-medium">{new Date(selectedClaim.completedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                )}
              </div>

              {/* Admin Notes */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <StickyNote className="w-3.5 h-3.5 text-muted-foreground" />
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Catatan Admin</h4>
                </div>
                <Textarea
                  placeholder="Tambah catatan untuk klaim ini..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="text-sm min-h-[60px]"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {selectedClaim.status === 'pending' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => updateClaim.mutate({ id: selectedClaim.id, status: 'verified', notes: adminNotes || undefined })}
                      disabled={updateClaim.isPending}
                      className="bg-green-600 hover:bg-green-700 text-white gap-1 text-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verifikasi
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => updateClaim.mutate({ id: selectedClaim.id, status: 'rejected', notes: adminNotes || undefined })}
                      disabled={updateClaim.isPending}
                      className="gap-1 text-xs"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Tolak
                    </Button>
                  </>
                )}
                {selectedClaim.status === 'verified' && (
                  <Button
                    size="sm"
                    onClick={() => updateClaim.mutate({ id: selectedClaim.id, status: 'processing', notes: adminNotes || undefined })}
                    disabled={updateClaim.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white gap-1 text-xs"
                  >
                    <Package className="w-3.5 h-3.5" />
                    Proses
                  </Button>
                )}
                {selectedClaim.status === 'processing' && (
                  <Button
                    size="sm"
                    onClick={() => updateClaim.mutate({ id: selectedClaim.id, status: 'shipped', notes: adminNotes || undefined })}
                    disabled={updateClaim.isPending}
                    className="bg-sky-600 hover:bg-sky-700 text-white gap-1 text-xs"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    Kirim
                  </Button>
                )}
                {selectedClaim.status === 'shipped' && (
                  <Button
                    size="sm"
                    onClick={() => updateClaim.mutate({ id: selectedClaim.id, status: 'completed', notes: adminNotes || undefined })}
                    disabled={updateClaim.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Selesai
                  </Button>
                )}
                {/* Save notes only */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateClaim.mutate({ id: selectedClaim.id, status: selectedClaim.status, notes: adminNotes || undefined })}
                  disabled={updateClaim.isPending}
                  className="gap-1 text-xs"
                >
                  <StickyNote className="w-3.5 h-3.5" />
                  Simpan Catatan
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
