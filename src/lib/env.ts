// ─── Environment Variable Resolver ───
// Maps Vercel Integration env vars (prefixed with `tarkam_`)
// to the standard names used throughout the codebase.
//
// Vercel integration provides:
//   tarkam_POSTGRES_PRISMA_URL         → DATABASE_URL
//   tarkam_POSTGRES_URL_NON_POOLING    → DIRECT_DATABASE_URL
//
// On Vercel, the integration vars are set automatically.
// Locally, the standard names come from .env directly.

/**
 * Resolve an environment variable from either the Vercel integration name
 * or the standard name. Returns the Vercel integration value if available,
 * otherwise falls back to the standard name.
 */
export function resolveEnv(standardName: string, vercelIntegrationName?: string): string | undefined {
  // Check Vercel integration name first (if provided)
  if (vercelIntegrationName) {
    const vercelValue = process.env[vercelIntegrationName]
    if (vercelValue) return vercelValue
  }
  // Fall back to standard name
  return process.env[standardName]
}

// ─── Pre-resolved values for database env vars ───
// These are used by db.ts and health check routes

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || '';
  if (!url && process.env.NODE_ENV === 'production') {
    console.error('[DB] ❌ FATAL: DATABASE_URL is not set! App cannot connect to database.');
  }
  return url;
}

export function getDirectDatabaseUrl(): string {
  return process.env.DIRECT_DATABASE_URL || '';
}
