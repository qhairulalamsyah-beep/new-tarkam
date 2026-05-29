'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
import {
  Shield, Users, Music, Gift,
  Globe, LayoutDashboard, Sliders, Flame, Calendar,
  Sparkles, Clock,
  ChevronDown, Menu, X, Home, LogOut
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getStats, getCmsSettings, getPlayers, getClubs, getDonations } from '@/lib/queries';
import { AdminPlayersTab } from './admin/tabs/admin-players-tab';
import { AdminKeuanganTab } from './admin/tabs/admin-keuangan-tab';
import { CmsPanel } from './cms-panel';
import { ErrorBoundary } from './error-boundary';
import { TournamentManager } from './tournament-manager';
import { ClubManagement } from './club-management';
import { CloudinaryPicker } from './cloudinary-picker';
import { AdminOverview } from './admin-overview';
import { AdminSponsorPanel } from './admin-sponsor-panel';
import { AdminSkinPanel } from './admin-skin-panel';
import { AdminSettingsPanel } from './admin-settings-panel';
import { AdminDivisionContentTab } from './admin/tabs/admin-division-content-tab';
import { AdminPendingTab } from './admin/tabs/admin-pending-tab';
import { AdminManagement } from './admin-management';
import { AdminSeasonPanel } from './admin-season-panel';
import { PlayerFormDialog, emptyForm, type PlayerForm } from './admin/tabs/player-form-dialog';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { formatTarkamSeasonName } from '@/lib/utils';

// ─── Navigation Config (single source of truth) ───────────────────
// Sidebar items — flat list with optional sub-items
type NavItem = {
  key: string;
  icon: typeof Users;
  label: string;
  badge?: number;
  subItems?: { key: string; icon: typeof Users; label: string; badge?: number }[];
};

