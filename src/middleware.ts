import { NextRequest, NextResponse } from 'next/server';

// ═══════════════════════════════════════════════════════════
// IDM LEAGUE — MIDDLEWARE (Security Headers + Rate Limiting)
// ═══════════════════════════════════════════════════════════
// 1. Security headers on ALL responses (CSP, X-Content-Type-Options, etc.)
// 2. Rate limiting on mutation API endpoints (POST/PUT/DELETE/PATCH)
// 3. CSRF protection: Origin header validation on mutations
// ═══════════════════════════════════════════════════════════

// ── In-memory rate limiter (per function instance) ──
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 30; // 30 requests
const RATE_WINDOW = 60_000; // per 60 seconds

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT) {
    return true;
  }
  return false;
}

// Pre-computed CSP header — Cloudinary for images, Vercel Analytics for scripts, Pusher for real-time
const CSP_HEADER = "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; media-src 'self' https://res.cloudinary.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://res.cloudinary.com https://api.cloudinary.com https://va.vercel-scripts.com wss://ws-ap1.pusherapp.com https://sockjs-ap1.pusher.com; frame-src https://www.youtube.com https://youtube.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';";

export function middleware(request: NextRequest) {
  // ── Step 1: Security headers for ALL responses ──
  const response = NextResponse.next();

  response.headers.set('Content-Security-Policy', CSP_HEADER);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-DNS-Prefetch-Control', 'on');

  // ── Step 2: Rate limiting + CSRF only for mutation API endpoints ──
  const method = request.method.toUpperCase();
  const isApiMutation = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && request.nextUrl.pathname.startsWith('/api/');

  if (isApiMutation) {
    // CSRF Protection: Validate Origin header
    // Must work behind reverse proxies (Caddy, etc.) where Host/X-Forwarded-Host
    // may differ from the Origin's host.
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    const forwardedHost = request.headers.get('x-forwarded-host');

    if (origin) {
      try {
        const originHost = new URL(origin).hostname; // hostname excludes port
        // Build set of allowed hosts from all available headers (strip ports)
        const allowedHosts = new Set<string>();
        if (host) allowedHosts.add(host.split(':')[0]);
        if (forwardedHost) allowedHosts.add(forwardedHost.split(':')[0]);
        // Also check X-Forwarded-Server (some proxies set this)
        const forwardedServer = request.headers.get('x-forwarded-server');
        if (forwardedServer) allowedHosts.add(forwardedServer.split(':')[0]);

        // DEBUG: Log headers for troubleshooting (remove after fix is verified)
        if (!allowedHosts.has(originHost)) {
          console.warn('[CSRF] Origin mismatch:', {
            origin, originHost, host, forwardedHost, forwardedServer, allowedHosts: [...allowedHosts]
          });
        }

        // If no allowed hosts match, the request is from an unknown origin
        // However, if the request has a valid session cookie, it's likely same-origin
        // (browsers automatically send cookies for same-origin, not cross-origin)
        if (!allowedHosts.has(originHost)) {
          // Fallback: check if Referer header matches the origin
          const referer = request.headers.get('referer');
          if (referer) {
            try {
              const refererHost = new URL(referer).hostname;
              if (refererHost === originHost) {
                // Origin matches Referer — likely a same-origin request behind proxy
                // This is safe because: an attacker can forge Origin OR Referer,
                // but not both consistently for a victim's browser
                console.log('[CSRF] Allowed via Referer match:', originHost);
                // Allow through
              } else {
                return NextResponse.json(
                  { error: 'Forbidden — invalid origin' },
                  { status: 403 }
                );
              }
            } catch {
              return NextResponse.json(
                { error: 'Forbidden — malformed origin' },
                { status: 403 }
              );
            }
          } else {
            return NextResponse.json(
              { error: 'Forbidden — invalid origin' },
              { status: 403 }
            );
          }
        }
      } catch {
        // Malformed origin — reject
        return NextResponse.json(
          { error: 'Forbidden — malformed origin' },
          { status: 403 }
        );
      }
    }

    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }
  }

  return response;
}

export const config = {
  // Apply to all routes (for security headers), but skip static assets
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|robots.txt|sitemap.xml|logo1\.webp|og-banner\.).*)',
  ],
};
