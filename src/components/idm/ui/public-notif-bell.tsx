'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { smartRefetchInterval } from '@/lib/smart-polling';
import {
  Crown, Trophy, Swords, Bell, X, CheckCheck, BellRing,
  UserPlus, Heart, Star, Zap, Flame,
} from 'lucide-react';
import { vapidPublicKey, urlBase64ToUint8Array } from '@/lib/push-config';

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

/* ═══ DB Notification Type ═══ */
interface DbNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  icon: string | null;
  isRead: boolean;
  createdAt: string;
}

const activityTypeConfig: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}> = {
  registration: { icon: UserPlus, color: 'text-blue-400', bgColor: 'bg-blue-400/10' },
  match_result: { icon: Swords, color: 'text-green-400', bgColor: 'bg-green-400/10' },
  donation: { icon: Heart, color: 'text-pink-400', bgColor: 'bg-pink-400/10' },
  achievement: { icon: Star, color: 'text-yellow-400', bgColor: 'bg-yellow-400/10' },
  top_donor: { icon: Crown, color: 'text-idm-gold-warm', bgColor: 'bg-idm-gold-warm/10' },
  live_match: { icon: Zap, color: 'text-red-400', bgColor: 'bg-red-400/10' },
  tournament_status: { icon: Trophy, color: 'text-idm-gold-warm', bgColor: 'bg-idm-gold-warm/10' },
  mvp: { icon: Flame, color: 'text-orange-400', bgColor: 'bg-orange-400/10' },
  // DB notification types
  tournament_start: { icon: Trophy, color: 'text-idm-gold-warm', bgColor: 'bg-idm-gold-warm/10' },
  prize_claim: { icon: Crown, color: 'text-idm-gold-warm', bgColor: 'bg-idm-gold-warm/10' },
  prediction: { icon: Zap, color: 'text-purple-400', bgColor: 'bg-purple-400/10' },
  system: { icon: Bell, color: 'text-muted-foreground', bgColor: 'bg-muted/10' },
};

const divisionBadge: Record<string, { label: string; color: string }> = {
  male: { label: '♂', color: 'text-idm-male' },
  female: { label: '♀', color: 'text-idm-female' },
};

