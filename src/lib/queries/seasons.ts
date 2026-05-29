// ─── Season Queries ───
// Drop-in replacements that delegate to the existing API routes
// which use Prisma/Neon.

// Type for season detail response (matches what historical-season-view expects)
export interface SeasonDetailResponse {
  id: string;
  name: string;
  number: number;
  division: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  championPlayerId: string | null;
  championPlayer: { id: string; gamertag: string; division: string; avatar: string | null; points: number } | null;
  championClub: { id: string; name: string; logo: string | null } | null;
  championPlayerPoints: number | null;
  championPlayerSnapshot: Record<string, unknown> | null;
  players: Array<{ id: string; gamertag: string; division: string; avatar: string | null; points: number; rank: number | null; tier: string; club: string | null; tournamentCount: number }>;
  clubs: Array<Record<string, unknown>>;
  tournaments: Array<Record<string, unknown>>;
  donations: Array<Record<string, unknown>>;
  _count: { tournaments: number; clubs: number; donations: number };
}

// ── GET /api/seasons ──
export async function getSeasons(params?: { division?: string }) {
  try {
    const searchParams = new URLSearchParams()
    if (params?.division) searchParams.set('division', params.division)

    const qs = searchParams.toString()
    const url = qs ? `/api/seasons?${qs}` : '/api/seasons'

    const response = await fetch(url)
    if (!response.ok) return []
    return response.json()
  } catch {
    return []
  }
}

// ── GET /api/seasons/[id] ──
export async function getSeasonById(id: string) {
  try {
    const response = await fetch(`/api/seasons/${id}`)
    if (!response.ok) throw new Error('Season not found')
    return response.json() as Promise<SeasonDetailResponse>
  } catch {
    throw new Error('Season not found')
  }
}

// ── GET /api/season-results ──
export async function getSeasonResults(params?: { division?: string }) {
  try {
    const searchParams = new URLSearchParams()
    if (params?.division) searchParams.set('division', params.division)

    const qs = searchParams.toString()
    const url = qs ? `/api/season-results?${qs}` : '/api/season-results'

    const response = await fetch(url)
    if (!response.ok) return { weeks: [] }
    return response.json()
  } catch {
    return { weeks: [] }
  }
}
