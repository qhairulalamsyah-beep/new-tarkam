'use client';

import { useRef, useEffect, type ReactNode } from 'react';

/* ========== Swipe Navigation Hook (DISABLED) ========== */
export function useSwipeNavigation() {
  // Intentionally empty — users scroll freely; bottom nav provides quick section navigation.
}



/* ========== Scroll Reveal Hook ==========
  Observes all `.reveal:not(.reveal--visible)` and `.section-reveal:not(.section-reveal--visible)`
  elements and adds their respective visible class when they scroll into view.
  Uses a single persistent IntersectionObserver — NO MutationObserver.

  INP optimization: Removed MutationObserver on document.body which fired on
  every DOM change. Instead, we observe elements once on mount. For dynamically
  added elements (after data loads), they will be picked up when the section
  components re-render and their wrapper divs already have the CSS class.

  ★ ROBUSTNESS: Triple-layered reveal mechanism to prevent invisible sections:
  1. IntersectionObserver (primary) — fires when elements scroll into viewport
  2. Idle-time polling (secondary) — re-scans DOM for new elements every ~1.5s
  3. CSS failsafe (tertiary) — sr-failsafe animation forces opacity:1 after 3s
     (defined in globals.css, independent of JS)
*/
export function useScrollReveal() {
  useEffect(() => {
    // Create a single IntersectionObserver for all reveal elements
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target.classList.contains('section-reveal')) {
              entry.target.classList.add('section-reveal--visible');
            } else {
              entry.target.classList.add('reveal--visible');
            }
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px', threshold: 0.01 }
    );

    // Helper: observe all un-revealed elements
    const observeAll = () => {
      document.querySelectorAll('.reveal:not(.reveal--visible)').forEach((el) => {
        io.observe(el);
      });
      document.querySelectorAll('.section-reveal:not(.section-reveal--visible)').forEach((el) => {
        io.observe(el);
      });
    };

    // Observe all existing elements on mount
    observeAll();

    // ★ INP OPTIMIZATION: Replace MutationObserver (which fires on every DOM change
    // and blocks the main thread during interactions) with lightweight idle-time polling.
    //
    // ★ FIX: Increased scan count from 12→20 and use shorter intervals.
    // On mobile, dynamic sections (TournamentHub, HasilSection, etc.) are lazy-loaded
    // with ssr:false AND deferredQueriesReady delays their data by up to 500ms.
    // The IntersectionObserver alone misses elements that aren't in the DOM yet.
    // 20 scans over ~20s reliably catches all lazy-loaded content on slow mobile.
    let scanCount = 0;
    const maxScans = 20;
    let idleHandle: ReturnType<typeof requestIdleCallback> | null = null;

    const scanOnIdle = () => {
      if (scanCount >= maxScans) return;
      scanCount++;
      observeAll();
      // Schedule next scan during idle time
      if (typeof requestIdleCallback !== 'undefined') {
        idleHandle = requestIdleCallback(scanOnIdle, { timeout: 1500 });
      } else {
        setTimeout(scanOnIdle, 1000);
      }
    };

    // Start scanning after a brief delay (let initial render settle)
    if (typeof requestIdleCallback !== 'undefined') {
      idleHandle = requestIdleCallback(scanOnIdle, { timeout: 800 });
    } else {
      setTimeout(scanOnIdle, 300);
    }

    // ★ BACKUP: Also re-scan on scroll events (debounced).
    // On some mobile browsers, IntersectionObserver can miss elements during
    // rapid scrolling or when the page is dynamically loading content.
    // This ensures all sections get observed as the user scrolls.
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (scrollTimer) return; // Already scheduled
      scrollTimer = setTimeout(() => {
        scrollTimer = null;
        observeAll();
      }, 200);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      io.disconnect();
      if (idleHandle !== null && typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(idleHandle);
      }
      window.removeEventListener('scroll', onScroll);
      if (scrollTimer) {
        clearTimeout(scrollTimer);
      }
    };
  }, []);
}

