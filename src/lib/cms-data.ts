// ═══════════════════════════════════════════════════════════
// CMS DATA FETCHER — Shared between SSR and CSR
// ═══════════════════════════════════════════════════════════
// This module provides CMS data fetching that works both
// server-side (in page.tsx) and client-side (in React Query).
// Using the same logic ensures consistency.
//
// ★ IMPORTANT: Errors are thrown (NOT caught) so that
//   unstable_cache does NOT cache empty/stale results.
//   This prevents cold-start empty-result caching bugs.

import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { withDbRetry } from '@/lib/db-resilience';

export interface CmsContent {
  settings: Record<string, string>;
  sections: Record<string, any>;
}

/**
 * Fetch CMS content directly from database.
 * Used server-side in page.tsx for SSR, and can be used
 * client-side as well.
 *
 * ★ Errors are allowed to propagate — unstable_cache does NOT
 *   cache thrown errors, only successful returns. This prevents
 *   empty results from being cached during DB cold starts.
 */
async function fetchCmsContentInner(): Promise<CmsContent> {
  const [settings, sections] = await Promise.all([
    withDbRetry(() => db.cmsSetting.findMany({ orderBy: { key: 'asc' } })),
    withDbRetry(() => db.cmsSection.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        cards: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
      },
    })),
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

  return { settings: settingsMap, sections: sectionsMap };
}

// ★ TTFB OPTIMIZATION: Cache CMS content for 300 seconds (5 min).
// Content rarely changes — admin mutations trigger revalidateTag('cms-content')
// which purges immediately, so longer cache is safe.
const fetchCmsContentCached = unstable_cache(
  fetchCmsContentInner,
  ['cms-content'],
  { revalidate: 300, tags: ['cms-content'] }
);

export async function fetchCmsContent(): Promise<CmsContent> {
  return fetchCmsContentCached();
}
