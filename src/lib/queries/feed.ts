// ─── Feed Queries ───
// Drop-in replacement for fetch('/api/feed') calls
// Delegates to the existing API route which uses Prisma/Neon

export interface FeedItem {
  id: string
  type: 'transfer' | 'donation' | 'score' | 'champion' | 'mvp' | 'registration' | 'tournament_signup'
  icon: string
  title: string
  subtitle: string
  timestamp: string
  division?: string
  accent: string
}

// ── GET /api/feed ──
export async function getActivityFeed(): Promise<{ items: FeedItem[] }> {
  const response = await fetch('/api/feed')
  if (!response.ok) return { items: [] }
  return response.json()
}
