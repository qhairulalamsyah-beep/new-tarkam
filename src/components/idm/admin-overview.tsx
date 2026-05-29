'use client';

import { useQuery } from '@tanstack/react-query';

import {
  Calendar, Shield, Globe, Gift,
  Music,
  AlertTriangle, Clock, UserPlus, CreditCard, Swords, MessageSquare,
  ChevronRight, Loader2, Trophy, TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getStats, getPlayers, getDonations, getTournaments } from '@/lib/queries';
import { useWaRegistrations, useAuditLogs } from '@/lib/hooks';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { LiveMatchFeed } from './admin/live-match-feed';
import { AdminOverviewSkeleton } from './admin/admin-skeletons';
import { ScoreAuditFeed } from './admin/score-audit-feed';

interface AdminOverviewProps {
  division: 'semua' | 'male' | 'female';
  onNavigateToTab?: (tab: string) => void;
  onNavigateToTournament?: (tournamentId: string) => void;
}

// Action icon/color map (same as AdminSettingsPanel)
const ACTION_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  create: { bg: 'bg-green-500/10', text: 'text-green-500', icon: '+' },
  update: { bg: 'bg-blue-500/10', text: 'text-blue-500', icon: '✎' },
  delete: { bg: 'bg-red-500/10', text: 'text-red-500', icon: '×' },
  approve: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', icon: '✓' },
  reject: { bg: 'bg-orange-500/10', text: 'text-orange-500', icon: '✗' },
  login: { bg: 'bg-purple-500/10', text: 'text-purple-500', icon: '→' },
  export: { bg: 'bg-cyan-500/10', text: 'text-cyan-500', icon: '↓' },
  reseed: { bg: 'bg-red-500/10', text: 'text-red-500', icon: '↻' },
  score: { bg: 'bg-idm-gold-warm/10', text: 'text-idm-gold-warm', icon: '📊' },
};

const ENTITY_LABELS: Record<string, string> = {
  player: 'Player',
  tournament: 'Turnamen',
  season: 'Season',
  donation: 'Donasi',
  sponsor: 'Sponsor',
  achievement: 'Achievement',
  skin: 'Skin',
  cms: 'Konten',
  match: 'Match',
  club: 'Club',
  admin: 'Admin',
  auth: 'Auth',
};

// Tournament status visual config
const TOURNAMENT_STATUS_CONFIG: Record<string, { bg: string; text: string; badge: string; icon: string }> = {
  main_event:       { bg: 'bg-red-500/5 border-red-500/20', text: 'text-red-500', badge: 'bg-red-500/10 text-red-500', icon: '🔴' },
  finalization:     { bg: 'bg-purple-500/5 border-purple-500/20', text: 'text-purple-500', badge: 'bg-purple-500/10 text-purple-500', icon: '🏆' },
  bracket_generation: { bg: 'bg-blue-500/5 border-blue-500/20', text: 'text-blue-500', badge: 'bg-blue-500/10 text-blue-500', icon: '📋' },
  team_generation:  { bg: 'bg-blue-500/5 border-blue-500/20', text: 'text-blue-500', badge: 'bg-blue-500/10 text-blue-500', icon: '👥' },
  approval:         { bg: 'bg-yellow-500/5 border-yellow-500/20', text: 'text-yellow-500', badge: 'bg-yellow-500/10 text-yellow-500', icon: '⏳' },
  registration:     { bg: 'bg-green-500/5 border-green-500/20', text: 'text-green-500', badge: 'bg-green-500/10 text-green-500', icon: '🟢' },
  setup:            { bg: 'bg-muted/5 border-border/20', text: 'text-muted-foreground', badge: 'bg-muted/50 text-muted-foreground', icon: '⚙️' },
  completed:        { bg: 'bg-idm-gold-warm/5 border-idm-gold-warm/20', text: 'text-idm-gold-warm', badge: 'bg-idm-gold-warm/10 text-idm-gold-warm', icon: '🎉' },
};