/* ========== Shared Singleton IntersectionObserver for AnimatedSection ==========
  Prevents creating a new IntersectionObserver per AnimatedSection instance.
  On mobile, each observer costs ~2KB memory + compositor overhead.
  Sharing one observer across all instances reduces memory & INP impact.
*/
const revealObserver = typeof IntersectionObserver !== 'undefined'
  ? new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal--visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px', threshold: 0.01 }
    )
  : { observe: () => {}, unobserve: () => {} } as unknown as IntersectionObserver;

/* ========== Scroll-triggered Section Wrapper (CSS-only, Enhanced) ==========
  Premium reveal animation with blur-from + scale + opacity transition.
  Uses shared singleton IntersectionObserver to add `.reveal--visible`, triggering a
  spring-like CSS transition (cubic-bezier spring approximation).
  All GPU-only: transform, opacity, filter — no layout thrash.
*/
export function AnimatedSection({ children, className = '', variant = 'fadeUp', delay = 0 }: {
  children: ReactNode;
  className?: string;
  variant?: 'fadeUp' | 'fadeLeft' | 'fadeRight' | 'scaleIn' | 'premium' | 'slideUpSmooth';
  /** Optional stagger delay in ms */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Use shared singleton observer to avoid creating one per AnimatedSection instance
    revealObserver.observe(el);
    return () => revealObserver.unobserve(el);
  }, []);

  const variantClass = {
    fadeUp: 'reveal-fade-up',
    fadeLeft: 'reveal-fade-left',
    fadeRight: 'reveal-fade-right',
    scaleIn: 'reveal-scale-in',
    premium: 'reveal-premium',
    slideUpSmooth: 'reveal-slide-up-smooth',
  }[variant] || 'reveal-fade-up';

  return (
    <div
      ref={ref}
      className={`reveal ${variantClass} ${className}`}
      style={delay > 0 ? { animationDelay: `${delay}ms` } as React.CSSProperties : undefined}
    >
      {children}
    </div>
  );
}