export function AdminPanel() {
  const { division: storeDivision, setDivision, setPendingTournamentSelectId, setCurrentView, adminAuth, clearAdminAuth } = useAppStore();
  const dt = useDivisionTheme();
  const qc = useQueryClient();

  // Admin panel always requires a specific division — "semua" is for community views only.
  useEffect(() => {
    if (storeDivision === 'semua') {
      setDivision('male');
    }
  }, [storeDivision, setDivision]);

  // Tab state — persisted to localStorage
  const [activeTab, setActiveTabRaw] = useState(() => {
    if (typeof window !== 'undefined') {
      try { const saved = localStorage.getItem('idm-admin-tab'); if (saved) return saved; } catch { /* ignore */ }
    }
    return 'dashboard';
  });

  const setActiveTab = (tab: string) => {
    setActiveTabRaw(tab);
    try { localStorage.setItem('idm-admin-tab', tab); } catch { /* ignore */ }
  };

  // Mobile sidebar overlay state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sidebar collapsed state (desktop only)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      try { const saved = localStorage.getItem('idm-admin-sidebar-collapsed'); return saved === 'true'; } catch { return false; }
    }
    return false;
  });
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('idm-admin-sidebar-collapsed', String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // ─── Queries ─────────────────────────────────────────────────────
  const { data: players, isLoading: isLoadingPlayers } = useQuery({
    queryKey: ['admin-players', storeDivision],
    queryFn: async () => { try { const data = await getPlayers({ division: storeDivision }); const list = Array.isArray(data) ? data : []; return { data: list, total: list.length }; } catch { return { data: [], total: 0 }; } },
    enabled: activeTab === 'pemain' || activeTab === 'dashboard',
  });

  const [playerOffset, setPlayerOffset] = useState(0);
  const [allPlayerPages, setAllPlayerPages] = useState<any[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastDivision, setLastDivision] = useState(storeDivision);
  const PLAYERS_PAGE_SIZE = 50;

  const playersData = players?.data || [];
  const playersTotal = players?.total || 0;
  const hasMorePlayers = playersData.length < playersTotal;

  if (lastDivision !== storeDivision) {
    setLastDivision(storeDivision);
    setAllPlayerPages([]);
    setPlayerOffset(0);
  }

  const loadMorePlayers = async () => {
    const nextOffset = playerOffset + PLAYERS_PAGE_SIZE;
    setIsLoadingMore(true);
    try {
      const res = await fetch(`/api/admin/players?division=${storeDivision}&limit=${PLAYERS_PAGE_SIZE}&offset=${nextOffset}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAllPlayerPages(prev => [...prev, ...(data.data || [])]);
        setPlayerOffset(nextOffset);
      }
    } catch { /* ignore */ }
    setIsLoadingMore(false);
  };

  const { data: stats } = useQuery({
    queryKey: ['stats', storeDivision],
    queryFn: () => getStats(storeDivision),
  });

  const { data: donations } = useQuery({
    queryKey: ['admin-donations', storeDivision],
    queryFn: () => getDonations({ status: 'all', division: storeDivision as 'male' | 'female' }).catch(() => ({ donations: [] })),
    enabled: activeTab === 'keuangan' || activeTab === 'dashboard',
  });

  const { data: cmsSettings } = useQuery({
    queryKey: ['admin-cms-settings'],
    queryFn: async () => { try { const d = await getCmsSettings(); return (d?.map || {}) as Record<string, string>; } catch { return {}; } },
    enabled: activeTab === 'pengaturan' || activeTab === 'keuangan',
  });

  const { data: clubs } = useQuery({
    queryKey: ['admin-clubs', storeDivision, 'unified'],
    queryFn: () => getClubs({ unified: true, division: storeDivision }),
  });

  const invalidateLandingCache = () => {
    qc.invalidateQueries({ queryKey: ['stats'] });
    qc.invalidateQueries({ queryKey: ['cms-content'] });
  };

  const authFetch = async (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  };

  // ─── Mutations ───────────────────────────────────────────────────
  const createPlayer = useMutation({
    mutationFn: async (data: PlayerForm) => {
      const res = await authFetch('/api/players', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name, gamertag: data.gamertag, tier: data.tier, division: data.division,
          city: data.city || undefined, phone: data.phone || undefined, joki: data.joki || undefined,
          points: parseInt(data.points) || 0, clubId: data.clubId === '_none' ? undefined : data.clubId,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-players', storeDivision] });
      invalidateLandingCache();
      toast.success('Player berhasil ditambahkan!');
      setPlayerFormOpen(false);
      setFormData(emptyForm);
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  const updatePlayer = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PlayerForm> }) => {
      const res = await authFetch(`/api/players/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: data.name, gamertag: data.gamertag, tier: data.tier, division: data.division,
          city: data.city, phone: data.phone || null, joki: data.joki || null,
          points: data.points ? parseInt(data.points) : undefined,
          clubId: data.clubId === '_none' ? null : data.clubId,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-players', storeDivision] });
      invalidateLandingCache();
      toast.success('Player berhasil diperbarui!');
      setPlayerFormOpen(false);
      setEditingPlayer(null);
      setFormData(emptyForm);
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  const deletePlayer = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/players?id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-players', storeDivision] });
      qc.invalidateQueries({ queryKey: ['admin-pending-registrations'] });
      setAllPlayerPages([]);
      setPlayerOffset(0);
      invalidateLandingCache();
      toast.success('Player berhasil dihapus!');
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  const updateTier = useMutation({
    mutationFn: async ({ playerId, tier }: { playerId: string; tier: string }) => {
      const res = await authFetch(`/api/players/${playerId}`, { method: 'PUT', body: JSON.stringify({ tier }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-players', storeDivision] }); invalidateLandingCache(); toast.success('Tier diperbarui!'); },
  });

  const updateAvatar = useMutation({
    mutationFn: async ({ playerId, avatar }: { playerId: string; avatar: string }) => {
      const res = await authFetch(`/api/players/${playerId}`, { method: 'PUT', body: JSON.stringify({ avatar }) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to update avatar'); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-players', storeDivision] });
      qc.invalidateQueries({ queryKey: ['player-achievements'] });
      invalidateLandingCache();
      toast.success('Avatar diperbarui!');
    },
    onError: (err: Error) => { toast.error(err.message); },
  });

  const handleAvatarSelect = (url: string, _publicId?: string) => {
    if (editingPlayerId) {
      updateAvatar.mutate({ playerId: editingPlayerId, avatar: url });
      setEditingPlayerId(null);
    }
  };

  const openAvatarPicker = (playerId: string) => {
    setEditingPlayerId(playerId);
    setCloudinaryOpen(true);
  };

  const addDonation = useMutation({
    mutationFn: async (data: { donorName: string; amount: number; message: string; type: string; tournamentId?: string }) => {
      const res = await authFetch('/api/donations', {
        method: 'POST',
        body: JSON.stringify({ ...data, division: storeDivision, seasonId: stats?.season?.id, tournamentId: stats?.activeTournament?.id, source: 'admin' }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-donations', storeDivision] }); toast.success('Saweran berhasil ditambahkan!'); },
  });

  const approveDonation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => {
      const res = await authFetch('/api/donations', { method: 'PATCH', body: JSON.stringify({ id, status }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['admin-donations', storeDivision] });
      qc.invalidateQueries({ queryKey: ['stats', storeDivision] });
      qc.invalidateQueries({ queryKey: ['feed'] });
      invalidateLandingCache();
      toast.success(variables.status === 'approved' ? 'Saweran disetujui ✅' : 'Saweran ditolak ❌');
    },
  });

  const deleteDonation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch('/api/donations', { method: 'DELETE', body: JSON.stringify({ id }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-donations', storeDivision] }); qc.invalidateQueries({ queryKey: ['feed'] }); toast.success('Saweran dihapus'); },
  });

  const savePaymentSettingsBatch = useMutation({
    mutationFn: async (items: { key: string; value: string; type?: string }[]) => {
      const res = await authFetch('/api/cms/settings', { method: 'POST', body: JSON.stringify({ items }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      setPaymentForm(null);
      qc.invalidateQueries({ queryKey: ['admin-cms-settings'] });
      invalidateLandingCache();
      toast.success('Setting pembayaran disimpan!');
    },
  });

  const { data: pendingRegistrations } = useQuery({
    queryKey: ['admin-pending-registrations', storeDivision],
    queryFn: () => getPlayers({ registrationStatus: 'pending', division: storeDivision }).catch(() => []),
    enabled: activeTab === 'pemain',
  });

  const { data: pendingPlayersCountData } = useQuery({
    queryKey: ['admin-pending-players-count', storeDivision],
    queryFn: async () => { try { const data = await getPlayers({ registrationStatus: 'pending', division: storeDivision }); return { count: Array.isArray(data) ? data.length : 0 }; } catch { return { count: 0 }; } },
  });
  const pendingPlayersCount = pendingPlayersCountData?.count || 0;

  const approveRegistration = useMutation({
    mutationFn: async ({ playerId, tier }: { playerId: string; tier: string }) => {
      const res = await authFetch(`/api/players/${playerId}`, { method: 'PUT', body: JSON.stringify({ registrationStatus: 'approved', tier }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-pending-registrations'] }); qc.invalidateQueries({ queryKey: ['admin-players', storeDivision] }); invalidateLandingCache(); toast.success('Pendaftaran disetujui!'); },
  });

  const rejectRegistration = useMutation({
    mutationFn: async (playerId: string) => {
      const res = await authFetch(`/api/players/${playerId}`, { method: 'PUT', body: JSON.stringify({ registrationStatus: 'rejected', isActive: false }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-pending-registrations'] }); qc.invalidateQueries({ queryKey: ['admin-players', storeDivision] }); invalidateLandingCache(); toast.success('Pendaftaran ditolak.'); },
  });

  // ─── State ───────────────────────────────────────────────────────
  const [newDonation, setNewDonation] = useState({ donorName: '', amount: '', message: '', type: 'weekly' });
  const [paymentFormState, setPaymentForm] = useState<Record<string, string> | null>(null);
  const [searchPlayer, setSearchPlayer] = useState('');
  const cmsSettingsBase = cmsSettings || {};
  const paymentForm = paymentFormState ?? cmsSettingsBase;
  const updatePaymentForm = (updates: Partial<Record<string, string>>) => {
    setPaymentForm(prev => ({ ...cmsSettingsBase, ...prev, ...updates }) as Record<string, string>);
  };

  // ─── Navigation Config ───────────────────────────────────────────
  // Count helpers
  const donationCount = donations?.donations?.filter((d: { status: string }) => d.status === 'pending').length || 0;
  const filteredPlayers = [...playersData, ...allPlayerPages].filter((p: { gamertag: string; name: string }) =>
    p.gamertag.toLowerCase().includes(searchPlayer.toLowerCase()) ||
    p.name.toLowerCase().includes(searchPlayer.toLowerCase())
  );

  const categoryTabMap: Record<string, string[]> = {
    dashboard: ['dashboard'],
    turnamen: ['season', 'pending', 'turnamen'],
    pemain: ['pemain'],
    club: ['club'],
    keuangan: ['keuangan'],
    pengaturan: ['konten', 'sponsor', 'skin', 'pengaturan'],
  };

  const getTabConfig = (tabValue: string): { icon: typeof Users; label: string; count?: number } | null => {
    const map: Record<string, { icon: typeof Users; label: string; count?: number }> = {
      dashboard: { icon: LayoutDashboard, label: 'Dashboard' },
      pending: { icon: Clock, label: 'Pending', count: pendingPlayersCount || undefined },
      pemain: { icon: Users, label: 'Pemain', count: filteredPlayers?.length || undefined },
      club: { icon: Shield, label: 'Club' },
      turnamen: { icon: Music, label: 'Turnamen' },
      keuangan: { icon: Gift, label: 'Keuangan', count: donationCount || undefined },
      season: { icon: Calendar, label: 'Season' },
      konten: { icon: Globe, label: 'Halaman' },
      sponsor: { icon: Flame, label: 'Sponsor' },
      skin: { icon: Sparkles, label: 'Skin' },
      pengaturan: { icon: Sliders, label: 'Pengaturan' },
    };
    return map[tabValue] || null;
  };

  // All valid tab keys for validation
  const allValidTabs = Object.values(categoryTabMap).flat();

  // Validate persisted tab on mount
  const [tabValidated, setTabValidated] = useState(false);
  if (!tabValidated) {
    setTabValidated(true);
    if (!allValidTabs.includes(activeTab)) {
      setActiveTabRaw('dashboard');
      try { localStorage.removeItem('idm-admin-tab'); } catch { /* ignore */ }
    }
  }

  // Navigate to a tab
  const navigateToTab = (tabKey: string) => {
    if (!allValidTabs.includes(tabKey)) { setActiveTab('dashboard'); return; }
    setActiveTab(tabKey);
    // Auto-close mobile sidebar on navigation
    setSidebarOpen(false);
  };

  const navigateToTournament = (tournamentId: string) => {
    setPendingTournamentSelectId(tournamentId);
    navigateToTab('turnamen');
  };

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; description: string; onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  const [playerFormOpen, setPlayerFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<{ id: string; data: PlayerForm } | null>(null);
  const [formData, setFormData] = useState<PlayerForm>(emptyForm);
  const [cloudinaryOpen, setCloudinaryOpen] = useState(false);
  const [qrisPickerOpen, setQrisPickerOpen] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);

  const openNewPlayerForm = () => {
    setEditingPlayer(null);
    setFormData({ ...emptyForm, division: storeDivision });
    setPlayerFormOpen(true);
  };

  const openEditPlayerForm = (player: {
    id: string; name: string; gamertag: string; tier: string; division: string;
    city: string; phone: string | null; joki: string | null; points: number;
    clubMembers?: Array<{ profile: { id: string; name: string; logo?: string | null } }>;
  }) => {
    const form: PlayerForm = {
      name: player.name, gamertag: player.gamertag, tier: player.tier, division: player.division,
      city: player.city || '', phone: player.phone || '', joki: player.joki || '',
      points: player.points.toString(), clubId: player.clubMembers?.[0]?.profile?.id || '_none',
    };
    setEditingPlayer({ id: player.id, data: form });
    setFormData(form);
    setPlayerFormOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.gamertag.trim()) { toast.error('Nama dan nickname wajib diisi'); return; }
    if (editingPlayer) { updatePlayer.mutate({ id: editingPlayer.id, data: formData }); }
    else { createPlayer.mutate(formData); }
  };

  // ─── Sidebar navigation items ──────────────────────────────────
  const sidebarNavItems: NavItem[] = [
    { key: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    {
      key: 'turnamen', icon: Music, label: 'Turnamen',
      subItems: [
        { key: 'season', icon: Calendar, label: 'Season' },
        { key: 'pending', icon: Clock, label: 'Pending', badge: pendingPlayersCount || undefined },
        { key: 'turnamen', icon: Music, label: 'Turnamen' },
      ],
    },
    { key: 'pemain', icon: Users, label: 'Pemain' },
    { key: 'club', icon: Shield, label: 'Club' },
    { key: 'keuangan', icon: Gift, label: 'Keuangan', badge: donationCount || undefined },
    {
      key: 'pengaturan', icon: Sliders, label: 'Pengaturan',
      subItems: [
        { key: 'konten', icon: Globe, label: 'Konten' },
        { key: 'sponsor', icon: Flame, label: 'Sponsor' },
        { key: 'skin', icon: Sparkles, label: 'Skin' },
        { key: 'pengaturan', icon: Sliders, label: 'Umum' },
      ],
    },
  ];

  // Check if a nav item or its sub-items is active
  const isNavActive = (item: NavItem) => {
    if (activeTab === item.key) return true;
    return item.subItems?.some(sub => sub.key === activeTab) || false;
  };

  // ─── Shared sidebar content renderer ────────────────────────────
  const renderSidebarContent = (isMobile: boolean) => {
    // On mobile, always expanded (no collapse)
    const collapsed = isMobile ? false : sidebarCollapsed;

    return (
      <>
        {/* Sidebar Header */}
        <div className={`flex items-center gap-2 p-3 border-b border-border/30 ${collapsed ? 'justify-center' : ''}`}>
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/30 transition-colors mr-1 shrink-0"
              aria-label="Tutup menu"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <Shield className={`w-5 h-5 shrink-0 ${dt.neonText}`} />
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-sm font-bold text-gradient-fury truncate">Panel Admin</h2>
              <Badge className="bg-red-500/10 text-red-500 text-[10px] border-0 px-1.5 py-0 shrink-0">ADMIN</Badge>
            </div>
          )}
        </div>

        {/* Division Switcher */}
        <div className={`flex items-center p-2 border-b border-border/30 ${collapsed ? 'justify-center' : ''}`}>
          {collapsed ? (
            <button
              type="button"
              onClick={() => setDivision(storeDivision === 'male' ? 'female' : 'male')}
              className={`compact-pill px-2 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                storeDivision === 'male' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-purple-500/20 text-purple-400'
              }`}
              title={storeDivision === 'male' ? 'Cowo → Cewe' : 'Cewe → Cowo'}
            >
              {storeDivision === 'male' ? '🕺' : '💃'}
            </button>
          ) : (
            <div className="flex items-center bg-muted/60 rounded-lg p-0.5 gap-0.5 w-full">
              <button
                type="button"
                onClick={() => setDivision('male')}
                className={`compact-pill flex-1 px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer text-center ${
                  storeDivision === 'male' ? 'bg-cyan-500/20 text-cyan-400 shadow-sm' : 'text-muted-foreground hover:text-foreground/70'
                }`}
              >
                🕺 Cowo
              </button>
              <button
                type="button"
                onClick={() => setDivision('female')}
                className={`compact-pill flex-1 px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer text-center ${
                  storeDivision === 'female' ? 'bg-purple-500/20 text-purple-400 shadow-sm' : 'text-muted-foreground hover:text-foreground/70'
                }`}
              >
                💃 Cewe
              </button>
            </div>
          )}
        </div>

        {/* Season Info */}
        {!collapsed && stats?.season && (
          <div className="flex items-center gap-2 px-3 py-2 mx-2 mt-2 rounded-lg bg-idm-gold-warm/[0.06] border border-idm-gold-warm/10">
            <Calendar className="w-3.5 h-3.5 text-idm-gold-warm shrink-0" />
            <span className="text-xs font-medium text-idm-gold-warm truncate">{formatTarkamSeasonName(stats.season.name, stats.season.number)}</span>
          </div>
        )}

        {/* Navigation Items */}
        <ScrollArea className="flex-1 py-2">
          <div className="space-y-0.5 px-2">
            {/* ─── Home button (go back to landing) ─── */}
            <button
              onClick={() => { setCurrentView('landing'); setSidebarOpen(false); }}
              className={`admin-sidebar-item w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                collapsed ? 'justify-center px-0' : ''
              } text-muted-foreground border border-transparent hover:bg-muted/30 hover:text-foreground/80`}
              title={collapsed ? 'Home' : undefined}
            >
              <Home className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Home</span>}
            </button>

            {/* Divider */}
            <div className={`my-1 ${collapsed ? 'mx-auto w-6' : 'mx-1'} h-px bg-border/40`} />

            {/* Admin nav items */}
            {sidebarNavItems.map(item => {
              const ItemIcon = item.icon;
              const isActive = isNavActive(item);
              const hasSubItems = item.subItems && item.subItems.length > 0;

              // Single item (no sub-items) — direct navigation
              if (!hasSubItems) {
                return (
                  <button
                    key={item.key}
                    onClick={() => navigateToTab(item.key)}
                    className={`admin-sidebar-item w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      collapsed ? 'justify-center px-0' : ''
                    } ${
                      isActive
                        ? 'bg-idm-gold-warm/12 text-idm-gold-warm border border-idm-gold-warm/20'
                        : 'text-muted-foreground border border-transparent hover:bg-muted/30 hover:text-foreground/80'
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <ItemIcon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && item.badge !== undefined && item.badge > 0 && (
                      <Badge className="text-[10px] border-0 bg-idm-gold-warm/15 text-idm-gold-warm px-1 py-0 min-w-[16px] h-4 flex items-center justify-center ml-auto">
                        {item.badge}
                      </Badge>
                    )}
                  </button>
                );
              }

              // Category with sub-items
              return (
                <div key={item.key} className="space-y-0.5">
                  {/* Category header */}
                  <button
                    onClick={() => {
                      // Navigate to first sub-item
                      const firstSub = item.subItems![0];
                      navigateToTab(firstSub.key);
                    }}
                    className={`admin-sidebar-item w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      collapsed ? 'justify-center px-0' : ''
                    } ${
                      isActive
                        ? 'text-idm-gold-warm'
                        : 'text-muted-foreground hover:text-foreground/80'
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <ItemIcon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && isActive && (
                      <ChevronDown className="w-3 h-3 ml-auto shrink-0 opacity-60" />
                    )}
                  </button>

                  {/* Sub-items — show when category is active and not collapsed */}
                  {isActive && !collapsed && (
                    <div className="ml-4 border-l border-border/30 pl-2 space-y-0.5 admin-sidebar-subitems">
                      {item.subItems!.map(sub => {
                        const SubIcon = sub.icon;
                        const isSubActive = activeTab === sub.key;
                        return (
                          <button
                            key={sub.key}
                            onClick={() => navigateToTab(sub.key)}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                              isSubActive
                                ? 'bg-idm-gold-warm/12 text-idm-gold-warm border border-idm-gold-warm/15'
                                : 'text-muted-foreground border border-transparent hover:text-foreground/70 hover:bg-muted/20'
                            }`}
                          >
                            <SubIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{sub.label}</span>
                            {sub.badge !== undefined && sub.badge > 0 && (
                              <Badge className="text-[10px] border-0 bg-idm-gold-warm/15 text-idm-gold-warm px-1 py-0 min-w-[14px] h-3.5 flex items-center justify-center ml-auto">
                                {sub.badge}
                              </Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Sidebar Footer — Admin identity + Logout + Collapse Toggle */}
        <div className="border-t border-border/30">
          {/* Admin identity + Logout (both desktop & mobile) */}
          {!collapsed && adminAuth?.isAuthenticated && (
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-idm-gold/20 shadow-[0_0_6px_rgba(239,249,35,0.2)]">
                <Shield className="w-3.5 h-3.5 text-idm-gold" />
              </div>
              <span className="text-[11px] text-foreground font-medium truncate flex-1">{adminAuth.admin?.username}</span>
              {adminAuth.admin && (
                <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-idm-gold/15 text-idm-gold uppercase tracking-wider shrink-0">
                  {adminAuth.admin.role === 'super_admin' ? 'SA' : 'ADM'}
                </span>
              )}
              <button
                onClick={async () => {
                  try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
                  clearAdminAuth();
                  setCurrentView('landing');
                  toast.success('Berhasil logout');
                }}
                className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                title="Logout"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          )}
          {collapsed && adminAuth?.isAuthenticated && (
            <div className="flex justify-center py-1.5">
              <button
                onClick={async () => {
                  try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
                  clearAdminAuth();
                  setCurrentView('landing');
                  toast.success('Berhasil logout');
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {/* Collapse Toggle (desktop only) */}
          {!isMobile && (
            <div className="p-2 border-t border-border/20">
              <button
                onClick={toggleSidebar}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${sidebarCollapsed ? '-rotate-90' : 'rotate-90'}`} />
                {!sidebarCollapsed && <span>Collapse</span>}
              </button>
            </div>
          )}
        </div>
      </>
    );
  };

  // ─── Render Tab Content ──────────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <ErrorBoundary>
            <AdminOverview division={storeDivision} onNavigateToTab={navigateToTab} onNavigateToTournament={navigateToTournament} />
          </ErrorBoundary>
        );
      case 'pending':
        return (
          <ErrorBoundary>
            <AdminPendingTab division={storeDivision} />
          </ErrorBoundary>
        );
      case 'pemain':
        return (
          <div className="space-y-4">
            {isLoadingPlayers ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="h-9 flex-1 rounded-lg bg-muted/30 animate-pulse" />
                  <div className="h-9 w-24 rounded-lg bg-muted/30 animate-pulse" />
                </div>
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border/30 bg-muted/10">
                    <div className="w-8 h-8 rounded-full bg-muted/30 animate-pulse" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-28 rounded bg-muted/30 animate-pulse" />
                      <div className="h-2.5 w-20 rounded bg-muted/20 animate-pulse" />
                    </div>
                    <div className="h-5 w-10 rounded bg-muted/20 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <AdminPlayersTab
                pendingRegistrations={pendingRegistrations || []}
                approveRegistration={approveRegistration}
                rejectRegistration={rejectRegistration}
                filteredPlayers={filteredPlayers}
                searchPlayer={searchPlayer}
                setSearchPlayer={setSearchPlayer}
                openNewPlayerForm={openNewPlayerForm}
                openEditPlayerForm={openEditPlayerForm}
                openAvatarPicker={openAvatarPicker}
                updateTier={updateTier}
                deletePlayer={deletePlayer}
                setConfirmDialog={setConfirmDialog}
                dt={dt}
                totalPlayers={playersTotal}
                hasMorePlayers={hasMorePlayers}
                isLoadingMorePlayers={isLoadingMore}
                onLoadMorePlayers={loadMorePlayers}
              />
            )}
          </div>
        );
      case 'turnamen':
        return (
          <div className="space-y-4">
            <ErrorBoundary>
              <TournamentManager division={storeDivision} dt={dt} stats={stats} setConfirmDialog={setConfirmDialog} />
            </ErrorBoundary>
          </div>
        );
      case 'club':
        return (
          <div className="space-y-4">
            <ErrorBoundary>
              <ClubManagement division={storeDivision} dt={dt} seasonId={stats?.seasonForClubs?.id || stats?.season?.id} setConfirmDialog={setConfirmDialog} />
            </ErrorBoundary>
          </div>
        );
      case 'keuangan':
        return (
          <ErrorBoundary>
            <AdminKeuanganTab
              donations={donations}
              division={storeDivision}
              addDonation={addDonation}
              approveDonation={approveDonation}
              deleteDonation={deleteDonation}
              newDonation={newDonation}
              setNewDonation={setNewDonation}
              paymentForm={paymentForm}
              updatePaymentForm={updatePaymentForm}
              savePaymentSettingsBatch={savePaymentSettingsBatch}
              setQrisPickerOpen={setQrisPickerOpen}
              setConfirmDialog={setConfirmDialog}
              dt={dt}
            />
          </ErrorBoundary>
        );
      case 'konten':
        return (
          <div className="space-y-4">
            <ErrorBoundary>
              <CmsPanel />
            </ErrorBoundary>
            <ErrorBoundary>
              <AdminDivisionContentTab />
            </ErrorBoundary>
          </div>
        );
      case 'sponsor':
        return (
          <div className="space-y-4">
            <ErrorBoundary>
              <AdminSponsorPanel />
            </ErrorBoundary>
          </div>
        );
      case 'season':
        return (
          <div className="space-y-4">
            <ErrorBoundary>
              <AdminSeasonPanel division={storeDivision} dt={dt} setConfirmDialog={setConfirmDialog} mode="tarkam" />
            </ErrorBoundary>
          </div>
        );
      case 'skin':
        return (
          <div className="space-y-4">
            <ErrorBoundary>
              <AdminSkinPanel />
            </ErrorBoundary>
          </div>
        );
      case 'pengaturan':
        return (
          <div className="space-y-4">
            <ErrorBoundary>
              <AdminSettingsPanel />
            </ErrorBoundary>
            <ErrorBoundary>
              <AdminManagement />
            </ErrorBoundary>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════
          MOBILE SIDEBAR OVERLAY
          Slides in from left with backdrop, same content as desktop
          ═══════════════════════════════════════════════════════════ */}
      {sidebarOpen && (
        <>
          {/* Backdrop — fade in */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-in fade-in duration-200"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          {/* Sidebar panel */}
          <aside className="fixed inset-y-0 left-0 z-50 w-72 lg:hidden bg-background border-r border-border/40 shadow-xl admin-sidebar-overlay flex flex-col">
            {renderSidebarContent(true)}
          </aside>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MAIN ADMIN PANEL LAYOUT — Full viewport, standalone
          Desktop: Sidebar (left) + Content (right)
          Mobile: Hamburger menu + Content (sidebar via overlay)
          ═══════════════════════════════════════════════════════════ */}
      <div className="h-full flex flex-col lg:flex-row overflow-hidden bg-background">

          {/* ─── DESKTOP SIDEBAR ──────────────────────────────────── */}
          <aside className={`hidden lg:flex flex-col h-full border-r border-border/40 admin-sidebar transition-all duration-200 shrink-0 ${
            sidebarCollapsed ? 'lg:w-16' : 'lg:w-56'
          }`}>
            {renderSidebarContent(false)}
          </aside>

          {/* ─── CONTENT AREA ──────────────────────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
            {/* Mobile Header — glass style, compact */}
            <div className="lg:hidden sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border/30">
              <div className="flex items-center gap-2 px-3 py-2">
                {/* Hamburger menu button */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted/30 transition-colors shrink-0 active:scale-95"
                  aria-label="Buka menu navigasi"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Shield className={`w-4 h-4 ${dt.neonText} shrink-0`} />
                  <h2 className="text-sm font-bold text-gradient-fury truncate">Admin</h2>
                  <Badge className="bg-red-500/10 text-red-500 text-[9px] border-0 px-1 py-0 shrink-0">ADMIN</Badge>
                </div>
                {/* Season Info — mobile inline */}
                {stats?.season && (
                  <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-idm-gold-warm/[0.06] border border-idm-gold-warm/10">
                    <Calendar className="w-3 h-3 text-idm-gold-warm shrink-0" />
                    <span className="text-[10px] font-medium text-idm-gold-warm truncate">{formatTarkamSeasonName(stats.season.name, stats.season.number)}</span>
                  </div>
                )}
                {/* Division Switcher — mobile */}
                <div className="flex items-center bg-muted/60 rounded-lg p-0.5 gap-0.5 ml-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setDivision('male')}
                    className={`compact-pill px-2 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                      storeDivision === 'male' ? 'bg-cyan-500/20 text-cyan-400 shadow-sm' : 'text-muted-foreground hover:text-foreground/70'
                    }`}
                  >
                    🕺
                  </button>
                  <button
                    type="button"
                    onClick={() => setDivision('female')}
                    className={`compact-pill px-2 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                      storeDivision === 'female' ? 'bg-purple-500/20 text-purple-400 shadow-sm' : 'text-muted-foreground hover:text-foreground/70'
                    }`}
                  >
                    💃
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop Content Header — with breadcrumb-style title */}
            <div className="hidden lg:flex items-center gap-3 px-5 py-3 border-b border-border/30 bg-muted/[0.02]">
              <h2 className="text-sm font-semibold text-foreground">
                {getTabConfig(activeTab)?.label || 'Dashboard'}
              </h2>
              {stats?.season && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-idm-gold-warm/[0.06] border border-idm-gold-warm/10">
                  <Calendar className="w-3 h-3 text-idm-gold-warm shrink-0" />
                  <span className="text-[11px] font-medium text-idm-gold-warm truncate">{formatTarkamSeasonName(stats.season.name, stats.season.number)}</span>
                  <Badge className={
                    stats.season.status === 'active'
                      ? 'text-[9px] border-0 px-1 py-0 bg-green-500/15 text-green-400'
                      : stats.season.status === 'completed'
                        ? 'text-[9px] border-0 px-1 py-0 bg-muted text-muted-foreground'
                        : 'text-[9px] border-0 px-1 py-0 bg-idm-gold-warm/15 text-idm-gold-warm'
                  }>
                    {stats.season.status === 'active' ? 'Aktif' : stats.season.status === 'completed' ? 'Selesai' : stats.season.status}
                  </Badge>
                </div>
              )}
            </div>

            {/* Content — scrollable area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-4 sm:p-5 lg:p-6 admin-tab-enter">
                {renderContent()}
              </div>
            </div>
          </div>
      </div>

      {/* ─── Dialogs ──────────────────────────────────────────────── */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDialog.onConfirm}>Lanjutkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PlayerFormDialog
        open={playerFormOpen}
        onOpenChange={setPlayerFormOpen}
        editingPlayer={editingPlayer}
        formData={formData}
        setFormData={setFormData}
        clubs={clubs || []}
        storeDivision={storeDivision}
        isPending={createPlayer.isPending || updatePlayer.isPending}
        onSubmit={handleSubmit}
      />

      <CloudinaryPicker
        open={cloudinaryOpen}
        onClose={() => setCloudinaryOpen(false)}
        onSelect={handleAvatarSelect}
        uploadFolder="avatars"
      />

      <CloudinaryPicker
        open={qrisPickerOpen}
        onClose={() => setQrisPickerOpen(false)}
        onSelect={(url) => updatePaymentForm({ donation_qris_image: url })}
        uploadFolder="cms/payment"
      />
    </>
  );
}
