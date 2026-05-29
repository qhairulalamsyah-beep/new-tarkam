import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// Force dynamic — prevent Next.js/Vercel from caching CMS content
export const dynamic = 'force-dynamic';

// GET all CMS content for public rendering (no auth required)
export async function GET() {
  const [settings, sections] = await Promise.all([
    db.cmsSetting.findMany({ orderBy: { key: 'asc' } }),
    db.cmsSection.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        cards: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
      },
    }),
  ]);

  // Convert settings to key-value map
  const settingsMap: Record<string, string> = {};
  for (const s of settings) {
    settingsMap[s.key] = s.value;
  }

  // Convert sections to slug-keyed map
  const sectionsMap: Record<string, typeof sections[0]> = {};
  for (const s of sections) {
    sectionsMap[s.slug] = s;
  }

  return NextResponse.json(
    { settings: settingsMap, sections: sectionsMap },
    { headers: {
      // ★ CDN cache — admin uploads trigger revalidateTag('cms-content') which purges CDN immediately
      // 60s CDN TTL is safe because admin mutations always invalidate cache.
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      'Surrogate-Key': 'cms-content',
      'Vary': 'Accept-Encoding',
    } }
  );
}
