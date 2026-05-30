'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Coins, Star, Users, HandCoins } from 'lucide-react';
import { AnimatedSection, SectionHeader } from './shared';
import { formatCurrency } from '@/lib/utils';
import { useTournaments } from '@/lib/hooks';
import { useAppStore } from '@/lib/store';
import { useQuery } from '@tanstack/react-query';
import { PrizeClaimModal } from '@/components/idm/prize-claim-modal';


/* ═══════════════════════════════════════════════════════
   TOURNAMENT PRIZE POOL SECTION
   Shows prize distribution for active tournaments
   ═══════════════════════════════════════════════════════ */

interface Prize {
  id: string;
  label: string;
  position: number;
  prizeAmount: number;
  pointsPerPlayer: number;
  recipientCount: number;
}

interface TournamentWithPrizes {
  id: string;
  name: string;
  weekNumber: number;
  division: string;
  status: string;
  prizePool: number;
  prizes: Prize[];
}

function PrizeCard({
  prize,
  totalPool,
  canClaim,
  onClaim,
  existingClaim,
}: {
  prize: Prize;
  totalPool: number;
  canClaim: boolean;
  onClaim: () => void;
  existingClaim: { id: string; status: string } | null;
}) {
  const percentage = totalPool > 0 ? Math.round((prize.prizeAmount / totalPool) * 100) : 0;
  const positionEmoji = prize.position === 1 ? '🥇' : prize.position === 2 ? '🥈' : prize.position === 3 ? '🥉' : '🎁';
  const positionBg = prize.position === 1 
    ? 'from-yellow-500/20 to-yellow-600/5 border-yellow-500/25' 
    : prize.position === 2 
    ? 'from-gray-400/15 to-gray-500/5 border-gray-400/20' 
    : prize.position === 3 
    ? 'from-amber-700/15 to-amber-800/5 border-amber-700/20' 
    : 'from-muted/10 to-muted/5 border-border/30';
  
  const claimStatusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: 'Menunggu', color: 'text-idm-gold-warm' },
    verified: { label: 'Diverifikasi', color: 'text-green-500' },
    processing: { label: 'Diproses', color: 'text-blue-500' },
    shipped: { label: 'Dikirim', color: 'text-sky-500' },
    completed: { label: 'Selesai', color: 'text-emerald-500' },
    rejected: { label: 'Ditolak', color: 'text-red-500' },
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${positionBg} transition-all duration-300 hover:shadow-md`}>
      <div className="p-3 sm:p-4 flex items-center gap-3">
        {/* Position */}
        <div className="text-2xl sm:text-3xl shrink-0">{positionEmoji}</div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-bold text-sm text-foreground truncate">{prize.label}</span>
            {prize.recipientCount > 1 && (
              <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 border-border/40">
                <Users className="w-2.5 h-2.5 mr-0.5" /> {prize.recipientCount}p
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-idm-gold-warm font-bold">{formatCurrency(prize.prizeAmount)}</span>
            {prize.pointsPerPlayer > 0 && (
              <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 text-idm-gold-warm" /> +{prize.pointsPerPlayer} pts
              </span>
            )}
          </div>
        </div>
        
        {/* Percentage bar + Claim button */}
        <div className="shrink-0 text-right space-y-1.5">
          <div>
            <div className="text-[10px] font-bold text-muted-foreground mb-1">{percentage}%</div>
            <div className="w-12 h-1.5 rounded-full bg-muted/30 overflow-hidden">
              <div 
                className="h-full rounded-full bg-idm-gold-warm/60 transition-all duration-700"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
          {canClaim && !existingClaim && (
            <Button
              size="sm"
              onClick={onClaim}
              className="bg-idm-gold-warm/90 hover:bg-idm-gold-warm text-black text-[10px] font-bold h-6 px-2 gap-1"
            >
              <HandCoins className="w-3 h-3" />
              Klaim
            </Button>
          )}
          {canClaim && existingClaim && (
            <Badge className={`text-[8px] border-0 px-1.5 py-0 ${
              claimStatusConfig[existingClaim.status]?.color || 'text-idm-gold-warm'
            } bg-current/10`}>
              {claimStatusConfig[existingClaim.status]?.label || existingClaim.status}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function TournamentPrizeDisplay({ tournament }: { tournament: TournamentWithPrizes }) {
  const isMale = tournament.division === 'male';
  const accentColor = isMale ? 'text-idm-male' : 'text-idm-female';
  const divisionLabel = isMale ? 'Cowo' : 'Cewe';
  const divisionBorderAccent = isMale ? 'border-idm-male/15' : 'border-idm-female/15';
  const divisionGlowAccent = isMale
    ? 'shadow-[inset_0_1px_0_rgba(34,197,94,0.06)]'
    : 'shadow-[inset_0_1px_0_rgba(236,72,153,0.06)]';
  
  // Player auth & claims
  const { playerAuth } = useAppStore();
  const playerId = playerAuth.account?.player?.id;
  const playerDivision = playerAuth.account?.player?.division;
  // Player phone is not directly available from the store; passed as undefined

  // Fetch player's existing claims
  const { data: myClaimsData } = useQuery({
    queryKey: ['my-prize-claims'],
    queryFn: async () => {
      const res = await fetch('/api/prize-claims/my', { credentials: 'include' });
      if (!res.ok) return { claims: [] };
      return res.json();
    },
    enabled: !!playerId,
    staleTime: 30000,
  });

  // Check if player won in this tournament
  const { data: playerWinData } = useQuery({
    queryKey: ['player-win-status', tournament.id, playerId],
    queryFn: async () => {
      if (!playerId) return { isWinner: false };
      // Check participation
      const res = await fetch(`/api/tournaments/${tournament.id}/participants`, { credentials: 'include' });
      if (!res.ok) return { isWinner: false };
      const data = await res.json();
      const participants = data.data || data.participants || [];
      const myParticipation = participants.find(
        (p: { playerId: string; isWinner: boolean }) => p.playerId === playerId
      );
      return { isWinner: !!myParticipation?.isWinner };
    },
    enabled: !!playerId && playerDivision === tournament.division,
    staleTime: 60000,
  });

  const isWinner = playerWinData?.isWinner || false;
  const canClaim = !!playerId && playerDivision === tournament.division && isWinner;

  // Existing claims map by prizeId
  const existingClaimsMap = new Map<string, { id: string; status: string }>();
  if (myClaimsData?.claims) {
    for (const claim of myClaimsData.claims) {
      if (claim.tournamentId === tournament.id) {
        existingClaimsMap.set(claim.prizeId, { id: claim.id, status: claim.status });
      }
    }
  }

  // Prize claim modal state
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [selectedPrize, setSelectedPrize] = useState<Prize | null>(null);
  const [selectedExistingClaim, setSelectedExistingClaim] = useState<{ id: string; status: string } | null>(null);

  const handleClaim = (prize: Prize) => {
    setSelectedPrize(prize);
    setSelectedExistingClaim(existingClaimsMap.get(prize.id) || null);
    setClaimModalOpen(true);
  };

  return (
    <div className={`space-y-3 p-3 sm:p-4 rounded-2xl border bg-background/60 backdrop-blur-sm ${divisionBorderAccent} ${divisionGlowAccent}`}>
      {/* Tournament Header */}
      <div className="flex items-center gap-2 mb-2">
        <h3 className={`font-bold text-sm ${accentColor} flex items-center gap-1.5`}>
          <span className="text-base">{isMale ? '🕺' : '💃'}</span>
          Tarkam {divisionLabel}, Week {tournament.weekNumber}
        </h3>
      </div>
      
      {/* Total Prize Pool */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-idm-gold-warm/5 border border-idm-gold-warm/15">
        <Coins className="w-5 h-5 text-idm-gold-warm shrink-0" />
        <div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Prize Pool</div>
          <div className="text-base sm:text-lg font-black text-idm-gold-warm">{formatCurrency(tournament.prizePool)}</div>
        </div>
      </div>
      
      {/* Prize List */}
      <div className="space-y-2">
        {tournament.prizes
          .sort((a, b) => a.position - b.position)
          .map(prize => (
            <PrizeCard
              key={prize.id}
              prize={prize}
              totalPool={tournament.prizePool}
              canClaim={canClaim}
              onClaim={() => handleClaim(prize)}
              existingClaim={existingClaimsMap.get(prize.id) || null}
            />
          ))}
      </div>

      {/* Claim Modal */}
      {selectedPrize && (
        <PrizeClaimModal
          open={claimModalOpen}
          onOpenChange={setClaimModalOpen}
          prize={selectedPrize}
          tournament={{
            id: tournament.id,
            name: tournament.name,
            weekNumber: tournament.weekNumber,
            division: tournament.division,
          }}
          existingClaim={myClaimsData?.claims?.find(
            (c: { prizeId: string; tournamentId: string }) => c.prizeId === selectedPrize.id && c.tournamentId === tournament.id
          ) || null}
          playerPhone={undefined}
          playerGamertag={playerAuth.account?.player?.gamertag}
        />
      )}
    </div>
  );
}

export function TournamentPrizeSection() {
  // Fetch tournaments with prizes
  const { data: tournamentsData } = useTournaments(undefined, {
    staleTime: 300000, // ★ 5min — increased from 30s to reduce API calls
  });
  
  const allTournamentsWithPrizes: TournamentWithPrizes[] = [];
  
  if (Array.isArray(tournamentsData)) {
    for (const t of tournamentsData) {
      if (!t.prizes?.length || t.prizePool <= 0) continue;
      allTournamentsWithPrizes.push({
        id: t.id,
        name: t.name,
        weekNumber: t.weekNumber,
        division: t.division,
        status: t.status,
        prizePool: t.prizePool || 0,
        prizes: t.prizes.map((p: any) => ({
          id: p.id,
          label: p.label,
          position: p.position,
          prizeAmount: p.prizeAmount,
          pointsPerPlayer: p.pointsPerPlayer,
          recipientCount: p.recipientCount,
        })),
      });
    }
  }
  
  if (allTournamentsWithPrizes.length === 0) {
    return (
      <AnimatedSection>
        <section className="landing-section relative py-6 sm:py-12 px-4 sm:px-6 lg:px-8 overflow-hidden bg-deep border-y border-border/30 dark:border-0">
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(239,249,35,0.5) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(239,249,35,0.03) 0%, transparent 55%)' }} />

          <SectionHeader
            label="Prize Pool"
            title="Hadiah Turnamen"
            subtitle="Distribusi hadiah akan tersedia saat turnamen dimulai"
            icon={Trophy}
          />

          {/* Empty State — Prize Pool */}
          <div className="mt-6 max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Male Division Empty */}
              <div className="border border-border/20 rounded-2xl overflow-hidden bg-card/30 opacity-50">
                <div className="h-[2px] bg-gradient-to-r from-transparent via-idm-male/50 to-transparent" />
                <div className="flex flex-col items-center justify-center py-8 px-4">
                  <div className="w-10 h-10 rounded-xl bg-idm-male/10 flex items-center justify-center mb-3">
                    <Coins className="w-5 h-5 text-idm-male opacity-50" />
                  </div>
                  <p className="text-sm font-bold text-idm-male opacity-50">Belum ada hadiah</p>
                  <p className="text-[11px] text-muted-foreground/40 mt-1">Hadiah cowo akan muncul setelah admin mengatur prize pool</p>
                </div>
              </div>

              {/* Female Division Empty */}
              <div className="border border-border/20 rounded-2xl overflow-hidden bg-card/30 opacity-50">
                <div className="h-[2px] bg-gradient-to-r from-transparent via-idm-female/50 to-transparent" />
                <div className="flex flex-col items-center justify-center py-8 px-4">
                  <div className="w-10 h-10 rounded-xl bg-idm-female/10 flex items-center justify-center mb-3">
                    <Coins className="w-5 h-5 text-idm-female opacity-50" />
                  </div>
                  <p className="text-sm font-bold text-idm-female opacity-50">Belum ada hadiah</p>
                  <p className="text-[11px] text-muted-foreground/40 mt-1">Hadiah cewe akan muncul setelah admin mengatur prize pool</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </AnimatedSection>
    );
  }

  // Find the latest week that has prizes — if current week has no prizes yet, fallback to previous
  const latestWeek = Math.max(...allTournamentsWithPrizes.map(t => t.weekNumber));
  const latestWeekTournaments = allTournamentsWithPrizes.filter(t => t.weekNumber === latestWeek);
  
  // Side-by-side: male + female from the latest week
  const maleTournament = latestWeekTournaments.find(t => t.division === 'male');
  const femaleTournament = latestWeekTournaments.find(t => t.division === 'female');
  const displayPair = [maleTournament, femaleTournament].filter(Boolean) as TournamentWithPrizes[];

  return (
    <AnimatedSection>
      <section className="landing-section relative py-6 sm:py-12 px-4 sm:px-6 lg:px-8 overflow-hidden bg-deep border-y border-border/30 dark:border-0">
        {/* Background — dot pattern (center-weighted) */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(239,249,35,0.5) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        {/* Radial glow — centered, stronger gold (prize theme) */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(239,249,35,0.03) 0%, transparent 55%), radial-gradient(ellipse at 80% 70%, rgba(255,45,120,0.03) 0%, transparent 40%)' }} />

        <SectionHeader
          label={`Prize Pool · Week ${latestWeek}`}
          title="Hadiah Turnamen"
          subtitle="Distribusi hadiah untuk turnamen aktif"
          icon={Trophy}
        />
        
        {/* Male & Female side by side */}
        <div className="mt-6 max-w-5xl mx-auto">
          {displayPair.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {displayPair.map(tournament => (
                <TournamentPrizeDisplay key={tournament.id} tournament={tournament} />
              ))}
            </div>
          )}
        </div>
      </section>
    </AnimatedSection>
  );
}
