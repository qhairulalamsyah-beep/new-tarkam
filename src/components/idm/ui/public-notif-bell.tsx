'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { useQuery } from '@tanstack/react-query';
import { smartRefetchInterval } from '@/lib/smart-polling';
import {
  Crown, Trophy, Swords, Bell, X,
  UserPlus, Heart, Star, Zap, Flame,
} from 'lucide-react';
import { Swords as SwordsIcon } from 'lucide-react';

/* ═══ Relative Time Formatter ═══ */
function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  if (days < 7) return `${days} hari lalu`;
  // For older items, show date
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/* ═══ Activity Type Config ═══ */
interface ActivityItem {
  id: string;
  type: 'registration' | 'match_result' | 'donation' | 'achievement' | 'top_donor' | 'live_match' | 'tournament_status' | 'mvp';
  title: string;
  description: string;
  icon: string;
  timestamp: string;
  division?: string;
}

const activityTypeConfig: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}> = {
  registration: { icon: UserPlus, color: 'text-blue-400', bgColor: 'bg-blue-400/10' },
  match_result: { icon: SwordsIcon, color: 'text-green-400', bgColor: 'bg-green-400/10' },
  donation: { icon: Heart, color: 'text-pink-400', bgColor: 'bg-pink-400/10' },
  achievement: { icon: Star, color: 'text-yellow-400', bgColor: 'bg-yellow-400/10' },
  top_donor: { icon: Crown, color: 'text-idm-gold-warm', bgColor: 'bg-idm-gold-warm/10' },
  live_match: { icon: Zap, color: 'text-red-400', bgColor: 'bg-red-400/10' },
  tournament_status: { icon: Trophy, color: 'text-idm-gold-warm', bgColor: 'bg-idm-gold-warm/10' },
  mvp: { icon: Flame, color: 'text-orange-400', bgColor: 'bg-orange-400/10' },
};

const divisionBadge: Record<string, { label: string; color: string }> = {
  male: { label: '♂', color: 'text-idm-male' },
  female: { label: '♀', color: 'text-idm-female' },
};

/* ═══ Notification Bell — Public Page (with real tournament data) ═══ */
export function PublicNotifBell({ scrolled }: { scrolled: boolean }) {
  const inMemNotifications = useAppStore(s => s.notifications);
  const removeNotification = useAppStore(s => s.removeNotification);
  const [open, setOpen] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('idm-notif-last-seen');
  });

  // Fetch real tournament activity data
  const { data: activityData } = useQuery<{ activities: ActivityItem[] }>({
    queryKey: ['tournament-notifications'],
    queryFn: () => fetch('/api/activity').then(r => r.json()),
    staleTime: 30_000,     // 30 seconds fresh
    refetchInterval: smartRefetchInterval(60_000, 300_000), // ★ Live: 60s, Idle: 5min
    refetchOnWindowFocus: false,
    gcTime: 120_000,
  });

  const activities = activityData?.activities || [];

  // Merge in-memory notifications with activity data
  // In-memory (toast-style) notifications first, then activity feed
  const allItems = [
    ...inMemNotifications.map(n => ({
      id: n.id,
      type: n.type === 'match' ? 'match_result' as const : n.type === 'donation' ? 'donation' as const : n.type === 'mvp' ? 'achievement' as const : n.type === 'victory' ? 'match_result' as const : n.type === 'streak' ? 'achievement' as const : 'registration' as const,
      title: '',
      description: n.message,
      icon: '',
      timestamp: new Date().toISOString(),
      division: undefined as string | undefined,
      isInMem: true as const,
    })),
    ...activities.map(a => ({ ...a, isInMem: false as const })),
  ];

  // Count unread: activities newer than lastSeenAt
  const unreadCount = lastSeenAt
    ? activities.filter(a => a.timestamp > lastSeenAt).length
    : Math.min(activities.length, 5); // First visit: show up to 5 as unread
  const totalBadge = unreadCount + inMemNotifications.length;

  // Mark all as read when opening
  const handleToggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && activities.length > 0) {
      const now = new Date().toISOString();
      setLastSeenAt(now);
      try { localStorage.setItem('idm-notif-last-seen', now); } catch {}
    }
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => setOpen(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  return (
    <div className="relative">
      <button
        onClick={handleToggleOpen}
        className={`btn-press compact-dot inline-flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 cursor-pointer border active:scale-95 relative ${
          scrolled
            ? 'border-idm-gold-warm/20 bg-idm-gold-warm/5 hover:bg-idm-gold-warm/15 text-idm-gold-warm'
            : 'border-foreground/10 bg-foreground/5 hover:bg-foreground/10 text-foreground/70 hover:text-foreground dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/15 dark:text-white/70 dark:hover:text-white'
        }`}
        aria-label={`Notifikasi${totalBadge > 0 ? ` (${totalBadge})` : ''}`}
      >
        <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        {totalBadge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white px-0.5 animate-pulse">
            {totalBadge > 9 ? '9+' : totalBadge}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] max-h-96 overflow-y-auto rounded-2xl border border-idm-gold-warm/15 bg-background/98 backdrop-blur-xl shadow-xl shadow-black/30 z-[60]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2.5 border-b border-idm-gold-warm/10 bg-idm-gold-warm/[0.03] flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
            <div className="flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-idm-gold-warm" />
              <span className="text-xs font-bold text-foreground">Notifikasi Turnamen</span>
            </div>
            {totalBadge > 0 && (
              <span className="text-[10px] text-idm-gold-warm font-semibold">{totalBadge} baru</span>
            )}
          </div>

          {allItems.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Belum ada notifikasi turnamen</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">Info terbaru akan muncul di sini</p>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {allItems.slice(0, 15).map(item => {
                const config = activityTypeConfig[item.type] || activityTypeConfig.registration;
                const Icon = config.icon;
                const divBadge = item.division ? divisionBadge[item.division] : null;
                const isNew = !item.isInMem && lastSeenAt && item.timestamp > lastSeenAt;

                return (
                  <div
                    key={item.id}
                    className={`px-3 py-2.5 flex items-start gap-2.5 hover:bg-muted/30 transition-colors ${isNew ? 'bg-idm-gold-warm/[0.03]' : ''}`}
                  >
                    <div className={`w-7 h-7 rounded-lg ${config.bgColor} flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {item.title && (
                        <p className="text-[11px] font-semibold text-foreground leading-tight">
                          {item.title}
                          {divBadge && <span className={`ml-1 ${divBadge.color}`}>{divBadge.label}</span>}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{item.description}</p>
                      <p className="text-[9px] text-muted-foreground/50 mt-0.5">{formatRelativeTime(item.timestamp)}</p>
                    </div>
                    {item.isInMem ? (
                      <button
                        onClick={() => removeNotification(item.id)}
                        className="text-muted-foreground/40 hover:text-muted-foreground shrink-0 mt-0.5 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    ) : isNew ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-idm-gold-warm shrink-0 mt-2 shadow-[0_0_4px_rgba(239,249,35,0.5)]" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {allItems.length > 0 && (
            <div className="px-3 py-2 border-t border-border/20 text-center">
              <button
                onClick={() => { setOpen(false); useAppStore.getState().setCurrentView('hasil'); }}
                className="text-[10px] text-idm-gold-warm hover:text-idm-gold-warm/80 font-semibold transition-colors cursor-pointer"
              >
                Lihat semua aktivitas →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
