// ═══════════════════════════════════════════════════════════════
// OG DATA API — Provides CMS hero data for OG image generation
// ═══════════════════════════════════════════════════════════════
// This endpoint is called by src/app/opengraph-image.tsx to fetch
// the current hero banner data (title, subtitle, bg image, stats).
// Using a separate API route ensures proper Prisma client init
// with env resolution, avoiding the schema validation crash that
// happens when Prisma is imported directly in the OG image file.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { unstable_cache } from 'next/cache'

export const revalidate = 60 // Cache for 60 seconds

async function getOgData() {
  try {
    const [settings, playerCount, clubCount] = await Promise.all([
      db.cmsSetting.findMany({
        where: { key: { in: ['site_title', 'hero_title', 'hero_subtitle', 'hero_bg_desktop'] } }
      }),
      db.player.count(),
      db.club.count(),
    ])

    const map: Record<string, string> = {}
    for (const s of settings) map[s.key] = s.value

    return {
      siteTitle: map.site_title || 'TARKAM IDM',
      heroTitle: map.hero_title || 'TARKAM ARENA',
      heroSubtitle: map.hero_subtitle || 'FAN MADE EDITION',
      heroBgUrl: map.hero_bg_desktop || '',
      players: playerCount,
      clubs: clubCount,
    }
  } catch (error) {
    console.error('[OG-DATA] Failed to fetch:', error)
    return {
      siteTitle: 'TARKAM IDM',
      heroTitle: 'TARKAM ARENA',
      heroSubtitle: 'FAN MADE EDITION',
      heroBgUrl: '',
      players: 0,
      clubs: 0,
    }
  }
}

const getCachedOgData = unstable_cache(getOgData, ['og-data'], { revalidate: 60, tags: ['og-data', 'cms-content'] })

export async function GET() {
  const data = await getCachedOgData()
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      'Surrogate-Key': 'cms-content',
    },
  })
}
