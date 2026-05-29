// ─── Data Configuration Check ───
// Always returns true — data is served via API routes → Prisma → Neon PostgreSQL.

/**
 * Check if the data layer is configured.
 * Always returns true since data comes from Neon PostgreSQL via API routes.
 */
export function isDataConfigured(): boolean {
  return true
}
