// ─── WhatsApp Notification Configuration ───
// Templates, rate limiting, and message formatting for WA notifications.
// All messages are in Bahasa Indonesia.

// ═══════════════════════════════════════════════
// NOTIFICATION TYPES
// ═══════════════════════════════════════════════

export type WaNotifType = 'tournament' | 'match' | 'result' | 'prize' | 'season' | 'test';

export const WA_NOTIF_TYPES: Record<WaNotifType, { label: string; icon: string; description: string }> = {
  tournament: { label: 'Turnamen Dibuka', icon: '🎮', description: 'Pendaftaran turnamen baru dibuka' },
  match:      { label: 'Match Dimulai',   icon: '⚔️', description: 'Pertandingan kamu akan dimulai' },
  result:     { label: 'Hasil Match',     icon: '🏆', description: 'Hasil pertandingan selesai' },
  prize:      { label: 'Hadiah Tersedia', icon: '🎁', description: 'Kamu berhak mendapat hadiah' },
  season:     { label: 'Season Champion', icon: '👑', description: 'Kamu menjadi Season Champion' },
  test:       { label: 'Test Notifikasi', icon: '🔔', description: 'Test notifikasi WhatsApp' },
};

// ═══════════════════════════════════════════════
// MESSAGE TEMPLATES (Bahasa Indonesia)
// ═══════════════════════════════════════════════

export interface WaTemplateData {
  // Tournament
  week?: string | number;
  url?: string;
  // Match
  opponent?: string;
  // Result
  result?: string;
  score?: string;
  // Season
  seasonName?: string;
  // General
  gamertag?: string;
  tournamentName?: string;
}

const TEMPLATES: Record<WaNotifType, (data: WaTemplateData) => string> = {
  tournament: (data) =>
    `🎮 Tarkam IDM Week ${data.week || '?'} pendaftaran dibuka! Daftar sekarang di ${data.url || 'tarkam.idm.gg'}`,

  match: (data) =>
    `⚔️ Pertandingan kamu vs ${data.opponent || 'TBA'} akan dimulai! Siap-siap!`,

  result: (data) =>
    `🏆 Pertandingan selesai! ${data.result || ''} Skor: ${data.score || '-'}. Lihat detail: ${data.url || 'tarkam.idm.gg'}`,

  prize: (data) =>
    `🎁 Selamat! Kamu berhak mendapat hadiah. Klaim sekarang di ${data.url || 'tarkam.idm.gg'}`,

  season: (data) =>
    `👑 Selamat! Kamu menjadi Season Champion${data.seasonName ? ` ${data.seasonName}` : ''}! 🎉`,

  test: (data) =>
    `🔔 Test notifikasi dari Tarkam IDM${data.gamertag ? ` untuk ${data.gamertag}` : ''}. Notifikasi WA aktif! ✅`,
};

/**
 * Format a WhatsApp notification message from template
 */
export function formatWaMessage(type: WaNotifType, data: WaTemplateData = {}): string {
  const template = TEMPLATES[type];
  if (!template) return 'Notifikasi Tarkam IDM';
  return template(data);
}

// ═══════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════

// In-memory rate limit tracker: userId → lastSentTimestamp
const rateLimitMap = new Map<string, number>();

/** Minimum interval between messages to the same user (5 minutes) */
const RATE_LIMIT_MS = 5 * 60 * 1000;

/**
 * Check if a notification can be sent to a user (rate limit check).
 * Returns true if allowed, false if rate-limited.
 * If allowed, records the current timestamp.
 */
export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const lastSent = rateLimitMap.get(userId);
  if (lastSent && now - lastSent < RATE_LIMIT_MS) {
    return false; // Rate limited
  }
  rateLimitMap.set(userId, now);
  return true;
}

/**
 * Clean up old rate limit entries (call periodically).
 * Removes entries older than 30 minutes.
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000;
  for (const [key, timestamp] of rateLimitMap.entries()) {
    if (now - timestamp > maxAge) {
      rateLimitMap.delete(key);
    }
  }
}

// Clean up every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimits, 10 * 60 * 1000);
}

// ═══════════════════════════════════════════════
// PHONE NUMBER UTILITIES
// ═══════════════════════════════════════════════

/**
 * Mask a phone number for display: 0812***5678
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 6) return '***';
  const start = phone.slice(0, 4);
  const end = phone.slice(-4);
  return `${start}***${end}`;
}

/**
 * Normalize a phone number to international format (62xxx)
 */
export function normalizeWaNumber(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  // Convert 08xx to 628xx
  if (cleaned.startsWith('08')) {
    cleaned = '62' + cleaned.slice(1);
  }
  // Already has country code
  if (cleaned.startsWith('+62')) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Validate a WhatsApp number format
 */
export function isValidWaNumber(phone: string): boolean {
  if (!phone) return false;
  const normalized = normalizeWaNumber(phone);
  // Indonesian phone: 62 followed by 8-13 digits
  return /^62\d{8,13}$/.test(normalized);
}

// ═══════════════════════════════════════════════
// WA BOT INTEGRATION
// ═══════════════════════════════════════════════

/**
 * Get the WA Bot service URL from environment.
 * The bot runs on port 3004 by default.
 */
export function getWaBotUrl(): string | null {
  return process.env.WA_BOT_URL || null;
}

/**
 * Check if the WA Bot is configured and available.
 */
export function isWaBotConfigured(): boolean {
  return !!process.env.WA_BOT_URL;
}

/**
 * Send a WhatsApp message through the bot service.
 * Returns true if sent successfully, false otherwise.
 */
export async function sendWaMessage(waNumber: string, message: string): Promise<{ success: boolean; error?: string }> {
  const botUrl = getWaBotUrl();
  
  if (!botUrl) {
    // No bot configured — return as pending (will be logged)
    return { success: false, error: 'WA Bot not configured' };
  }

  try {
    const normalized = normalizeWaNumber(waNumber);
    const response = await fetch(`${botUrl}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: normalized,
        message: message,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      return { success: true };
    }
    
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    return { success: false, error: errorData.error || `HTTP ${response.status}` };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Network error';
    return { success: false, error: errorMsg };
  }
}
