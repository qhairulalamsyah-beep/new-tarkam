'use client';

import { useState, useEffect, useCallback } from 'react';
import { BellRing, X, BellOff } from 'lucide-react';
import { vapidPublicKey, urlBase64ToUint8Array } from '@/lib/push-config';
import { useAppStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Push Notification Permission Banner
 * Shows a subtle banner when push notifications aren't granted yet.
 * On grant, registers push subscription via service worker and POSTs to API.
 */
export function NotificationPushPermission() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [dismissed, setDismissed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const playerAuth = useAppStore(s => s.playerAuth);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setPermission(Notification.permission);

    // Check if user previously dismissed
    try {
      const wasDismissed = localStorage.getItem('idm-push-dismissed');
      if (wasDismissed) setDismissed(true);
    } catch {}
  }, []);

  const handleEnablePush = useCallback(async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      console.warn('[PUSH] Browser does not support notifications');
      return;
    }

    setSubscribing(true);

    try {
      // Request permission
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== 'granted') {
        setSubscribing(false);
        return;
      }

      // Register push subscription via service worker
      const registration = await navigator.serviceWorker.ready;

      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      // Send subscription to server
      const subJSON = subscription.toJSON();
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: subJSON.keys,
          userAgent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        console.error('[PUSH] Failed to save subscription on server');
      }

      console.log('[PUSH] Successfully subscribed to push notifications');
    } catch (error) {
      console.error('[PUSH] Error subscribing:', error);
    } finally {
      setSubscribing(false);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem('idm-push-dismissed', 'true');
    } catch {}
  }, []);

  // Don't show if:
  // - Already granted
  // - User dismissed
  // - Not logged in (only prompt logged-in users)
  // - Not supported
  if (
    typeof window !== 'undefined' && (
    permission === 'granted' ||
    dismissed ||
    !playerAuth.isAuthenticated
    )
  ) {
    return null;
  }

  if (typeof window !== 'undefined' && !('Notification' in window)) {
    return null;
  }

  // Permission denied — show a hint to re-enable in browser settings
  if (permission === 'denied') {
    return (
      <AnimatePresence>
        {!dismissed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 rounded-xl border border-idm-gold-warm/20 bg-background/95 backdrop-blur-xl shadow-lg shadow-black/20 p-3 flex items-start gap-3"
          >
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
              <BellOff className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">Notifikasi Diblokir</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Buka pengaturan browser untuk mengizinkan notifikasi push dari TARKAM IDM.
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground/40 hover:text-muted-foreground shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Default — ask permission
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 rounded-xl border border-idm-gold-warm/20 bg-background/95 backdrop-blur-xl shadow-lg shadow-black/20 p-3 flex items-start gap-3"
      >
        <div className="w-8 h-8 rounded-lg bg-idm-gold-warm/10 flex items-center justify-center shrink-0">
          <BellRing className="w-4 h-4 text-idm-gold-warm" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">Aktifkan Notifikasi</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Dapatkan update turnamen, hasil pertandingan, dan info penting langsung di browser kamu.
          </p>
          <button
            onClick={handleEnablePush}
            disabled={subscribing}
            className="mt-2 text-[10px] font-bold text-idm-gold-warm hover:text-idm-gold-warm/80 transition-colors cursor-pointer disabled:opacity-50"
          >
            {subscribing ? 'Mengaktifkan...' : 'Aktifkan Push →'}
          </button>
        </div>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground/40 hover:text-muted-foreground shrink-0 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
