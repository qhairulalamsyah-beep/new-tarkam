// ═══════════════════════════════════════════════════════════════
// DYNAMIC OPEN GRAPH IMAGE — Driven by Hero Banner CMS Data
// ═══════════════════════════════════════════════════════════════
// Generates a 1200x630 OG image based on the current hero banner
// settings (title, subtitle, background image) from the CMS.
// When the hero banner changes in the admin panel, this OG image
// also updates automatically — so sharing on WhatsApp, Telegram,
// Discord, etc. always shows the latest hero content.
//
// Uses Edge runtime + fetch to /api/og-data for resilience.
// The API route handles DB access with proper env resolution,
// and this file only handles the image rendering.
//
// IMPORTANT: next/og (Satori) only supports OTF/TTF fonts,
// NOT WOFF2. Fonts are fetched from Google Fonts CDN in TTF format.
//
// Cache: Revalidated every 300s — OG image data changes rarely.
// Admin CMS changes trigger on-demand revalidation via revalidateTag.
// ═══════════════════════════════════════════════════════════════

import { ImageResponse } from 'next/og'

export const alt = 'TARKAM — Fan Made Edition'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Revalidate every 300 seconds — balances freshness with performance.
// OG image content only changes when admin updates CMS (rare).
export const revalidate = 300

// ★ Use Node.js runtime for fetch compatibility
export const runtime = 'nodejs'

// TTF font URLs from Google Fonts (Satori does NOT support WOFF2)
const INTER_TTF_URLS = {
  400: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf',
  700: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf',
  900: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuBWYMZg.ttf',
}

interface OgData {
  siteTitle: string
  heroTitle: string
  heroSubtitle: string
  heroBgUrl: string
  players: number
  clubs: number
}

async function loadFonts() {
  try {
    const [regular, bold, black] = await Promise.all([
      fetch(INTER_TTF_URLS[400]).then(r => r.arrayBuffer()),
      fetch(INTER_TTF_URLS[700]).then(r => r.arrayBuffer()),
      fetch(INTER_TTF_URLS[900]).then(r => r.arrayBuffer()),
    ])
    return [
      { name: 'Inter', data: regular, weight: 400 as const, style: 'normal' as const },
      { name: 'Inter', data: bold, weight: 700 as const, style: 'normal' as const },
      { name: 'Inter', data: black, weight: 900 as const, style: 'normal' as const },
    ]
  } catch (err) {
    console.error('[og-image] Failed to load fonts from Google Fonts CDN:', err)
    // Return empty array — ImageResponse will fall back to default system font
    return []
  }
}

async function fetchOgData(): Promise<OgData> {
  const defaults: OgData = {
    siteTitle: 'TARKAM IDM',
    heroTitle: 'TARKAM ARENA',
    heroSubtitle: 'FAN MADE EDITION',
    heroBgUrl: '',
    players: 0,
    clubs: 0,
  }

  try {
    // Fetch from our own API route — uses the same Prisma client
    // as the rest of the app with proper env resolution
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    const res = await fetch(`${baseUrl}/api/og-data`, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300, tags: ['og-data'] },
    })

    if (!res.ok) return defaults
    const data = await res.json()
    return { ...defaults, ...data }
  } catch {
    return defaults
  }
}

async function fetchHeroBgImage(url: string): Promise<ArrayBuffer | null> {
  if (!url) return null
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'TarkamOG/1.0' },
    })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.startsWith('image/')) return null
    return res.arrayBuffer()
  } catch {
    return null
  }
}

