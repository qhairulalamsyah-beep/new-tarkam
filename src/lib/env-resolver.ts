// ─── Environment Variable Resolver ───
// Maps Vercel integration env vars (with prefix) to standard names
// that the application code expects.
//
// Supports:
//   - Neon PostgreSQL integration
//   - Direct .env configuration

import crypto from 'crypto'

// Possible prefixes used by Vercel integrations for this project.
const POSSIBLE_PREFIXES = ['tarkam_', 'TARKAM_', 'neon_', 'NEON_', '']

function resolveEnvVar(standardName: string, alternatives: string[] = []): string | undefined {
  if (process.env[standardName]) return process.env[standardName]
  for (const prefix of POSSIBLE_PREFIXES) {
    const prefixed = `${prefix}${standardName}`
    if (process.env[prefixed]) return process.env[prefixed]
  }
  for (const alt of alternatives) {
    if (process.env[alt]) return process.env[alt]
    for (const prefix of POSSIBLE_PREFIXES) {
      const prefixedAlt = `${prefix}${alt}`
      if (process.env[prefixedAlt]) return process.env[prefixedAlt]
    }
  }
  return undefined
}

function setIfMissing(key: string, value: string | undefined, source: string): string | undefined {
  if (!value) return undefined
  if (process.env[key]) return undefined
  process.env[key] = value
  return source
}

export function resolveEnvVars(): void {
  const resolved: Array<{ key: string; source: string }> = []

  // DATABASE_URL = pooled connection
  {
    const value = resolveEnvVar('DATABASE_URL', [
      'POSTGRES_PRISMA_URL',
      'POSTGRES_URL',
      'NEON_DATABASE_URL',
    ])
    const source = setIfMissing('DATABASE_URL', value, 'Vercel integration')
    if (source) resolved.push({ key: 'DATABASE_URL', source })
  }

  // DIRECT_DATABASE_URL = direct connection for migrations
  {
    const value = resolveEnvVar('DIRECT_DATABASE_URL', [
      'POSTGRES_URL_NON_POOLING',
      'POSTGRES_NON_POOLING_URL',
    ])
    const source = setIfMissing('DIRECT_DATABASE_URL', value, 'Vercel integration')
    if (source) resolved.push({ key: 'DIRECT_DATABASE_URL', source })
  }

  // (App uses Neon PostgreSQL exclusively)

  // SESSION_SECRET — derive from DATABASE_URL if not set
  if (!process.env.SESSION_SECRET) {
    const dbUrl = process.env.DATABASE_URL
    if (dbUrl) {
      const derived = crypto.createHash('sha256').update(`session-secret:${dbUrl}`).digest('hex')
      process.env.SESSION_SECRET = derived
      resolved.push({ key: 'SESSION_SECRET', source: 'derived from DATABASE_URL' })
    } else {
      const random = crypto.randomBytes(32).toString('hex')
      process.env.SESSION_SECRET = random
      console.error('[env-resolver] ⚠ SESSION_SECRET not set and DATABASE_URL unavailable! Generated random secret.')
      resolved.push({ key: 'SESSION_SECRET', source: '⚠ RANDOM (not persistent!)' })
    }
  }

  // Log
  if (resolved.length > 0) {
    console.log(
      `[env-resolver] Resolved ${resolved.length} env var(s):\n` +
      resolved.map(r => `  ✓ ${r.key} ← ${r.source}`).join('\n')
    )
  } else {
    console.log('[env-resolver] All env vars already set — no mapping needed')
  }

  // Diagnostic
  const dbUrl = process.env.DATABASE_URL
  if (dbUrl) {
    const masked = dbUrl.length > 20
      ? dbUrl.substring(0, 15) + '***' + dbUrl.substring(dbUrl.length - 10)
      : '***'
    console.log(`[env-resolver] DATABASE_URL: ${masked}`)
  } else {
    console.error('[env-resolver] ❌ DATABASE_URL is NOT set! Database operations will fail.')
  }
}