interface AuditLogEntry {
  id: string;
  adminId?: string | null;
  adminName?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
  metadata?: string | null;
  createdAt: string;
}

export function AdminOverview({ division, onNavigateToTab, onNavigateToTournament }: AdminOverviewProps) {
  const dt = useDivisionTheme();

  // Build division filter for API calls
  const divisionParam = division !== 'semua' ? division : '';

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['stats', division],
    queryFn: () => getStats(division),
  });

  // ─── Active Tournaments query ───
  const seasonId = stats?.season?.id;
  const { data: tournaments } = useQuery({
    queryKey: ['admin-tournaments', seasonId],
    queryFn: async () => {
      if (!seasonId) return [];
      const data = await getTournaments({ seasonId });
      return Array.isArray(data) ? data : [];
    },
    enabled: !!seasonId,
  });

  // ─── Perlu Perhatian queries ───

  // Pending player registrations
  const { data: pendingPlayersData } = useQuery({
    queryKey: ['admin-pending-registrations', division],
    queryFn: () => getPlayers({ registrationStatus: 'pending', division: divisionParam || undefined }).catch(() => []),
  });

  // Pending donations (requires admin auth)
  const { data: pendingDonationsData } = useQuery({
    queryKey: ['admin-pending-donations', division],
    queryFn: () => getDonations({ status: 'pending', division: divisionParam as 'male' | 'female' | undefined || undefined }).catch(() => ({ donations: [], total: { amount: 0, count: 0 } })),
  });

  // WA registrations pending
  const { data: pendingWaData } = useWaRegistrations({
    division: divisionParam || undefined,
    status: 'pending',
  });

  // Audit logs (compact — 5 entries)
  const { data: auditData, isLoading: isLoadingLogs } = useAuditLogs({
    limit: 5,
  }, {
    refetchInterval: 60000,
  });

  // ─── Compute values ───

  const pendingRegistrations = Array.isArray(pendingPlayersData) ? pendingPlayersData.length : 0;
  const pendingDonations = (pendingDonationsData as Record<string, unknown>)?.donations
    ? ((pendingDonationsData as Record<string, unknown>).donations as unknown[]).length
    : 0;
  const activeTournaments = stats?.tournaments?.filter(
    (t: { status: string }) => t.status !== 'completed'
  ).length || 0;
  const pendingWaRegistrations = (pendingWaData as Record<string, unknown>)?.pagination
    ? ((pendingWaData as Record<string, { total: number }>).pagination).total
    : 0;

  // Active/live tournaments sorted by priority
  const liveTournaments = (Array.isArray(tournaments) ? tournaments : [])
    .filter((t: any) => t.status === 'main_event')
    .sort((a: any, b: any) => b.weekNumber - a.weekNumber);

  const otherActiveTournaments = (Array.isArray(tournaments) ? tournaments : [])
    .filter((t: any) => t.status !== 'completed' && t.status !== 'main_event')
    .sort((a: any, b: any) => {
      const order: Record<string, number> = { finalization: 0, bracket_generation: 1, team_generation: 2, approval: 3, registration: 4, setup: 5 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    });

  // Quick action cards — actionable shortcuts for admin
  const quickActions = [
    {
      icon: Music,
      label: 'Buat Turnamen',
      desc: 'KLIK untuk buat & kelola turnamen',
      tabKey: 'turnamen',
      accent: 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20',
    },
    {
      icon: UserPlus,
      label: 'Tambah Pemain',
      desc: 'KLIK untuk daftarkan pemain baru',
      tabKey: 'pemain',
      accent: 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20',
    },
    {
      icon: Shield,
      label: 'Buat Club',
      desc: 'KLIK untuk kelola club & anggota',
      tabKey: 'club',
      accent: 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20',
    },
    {
      icon: Gift,
      label: 'Keuangan',
      desc: 'KLIK untuk donasi & pembayaran',
      tabKey: 'keuangan',
      accent: 'bg-green-500/10 text-green-500 hover:bg-green-500/20',
    },
    {
      icon: Globe,
      label: 'Konten',
      desc: 'KLIK untuk edit halaman & sponsor',
      tabKey: 'konten',
      accent: 'bg-purple-500/10 text-purple-500 hover:bg-purple-500/20',
    },
  ];

  // Needs attention items — with tab key for navigation
  const attentionItems = [
    {
      icon: UserPlus,
      label: 'Registrasi Pemain',
      count: pendingRegistrations,
      tab: 'Pemain',
      tabKey: 'pemain',
    },
    {
      icon: CreditCard,
      label: 'Donasi Perlu Approval',
      count: pendingDonations,
      tab: 'Keuangan',
      tabKey: 'keuangan',
    },
    {
      icon: Swords,
      label: 'Turnamen Aktif',
      count: activeTournaments,
      tab: 'Turnamen',
      tabKey: 'turnamen',
    },
    {
      icon: MessageSquare,
      label: 'WA Registrasi',
      count: pendingWaRegistrations,
      tab: 'Pemain',
      tabKey: 'pemain',
    },
  ];

  const auditLogs = auditData?.logs || [];

  // Show skeleton while initial stats are loading
  if (isLoadingStats) {
    return <AdminOverviewSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* ── Live Match Feed ── */}
      <div className="stagger-item-subtle">
        <LiveMatchFeed division={division} onNavigateToTournament={onNavigateToTournament} />
      </div>

      {/* ── Active Tournaments Quick Access ── */}
      {otherActiveTournaments.length > 0 && (
        <div className="stagger-item-subtle">
          <Card className={dt.casinoCard}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className={`w-4 h-4 ${dt.text}`} />
                Turnamen Aktif
                <Badge className="text-xs border-0 bg-idm-gold-warm/10 text-idm-gold-warm">{otherActiveTournaments.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                {otherActiveTournaments.slice(0, 5).map((t: any) => {
                  const sc = TOURNAMENT_STATUS_CONFIG[t.status] || TOURNAMENT_STATUS_CONFIG.setup;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onNavigateToTournament?.(t.id)}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer group text-left"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-sm shrink-0">{sc.icon}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{t.name}</p>
                          <span className="text-[10px] text-muted-foreground">Week {t.weekNumber}</span>
                        </div>
                      </div>
                      <Badge className={`text-[10px] border-0 ${sc.badge}`}>{t.status.replace('_', ' ')}</Badge>
                      {t.matchStats && (
                        <span className="text-[10px] text-idm-gold-warm ml-1">{t.matchStats.completed}/{t.matchStats.total}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Action cards */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {quickActions.map((action, i) => {
          const ActionIcon = action.icon;
          return (
            <div key={action.label} className="col-span-1 stagger-item-subtle" style={{ animationDelay: `${(i + 1) * 30}ms` }}>
              <button
                type="button"
                onClick={() => onNavigateToTab?.(action.tabKey)}
                className={`w-full h-full rounded-lg border border-border p-3 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group ${action.accent}`}
              >
                <div className="p-2 rounded-lg bg-muted/30 group-hover:bg-muted/50 transition-colors mb-1.5">
                  <ActionIcon className="w-4 h-4" />
                </div>
                <p className="text-xs font-semibold leading-tight">{action.label}</p>
                <p className="text-sm opacity-75 mt-0.5 leading-tight font-medium">{action.desc}</p>
              </button>
            </div>
          );
        })}
      </div>

      {/* Season Progress — full width compact */}
      <div className="stagger-item-subtle stagger-d0">
        <Card className={dt.casinoCard}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className={`w-4 h-4 ${dt.text}`} />
              Season Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Week {stats?.seasonProgress?.completedWeeks || 0} of {stats?.seasonProgress?.totalWeeks || 10}</span>
                  <span className="font-medium">{stats?.seasonProgress?.percentage || 0}%</span>
                </div>
                <Progress value={stats?.seasonProgress?.percentage || 0} className="h-2" />
              </div>
              {/* Week indicators */}
              <div className="flex gap-1 shrink-0">
                {Array.from({ length: stats?.seasonProgress?.totalWeeks || 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-1.5 rounded-full ${
                      i < (stats?.seasonProgress?.completedWeeks || 0)
                        ? division === 'male' ? 'bg-idm-male' : division === 'female' ? 'bg-idm-female' : 'bg-primary'
                        : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Score Activity Feed — recent match score changes */}
      <div className="stagger-item-subtle">
        <Card className={dt.casinoCard}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className={`w-4 h-4 ${dt.text}`} />
              Aktivitas Skor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreAuditFeed limit={6} />
          </CardContent>
        </Card>
      </div>

      {/* 2 cols: Perlu Perhatian | Log Aktivitas — equal height */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:stretch">
        {/* Perlu Perhatian (Needs Attention) */}
        <div className="stagger-item-subtle stagger-d1 flex flex-col">
          <Card className={`${dt.casinoCard} flex-1 flex flex-col`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${dt.text}`} />
                Perlu Perhatian
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="space-y-2.5 flex-1">
                {attentionItems.map((item) => {
                  const Icon = item.icon;
                  const needsAction = item.count > 0;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => onNavigateToTab?.(item.tabKey)}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 w-full text-left transition-colors hover:bg-muted/50 cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-md ${needsAction ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                          <Icon className={`w-3.5 h-3.5 ${needsAction ? 'text-red-500' : 'text-green-500'}`} />
                        </div>
                        <div>
                          <p className="text-xs font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground group-hover:text-idm-gold-warm transition-colors">
                            {needsAction ? `Lihat di tab ${item.tab} →` : 'Semua baik ✓'}
                          </p>
                        </div>
                      </div>
                      {needsAction ? (
                        <Badge className="text-xs border-0 bg-red-500/10 text-red-500 font-bold">
                          {item.count}
                        </Badge>
                      ) : (
                        <span className="text-green-500 text-sm font-bold">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Log Aktivitas — compact version */}
        <div className="stagger-item-subtle stagger-d1 flex flex-col">
          <Card className={`${dt.casinoCard} flex-1 flex flex-col`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className={`w-4 h-4 ${dt.text}`} />
                Log Aktivitas
                {auditData?.total ? (
                  <Badge className="text-xs border-0 bg-idm-gold-warm/10 text-idm-gold-warm">{auditData.total}</Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {isLoadingLogs ? (
                <div className="flex items-center justify-center py-6 flex-1">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 flex-1">Belum ada log</p>
              ) : (
                <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar" style={{ maxHeight: '260px' }}>
                  {auditLogs.map((log) => {
                    const style = ACTION_STYLES[log.action] || { bg: 'bg-muted', text: 'text-muted-foreground', icon: '•' };
                    const entityLabel = ENTITY_LABELS[log.entity] || log.entity;
                    return (
                      <div key={log.id} className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/30">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${style.bg} ${style.text}`}>
                          {style.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 flex-wrap">
                            <p className="text-xs font-medium capitalize">{log.action} {entityLabel}</p>
                            {log.adminName && (
                              <span className="text-xs px-1 py-0.5 rounded-full bg-idm-gold-warm/10 text-idm-gold-warm">oleh {log.adminName}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{log.details || '—'}</p>
                          <p className="text-xs text-muted-foreground/60">
                            {new Date(log.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} · {new Date(log.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {/* Link to full logs in Pengaturan tab */}
                  <div className="pt-1 border-t border-border">
                    <button
                      type="button"
                      onClick={() => onNavigateToTab?.('pengaturan')}
                      className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      Lihat semua <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