/* ═══ Notification Bell — Public Page (with real tournament data + DB notifications) ═══ */
export function PublicNotifBell({ scrolled }: { scrolled: boolean }) {
  const inMemNotifications = useAppStore(s => s.notifications);
  const removeNotification = useAppStore(s => s.removeNotification);
  const playerAuth = useAppStore(s => s.playerAuth);
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [subscribing, setSubscribing] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('idm-notif-last-seen');
  });

  // Check push permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  // Fetch DB notifications for logged-in users
  const { data: dbNotifData } = useQuery<{
    notifications: DbNotification[];
    unreadCount: number;
    hasMore: boolean;
    nextCursor: string | null;
  }>({
    queryKey: ['db-notifications'],
    queryFn: () => fetch('/api/notifications?limit=15').then(r => {
      if (!r.ok) throw new Error('Not authenticated');
      return r.json();
    }),
    enabled: playerAuth.isAuthenticated,
    staleTime: 30_000,
    refetchInterval: smartRefetchInterval(60_000, 300_000),
    refetchOnWindowFocus: true,
    gcTime: 120_000,
  });

  // Fetch real tournament activity data
  const { data: activityData } = useQuery<{ activities: ActivityItem[] }>({
    queryKey: ['tournament-notifications'],
    queryFn: () => fetch('/api/activity').then(r => r.json()),
    staleTime: 30_000,
    refetchInterval: smartRefetchInterval(60_000, 300_000),
    refetchOnWindowFocus: false,
    gcTime: 120_000,
  });

  const activities = activityData?.activities || [];
  const dbNotifications = dbNotifData?.notifications || [];
  const dbUnreadCount = dbNotifData?.unreadCount || 0;

  // Merge in-memory notifications with activity data
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

  // Count unread: activities newer than lastSeenAt + DB unread
  const activityUnreadCount = lastSeenAt
    ? activities.filter(a => a.timestamp > lastSeenAt).length
    : Math.min(activities.length, 5);
  const totalBadge = activityUnreadCount + inMemNotifications.length + dbUnreadCount;

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

  // Mark DB notification as read + navigate
  const handleDbNotifClick = useCallback(async (notif: DbNotification) => {
    if (!notif.isRead) {
      try {
        await fetch('/api/notifications/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [notif.id] }),
        });
        // Invalidate to refresh unread count
        queryClient.invalidateQueries({ queryKey: ['db-notifications'] });
      } catch {}
    }
    if (notif.url) {
      setOpen(false);
      // Navigate using the app's internal navigation if possible
      window.location.href = notif.url;
    }
  }, [queryClient]);

  // Mark all DB notifications as read
  const handleMarkAllRead = useCallback(async () => {
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      queryClient.invalidateQueries({ queryKey: ['db-notifications'] });
    } catch {}
  }, [queryClient]);

  // Enable push notifications
  const handleEnablePush = useCallback(async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    setSubscribing(true);
    try {
      const result = await Notification.requestPermission();
      setPushPermission(result);

      if (result !== 'granted') {
        setSubscribing(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      const subJSON = subscription.toJSON();
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: subJSON.keys,
          userAgent: navigator.userAgent,
        }),
      });
    } catch (error) {
      console.error('[PUSH] Error subscribing:', error);
    } finally {
      setSubscribing(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => setOpen(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  // Build notification type config for DB notification types
  const getNotifTypeConfig = (type: string) => activityTypeConfig[type] || activityTypeConfig.system;

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
          className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] max-h-[28rem] overflow-y-auto rounded-2xl border border-idm-gold-warm/15 bg-background/98 backdrop-blur-xl shadow-xl shadow-black/30 z-[60]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-3 py-2.5 border-b border-idm-gold-warm/10 bg-idm-gold-warm/[0.03] flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
            <div className="flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-idm-gold-warm" />
              <span className="text-xs font-bold text-foreground">Notifikasi</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Push enable button */}
              {pushPermission !== 'granted' && playerAuth.isAuthenticated && (
                <button
                  onClick={handleEnablePush}
                  disabled={subscribing}
                  className="text-[10px] text-idm-gold-warm hover:text-idm-gold-warm/80 font-semibold transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  <BellRing className="w-3 h-3" />
                  {subscribing ? '...' : 'Push'}
                </button>
              )}
              {totalBadge > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[10px] text-idm-gold-warm hover:text-idm-gold-warm/80 font-semibold transition-colors cursor-pointer flex items-center gap-0.5"
                >
                  <CheckCheck className="w-3 h-3" />
                  Tandai baca
                </button>
              )}
            </div>
          </div>

          {/* DB Notifications (logged-in users only) */}
          {playerAuth.isAuthenticated && dbNotifications.length > 0 && (
            <div className="divide-y divide-border/20">
              {dbNotifications.map(notif => {
                const config = getNotifTypeConfig(notif.type);
                const Icon = config.icon;
                return (
                  <div
                    key={`db-${notif.id}`}
                    onClick={() => handleDbNotifClick(notif)}
                    className={`px-3 py-2.5 flex items-start gap-2.5 hover:bg-muted/30 transition-colors cursor-pointer ${!notif.isRead ? 'bg-idm-gold-warm/[0.03]' : ''}`}
                  >
                    <div className={`w-7 h-7 rounded-lg ${config.bgColor} flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-foreground leading-tight">
                        {notif.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{notif.body}</p>
                      <p className="text-[9px] text-muted-foreground/50 mt-0.5">{formatRelativeTime(notif.createdAt)}</p>
                    </div>
                    {!notif.isRead && (
                      <span className="w-1.5 h-1.5 rounded-full bg-idm-gold-warm shrink-0 mt-2 shadow-[0_0_4px_rgba(239,249,35,0.5)]" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Separator between DB notifications and activity feed */}
          {playerAuth.isAuthenticated && dbNotifications.length > 0 && allItems.length > 0 && (
            <div className="px-3 py-1.5 border-t border-border/20 bg-muted/20">
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Aktivitas Turnamen</span>
            </div>
          )}

          {/* Activity Feed (both logged-in and anonymous) */}
          {allItems.length === 0 && !playerAuth.isAuthenticated ? (
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
