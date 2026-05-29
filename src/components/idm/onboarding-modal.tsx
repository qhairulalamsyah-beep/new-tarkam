'use client';

import { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronRight, X } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   TARKAM IDM — ONBOARDING MODAL
   Swipable 4-step cards shown on first visit.
   Tracks completion via localStorage key 'idm-onboarding-done'.
   Can be re-accessed via avatar dropdown "Panduan" menu item.
   ═══════════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'idm-onboarding-done';

export function isOnboardingDone(): boolean {
  if (typeof window === 'undefined') return true; // SSR: skip
  return localStorage.getItem(STORAGE_KEY) === '1';
}

export function markOnboardingDone(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, '1');
}

export function resetOnboarding(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

/* ═══ Step Data ═══ */
interface OnboardingStep {
  emoji: string;
  title: string;
  description: string;
  accent: string;     // gradient from color
  accentLight: string; // gradient to color
  bgPattern: string;   // subtle bg pattern class
}

const STEPS: OnboardingStep[] = [
  {
    emoji: '🎮',
    title: 'Selamat Datang',
    description: 'Tarkam IDM — Tempatnya turnamen Idol Meta mingguan. Daftar, bertanding, jadi juara!..',
    accent: '#EFF923',
    accentLight: '#a3e635',
    bgPattern: 'from-idm-gold-warm/10 via-transparent to-idm-gold-warm/5',
  },
  {
    emoji: '🏆',
    title: 'Daftar Tarkam',
    description: 'Klik tombol daftar isi form, centrang buat akun untuk membuat akun anda dan isikan passwordnya...',
    accent: '#2E9FFF',
    accentLight: '#60a5fa',
    bgPattern: 'from-idm-male/10 via-transparent to-idm-male/5',
  },
  {
    emoji: '⚔️',
    title: 'Lihat Pertandingan',
    description: 'Pantau bracket, skor live, dan hasil pertandingan real-time. Filter per divisi cowo, cewe...',
    accent: '#FF2D78',
    accentLight: '#f472b6',
    bgPattern: 'from-idm-female/10 via-transparent to-idm-female/5',
  },
  {
    emoji: '💰',
    title: 'Dukung Turnamen',
    description: 'Sawer untuk menambah hadiah dan dapat badge eksklusif sebagai sultan/supporter...',
    accent: '#22c55e',
    accentLight: '#4ade80',
    bgPattern: 'from-green-500/10 via-transparent to-green-500/5',
  },
];

/* ═══ Component ═══ */
interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export function OnboardingModal({ open, onClose, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');

  const touchStartRef = useRef<number | null>(null);
  const touchEndRef = useRef<number | null>(null);
  const MIN_SWIPE_DISTANCE = 50; // minimum px to trigger swipe

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  const goNext = useCallback(() => {
    if (isLast) {
      markOnboardingDone();
      onComplete?.();
      onClose();
      return;
    }
    setDirection('next');
    setStep(s => s + 1);
  }, [isLast, onClose, onComplete]);

  const goPrev = useCallback(() => {
    if (isFirst) return;
    setDirection('prev');
    setStep(s => s - 1);
  }, [isFirst]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchEndRef.current = null;
    touchStartRef.current = e.targetTouches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndRef.current = e.targetTouches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current || !touchEndRef.current) return;
    const distance = touchStartRef.current - touchEndRef.current;
    const isLeftSwipe = distance > MIN_SWIPE_DISTANCE;
    const isRightSwipe = distance < -MIN_SWIPE_DISTANCE;

    if (isLeftSwipe && !isLast) {
      setDirection('next');
      setStep(s => s + 1);
    }
    if (isRightSwipe && !isFirst) {
      setDirection('prev');
      setStep(s => s - 1);
    }

    touchStartRef.current = null;
    touchEndRef.current = null;
  }, [isFirst, isLast]);

  const handleSkip = useCallback(() => {
    markOnboardingDone();
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleSkip(); }}>
      <DialogContent className="sm:max-w-md w-[calc(100%-1.5rem)] p-0 gap-0 overflow-hidden border-border/50 bg-background/95 backdrop-blur-xl">
        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute top-3 right-3 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Lewati"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Step Content */}
        <div className="relative select-none" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          {/* Animated background glow */}
          <div
            className="absolute inset-0 opacity-30 transition-all duration-500"
            style={{
              background: `radial-gradient(ellipse at 50% 30%, ${current.accent}20 0%, transparent 70%)`,
            }}
          />

          <div className={`relative px-6 pt-10 pb-6 transition-all duration-300`}>
            {/* Emoji with glow */}
            <div className="flex justify-center mb-5">
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl transition-all duration-500"
                style={{
                  background: `linear-gradient(135deg, ${current.accent}15, ${current.accentLight}08)`,
                  boxShadow: `0 0 40px ${current.accent}20, 0 0 80px ${current.accent}08`,
                }}
              >
                {current.emoji}
              </div>
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-center mb-3 text-foreground">
              {current.title}
            </h2>

            {/* Description */}
            <p className="text-sm text-muted-foreground text-center leading-relaxed max-w-xs mx-auto">
              {current.description}
            </p>
          </div>
        </div>

        {/* Bottom: Dots + Actions */}
        <div className="px-6 pb-6 pt-2">
          {/* Dot indicators */}
          <div className="flex items-center justify-center gap-2 mb-5">
            {STEPS.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setDirection(i > step ? 'next' : 'prev');
                  setStep(i);
                }}
                className="transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
                aria-label={`Step ${i + 1}: ${s.title}`}
              >
                <div
                  className={`rounded-full transition-all duration-300 ${
                    i === step
                      ? 'w-6 h-2'
                      : 'w-2 h-2 bg-muted-foreground/25 hover:bg-muted-foreground/40'
                  }`}
                  style={
                    i === step
                      ? { backgroundColor: current.accent }
                      : undefined
                  }
                />
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {!isFirst ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={goPrev}
                className="text-muted-foreground hover:text-foreground"
              >
                Kembali
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-muted-foreground hover:text-foreground"
              >
                Lewati
              </Button>
            )}

            <div className="flex-1" />

            <Button
              onClick={goNext}
              size="sm"
              className="gap-1.5 font-semibold transition-all duration-200 active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${current.accent}, ${current.accentLight})`,
                color: current.accent === '#EFF923' ? '#000' : '#fff',
                boxShadow: `0 0 16px ${current.accent}30`,
              }}
            >
              {isLast ? 'Mulai Sekarang' : 'Lanjut'}
              {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
            </Button>
          </div>

          {/* Step counter */}
          <p className="text-[10px] text-muted-foreground/50 text-center mt-3">
            {step + 1} dari {STEPS.length}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
