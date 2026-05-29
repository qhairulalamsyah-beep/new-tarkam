// ─── Marketplace Queries ───
// Drop-in replacements for fetch('/api/marketplace/...') calls
// Delegates to the existing API routes which use Prisma/Neon

// ── GET /api/marketplace ──
export async function getMarketplaceItems(params?: {
  category?: string
  search?: string
  status?: 'pending' | 'approved' | 'rejected' | 'all'
}) {
  const searchParams = new URLSearchParams()
  if (params?.category) searchParams.set('category', params.category)
  if (params?.search) searchParams.set('search', params.search)
  if (params?.status) searchParams.set('status', params.status)

  const response = await fetch(`/api/marketplace?${searchParams.toString()}`)
  if (!response.ok) return { items: [] }
  return response.json()
}

// ── GET /api/marketplace/[id] ──
export async function getMarketplaceItem(id: string) {
  const response = await fetch(`/api/marketplace/${id}`)
  if (!response.ok) throw new Error('Marketplace item not found')
  return response.json()
}