/* ========== Section Header Component (Premium Enhanced) ==========
  Premium section header with:
  - Decorative accent lines flanking the label
  - Gradient text effect on title (gold shimmer)
  - Subtle background glow behind section headers
  - Compact label pill with icon
  - Professional sizing — elegant, not overwhelming
*/
export function SectionHeader({ icon: Icon, label, title, subtitle }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="relative text-center mb-6 sm:mb-8">
      {/* Label pill */}
      <div className="relative flex items-center justify-center gap-2.5 mb-3">
        <div className="h-px w-6 sm:w-10 bg-gradient-to-r from-transparent to-idm-gold/20" />
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-idm-gold/10 bg-idm-gold/[0.025]">
          <Icon className="w-3.5 h-3.5 text-idm-gold" />
          <span className="text-[10px] font-bold text-idm-gold uppercase tracking-widest">{label}</span>
        </div>
        <div className="h-px w-6 sm:w-10 bg-gradient-to-l from-transparent to-idm-gold/20" />
      </div>

      {/* Title — warm gold gradient consistent with app theme */}
      <h2 className="relative text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-idm-gold/70 via-idm-gold to-idm-gold/70 bg-clip-text text-transparent">{title}</h2>

      {/* Subtitle — lighter weight for contrast */}
      {subtitle && (
        <p className="text-[11px] sm:text-sm font-light text-muted-foreground/80 mt-2.5 max-w-lg mx-auto leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}

/* ========== Stat Card (CSS-only animation) ========== */
export function StatCard({ icon: Icon, value, label, delay }: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
  delay: number;
}) {
  const delayClass = delay <= 0.08 ? 'reveal-delay-1' : delay <= 0.16 ? 'reveal-delay-2' : delay <= 0.24 ? 'reveal-delay-3' : delay <= 0.32 ? 'reveal-delay-4' : 'reveal-delay-5';

  return (
    <div className={`reveal reveal-fade-up ${delayClass} group relative`}>
      <div className="relative p-4 sm:p-6 rounded-2xl sm:rounded-2xl border border-idm-gold-warm/10 bg-idm-gold-warm/5 dark:bg-white/[0.06] text-center transition-all duration-300 hover:shadow-[0_0_30px_color-mix(in_srgb,var(--color-idm-gold-warm)_15%,transparent)] hover:border-idm-gold-warm/20">
        <div className="absolute inset-0 rounded-2xl sm:rounded-2xl overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-idm-gold-warm/[0.02] dark:from-white/[0.04] to-transparent" />
        </div>
        <div className="relative z-10">
          <div className="w-7 h-7 sm:w-10 sm:h-10 mx-auto mb-1.5 sm:mb-3 rounded-lg sm:rounded-2xl bg-idm-gold-warm/10 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Icon className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-idm-gold-warm" />
          </div>
          <p className="text-lg sm:text-2xl font-black text-gradient-fury">
            {value}
          </p>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 sm:mt-1 uppercase tracking-wider">{label}</p>
        </div>
      </div>
    </div>
  );
}

/* ========== Premium Section Divider (Enhanced v2) ==========
  Animated gradient line divider with:
  - Pulsing gradient lines (gold shimmer sweep)
  - Glowing central diamond orb with enhanced shimmer
  - Ambient glow that breathes
  - Floating particle dots
  - CSS-only animations — no JS animation libraries.
*/
export function SectionDivider() {
  return (
    <div className="section-divider-premium max-w-4xl mx-auto" aria-hidden="true">
      {/* Left gradient line — pulsing */}
      <span className="sdp-line sdp-line-l">
        <span className="sdp-line-shimmer" />
      </span>
      {/* Center orb group */}
      <span className="sdp-center">
        <span className="sdp-orb" />
        <span className="sdp-glow" />
        <span className="sdp-dot sdp-dot-1" />
        <span className="sdp-dot sdp-dot-2" />
        <span className="sdp-dot sdp-dot-3" />
      </span>
      {/* Right gradient line — pulsing */}
      <span className="sdp-line sdp-line-r">
        <span className="sdp-line-shimmer" />
      </span>
    </div>
  );
}

/* ========== Wave Section Divider (SVG Gradient Wave) ==========
  Premium wave divider using SVG with gradient fill.
  Replaces the orb+line divider for a more modern,
  fluid section transition. Mobile-first responsive.
*/
export function WaveDivider({ variant = 'gold' }: { variant?: 'gold' | 'subtle' }) {
  // Deterministic ID to avoid hydration mismatch (no Math.random)
  const gradientId = variant === 'subtle' ? 'wave-grad-subtle' : 'wave-grad-gold';
  const opacity = variant === 'subtle' ? 0.06 : 0.12;
  return (
    <div className="relative w-full overflow-hidden -my-px" aria-hidden="true" style={{ height: '40px' }}>
      <svg
        className="absolute bottom-0 left-0 w-full"
        viewBox="0 0 1200 40"
        preserveAspectRatio="none"
        style={{ height: '40px' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--color-idm-gold-warm)" stopOpacity={opacity * 0.3} />
            <stop offset="30%" stopColor="var(--color-idm-gold-warm)" stopOpacity={opacity} />
            <stop offset="50%" stopColor="var(--color-idm-gold-warm)" stopOpacity={opacity * 1.4} />
            <stop offset="70%" stopColor="var(--color-idm-gold-warm)" stopOpacity={opacity} />
            <stop offset="100%" stopColor="var(--color-idm-gold-warm)" stopOpacity={opacity * 0.3} />
          </linearGradient>
        </defs>
        <path
          d="M0 20 Q150 0 300 15 T600 20 T900 15 T1200 20 L1200 40 L0 40 Z"
          fill={`url(#${gradientId})`}
        />
        <path
          d="M0 25 Q200 10 400 22 T800 25 T1200 22 L1200 40 L0 40 Z"
          fill={`url(#${gradientId})`}
          opacity="0.5"
        />
      </svg>
    </div>
  );
}

/* ========== Glassmorphism Card Wrapper ==========
  Adds backdrop-blur + semi-transparent background
  for a frosted glass effect. Works on dark and light themes.
*/
export function GlassCard({ children, className = '', hover = false }: {
  children: ReactNode;
  className?: string;
  /** Enable hover scale/shadow micro-interaction */
  hover?: boolean;
}) {
  return (
    <div
      className={`
        backdrop-blur-sm
        bg-white/[0.07] dark:bg-white/[0.09]
        border border-white/[0.08] dark:border-white/[0.1]
        rounded-2xl
        shadow-[0_4px_30px_rgba(0,0,0,0.1)]
        ${hover ? 'transition-all duration-300 hover:scale-[1.015] hover:shadow-[0_8px_40px_rgba(0,0,0,0.15)] hover:bg-white/[0.09] dark:hover:bg-white/[0.11] active:scale-[0.99]' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

/* ========== Interactive Card Wrapper ==========
  Adds hover micro-interactions (scale + shadow) to any card.
  Subtle and performant — uses transform + box-shadow only.
*/
export function InteractiveCard({ children, className = '', as: Tag = 'div' }: {
  children: ReactNode;
  className?: string;
  /** HTML element to render (default: div) */
  as?: React.ElementType;
}) {
  return (
    <Tag
      className={`
        transition-all duration-300 ease-out
        hover:scale-[1.02] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]
        active:scale-[0.99]
        ${className}
      `}
    >
      {children}
    </Tag>
  );
}

/* ========== Animated Gradient Border ==========
  Wraps children in a container with an animated gradient border.
  The gradient rotates around the border continuously.
  Uses CSS conic-gradient + @keyframes for performance.
*/
export function AnimatedGradientBorder({ children, className = '', colors = 'gold' }: {
  children: ReactNode;
  className?: string;
  /** Preset color scheme: 'gold' (idm-gold-warm), 'male' (idm-male), 'female' (idm-female) */
  colors?: 'gold' | 'male' | 'female';
}) {
  const colorMap = {
    gold: {
      from: 'rgba(239,249,35,0.6)',
      via: 'rgba(249,203,37,0.3)',
      to: 'rgba(239,249,35,0.6)',
      shadow: '0 0 20px rgba(239,249,35,0.15)',
    },
    male: {
      from: 'rgba(46,159,255,0.6)',
      via: 'rgba(239,249,35,0.3)',
      to: 'rgba(46,159,255,0.6)',
      shadow: '0 0 20px rgba(46,159,255,0.15)',
    },
    female: {
      from: 'rgba(255,45,120,0.6)',
      via: 'rgba(239,249,35,0.3)',
      to: 'rgba(255,45,120,0.6)',
      shadow: '0 0 20px rgba(255,45,120,0.15)',
    },
  };
  const c = colorMap[colors];

  return (
    <div className={`relative rounded-2xl p-[1.5px] animated-gradient-border ${className}`} style={{ '--agb-from': c.from, '--agb-via': c.via, '--agb-to': c.to } as React.CSSProperties}>
      {/* Animated gradient border layer */}
      <div className="absolute inset-0 rounded-2xl animated-gradient-border-bg" aria-hidden="true" />
      {/* Inner content */}
      <div className="relative rounded-2xl bg-background overflow-hidden" style={{ boxShadow: c.shadow }}>
        {children}
      </div>
    </div>
  );
}

/* ========== Backward-compatible exports (empty, no longer needed) ========== */
export const fadeUp = {};
export const fadeLeft = {};
export const fadeRight = {};
export const scaleIn = {};
export const stagger = {};
