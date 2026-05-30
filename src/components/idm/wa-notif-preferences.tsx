'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { WA_NOTIF_TYPES, type WaNotifType } from '@/lib/wa-notif';
import {
  MessageSquare, Bell, BellOff, Send, Loader2, Check, AlertCircle, Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Preference toggle type ───
interface NotifPrefs {
  id: string;
  enableTournament: boolean;
  enableMatch: boolean;
  enableResult: boolean;
  enablePrize: boolean;
  enableSeason: boolean;
  whatsapp: string | null;
}

const PREF_KEYS: { key: keyof NotifPrefs; type: WaNotifType; label: string }[] = [
  { key: 'enableTournament', type: 'tournament', label: 'Turnamen Dibuka' },
  { key: 'enableMatch',      type: 'match',      label: 'Match Dimulai' },
  { key: 'enableResult',     type: 'result',     label: 'Hasil Match' },
  { key: 'enablePrize',      type: 'prize',      label: 'Hadiah Tersedia' },
  { key: 'enableSeason',     type: 'season',     label: 'Season Champion' },
];

/**
 * WhatsApp Notification Preferences Component
 * Shows toggle switches for each notification type, linked WA number, and test button.
 */
export function WaNotifPreferences() {
  const playerAuth = useAppStore(s => s.playerAuth);
  const queryClient = useQueryClient();
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string>('');

  // Fetch preferences
  const { data: prefsData, isLoading, error } = useQuery({
    queryKey: ['wa-notif-preferences'],
    queryFn: async () => {
      const res = await fetch('/api/notifications/preferences', { credentials: 'include' });
      if (!res.ok) throw new Error('Gagal memuat preferensi');
      const json = await res.json();
      return json.data as NotifPrefs;
    },
    enabled: playerAuth.isAuthenticated,
    staleTime: 30_000,
  });

  // Update preferences mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<NotifPrefs>) => {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Gagal menyimpan preferensi');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa-notif-preferences'] });
    },
  });

  // Handle toggle
  const handleToggle = useCallback((key: keyof NotifPrefs, value: boolean) => {
    updateMutation.mutate({ [key]: value });
  }, [updateMutation]);

  // Send test notification
  const handleTest = useCallback(async () => {
    setTestStatus('sending');
    setTestMessage('');
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        setTestStatus('sent');
        setTestMessage(json.message || 'Test notifikasi dikirim!');
      } else {
        setTestStatus('error');
        setTestMessage(json.error || 'Gagal mengirim test notifikasi');
      }
    } catch {
      setTestStatus('error');
      setTestMessage('Gagal mengirim test notifikasi');
    }

    // Reset after 5 seconds
    setTimeout(() => {
      setTestStatus('idle');
      setTestMessage('');
    }, 5000);
  }, []);

  // Auto-clear test message
  useEffect(() => {
    if (testStatus !== 'idle' && testStatus !== 'sending') {
      const timer = setTimeout(() => {
        setTestStatus('idle');
        setTestMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [testStatus]);

  if (!playerAuth.isAuthenticated) {
    return (
      <div className="p-4 rounded-2xl bg-muted/5 border border-border/10">
        <div className="flex items-center gap-2 mb-2">
          <BellOff className="w-4 h-4 text-muted-foreground/40" />
          <span className="text-sm font-semibold text-muted-foreground/60">Notifikasi WA</span>
        </div>
        <p className="text-xs text-muted-foreground/50">Login untuk mengatur notifikasi WhatsApp</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 rounded-2xl bg-muted/5 border border-border/10">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-idm-gold-warm/60" />
          <span className="text-sm font-semibold">Notifikasi WA</span>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-3 w-24 bg-muted/20 rounded animate-pulse" />
              <div className="h-4 w-8 bg-muted/20 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !prefsData) {
    return (
      <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-xs text-red-500">Gagal memuat preferensi notifikasi</span>
        </div>
      </div>
    );
  }

  const waNumber = prefsData.whatsapp;
  const hasWa = !!waNumber;
  const enabledCount = PREF_KEYS.filter(k => prefsData[k.key] as boolean).length;

  return (
    <div className="p-4 rounded-2xl bg-muted/5 border border-border/10 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-green-500/3" />
        <div className="absolute -left-4 -bottom-4 w-24 h-24 rounded-full bg-idm-gold-warm/3" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-green-500" />
          <span className="text-sm font-semibold">Notifikasi WA</span>
          <Badge className="bg-green-500/15 text-green-600 text-[8px] border-0 ml-auto">
            {enabledCount}/{PREF_KEYS.length} aktif
          </Badge>
        </div>

        {/* WA Number Display */}
        <div className="flex items-center gap-2 mb-4 p-2.5 rounded-xl bg-green-500/5 border border-green-500/10">
          <Phone className="w-3.5 h-3.5 text-green-500" />
          <span className="text-xs text-muted-foreground">Nomor WA:</span>
          {hasWa ? (
            <span className="text-xs font-mono font-semibold text-green-600">{waNumber}</span>
          ) : (
            <span className="text-xs text-amber-500 font-medium">Belum terdaftar</span>
          )}
          {!hasWa && (
            <Badge className="bg-amber-500/15 text-amber-500 text-[7px] border-0 ml-auto">
              Hubungi admin
            </Badge>
          )}
        </div>

        {/* Preference Toggles */}
        <div className="space-y-2.5">
          {PREF_KEYS.map(({ key, type, label }) => {
            const typeInfo = WA_NOTIF_TYPES[type];
            const isEnabled = prefsData[key] as boolean;
            const isUpdating = updateMutation.isPending;

            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm shrink-0">{typeInfo.icon}</span>
                  <span className={`text-xs transition-colors ${
                    isEnabled ? 'text-foreground font-medium' : 'text-muted-foreground/60'
                  }`}>
                    {label}
                  </span>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked: boolean) => handleToggle(key, checked)}
                  disabled={isUpdating}
                  className="data-[state=checked]:bg-green-500"
                />
              </div>
            );
          })}
        </div>

        {/* Test Button */}
        <div className="mt-4 pt-3 border-t border-border/10">
          <button
            onClick={handleTest}
            disabled={testStatus === 'sending' || !hasWa}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all
              bg-green-500/10 text-green-600 border border-green-500/20
              hover:bg-green-500/20 hover:border-green-500/30
              disabled:opacity-40 disabled:cursor-not-allowed
              active:scale-[0.98]"
          >
            {testStatus === 'sending' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Mengirim...
              </>
            ) : testStatus === 'sent' ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Terkirim!
              </>
            ) : testStatus === 'error' ? (
              <>
                <AlertCircle className="w-3.5 h-3.5" />
                Gagal
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Test Notifikasi
              </>
            )}
          </button>

          {/* Test result message */}
          <AnimatePresence>
            {testMessage && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className={`text-[10px] text-center mt-1.5 ${
                  testStatus === 'sent' ? 'text-green-500' : 'text-amber-500'
                }`}
              >
                {testMessage}
              </motion.p>
            )}
          </AnimatePresence>

          {!hasWa && (
            <p className="text-[10px] text-center mt-1.5 text-amber-500/70">
              Nomor WA diperlukan untuk menerima notifikasi
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