export default async function OgImage() {
  const [fonts, ogData] = await Promise.all([
    loadFonts(),
    fetchOgData(),
  ])

  const { siteTitle, heroTitle, heroSubtitle, players, clubs } = ogData
  const heroBgUrl = ogData.heroBgUrl || ''

  // Fetch hero background image data
  const heroBgData = await fetchHeroBgImage(heroBgUrl)
  const heroBgDataUri = heroBgData
    ? `data:image/jpeg;base64,${Buffer.from(heroBgData).toString('base64')}`
    : null

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          backgroundColor: '#080a14',
          fontFamily: 'Inter',
          overflow: 'hidden',
        }}
      >
        {/* ── Background Image Layer ── */}
        {heroBgDataUri ? (
          <img
            src={heroBgDataUri}
            alt=""
            role="presentation"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.55,
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, #080a14 0%, #0f172a 40%, #1a0a2e 70%, #080a14 100%)',
            }}
          />
        )}

        {/* ── Dark Overlay + Vignette ── */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.6) 100%)',
          }}
        />

        {/* ── Decorative Grid ── */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundImage: 'linear-gradient(rgba(239,249,35,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(239,249,35,0.04) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* ── Top Decorative Line ── */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '3px',
            background: 'linear-gradient(90deg, transparent 0%, #EFF923 30%, #F9CB25 50%, #EFF923 70%, transparent 100%)',
          }}
        />

        {/* ── Content Container ── */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            padding: '60px 80px',
          }}
        >
          {/* ── Site Badge ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '30px',
            }}
          >
            <div style={{ width: '200px', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(239,249,35,0.5))' }} />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 18px',
                borderRadius: '20px',
                border: '1px solid rgba(239,249,35,0.25)',
                background: 'rgba(239,249,35,0.08)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(239,249,35,0.8)">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
              </svg>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(239,249,35,0.8)', letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>
                {siteTitle}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(239,249,35,0.8)">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
              </svg>
            </div>
            <div style={{ width: '200px', height: '1px', background: 'linear-gradient(270deg, transparent, rgba(239,249,35,0.5))' }} />
          </div>

          {/* ── Hero Title ── */}
          <div
            style={{
              fontSize: heroTitle.length > 25 ? '56px' : '72px',
              fontWeight: 900,
              color: '#EFF923',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.04em',
              lineHeight: 1.1,
              textAlign: 'center' as const,
              textShadow: '0 0 40px rgba(239,249,35,0.3), 0 4px 12px rgba(0,0,0,0.5)',
              marginBottom: '12px',
              maxWidth: '1000px',
            }}
          >
            {heroTitle}
          </div>

          {/* ── Decorative Underline ── */}
          <div
            style={{
              width: '400px',
              height: '2px',
              background: 'linear-gradient(90deg, transparent, #EFF923, #F9CB25, #EFF923, transparent)',
              marginBottom: '20px',
            }}
          />

          {/* ── Hero Subtitle ── */}
          <div
            style={{
              fontSize: '28px',
              fontWeight: 400,
              color: 'rgba(232,213,163,0.8)',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.2em',
              textAlign: 'center' as const,
              marginBottom: '40px',
            }}
          >
            {heroSubtitle}
          </div>

          {/* ── Stats Row ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              padding: '12px 32px',
              borderRadius: '40px',
              border: '1px solid rgba(239,249,35,0.15)',
              background: 'rgba(239,249,35,0.05)',
            }}
          >
            {/* Players */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(239,249,35,0.5)">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'rgba(239,249,35,0.85)' }}>{players}</span>
              <span style={{ fontSize: '14px', color: 'rgba(239,249,35,0.5)', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Pemain</span>
            </div>

            {/* Divider */}
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(239,249,35,0.3)' }} />

            {/* Clubs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(239,249,35,0.5)">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
              </svg>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'rgba(239,249,35,0.85)' }}>{clubs}</span>
              <span style={{ fontSize: '14px', color: 'rgba(239,249,35,0.5)', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Club</span>
            </div>
          </div>

          {/* ── Bottom URL ── */}
          <div
            style={{
              position: 'absolute',
              bottom: '30px',
              left: 0,
              right: 0,
              textAlign: 'center' as const,
              fontSize: '14px',
              fontWeight: 600,
              color: 'rgba(239,249,35,0.4)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase' as const,
            }}
          >
            idolmeta.fun
          </div>
        </div>

        {/* ── Bottom Decorative Line ── */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: '3px',
            background: 'linear-gradient(90deg, transparent 0%, #EFF923 30%, #F9CB25 50%, #EFF923 70%, transparent 100%)',
          }}
        />
      </div>
    ),
    {
      ...size,
      fonts,
    }
  )
}
