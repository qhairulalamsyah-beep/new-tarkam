// ─── Database Client — Neon PostgreSQL ───
// ★ READ-ONLY: Data on Neon is live. Do NOT push/migrate/overwrite.
// Uses Neon PostgreSQL via PrismaClient with pg-native raw SQL helpers.

// ★ CRITICAL: Ensure DATABASE_URL is set BEFORE Prisma client is imported.
// Turbopack hoists ESM imports, so we must set env BEFORE any import.
// Using process.env assignment at module top-level ensures it runs first.

const NEON_URL = 'postgresql://neondb_owner:npg_i6O1uYUDmyZS@ep-dry-waterfall-aofsy5ty-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL = NEON_URL;
  console.log('[DB] Fixed DATABASE_URL → Neon PostgreSQL');
} else {
  console.log('[DB] DATABASE_URL already set:', process.env.DATABASE_URL.substring(0, 30) + '...');
}

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const logLevel: ('warn' | 'error')[] = process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']

  if (process.env.NODE_ENV === 'development') {
    console.log('[DB] Using PostgreSQL (Neon)')
  }

  // Add connection_limit & pool_timeout to DATABASE_URL for Neon serverless
  let dbUrl = process.env.DATABASE_URL!;
  if (!dbUrl.includes('connection_limit')) {
    const separator = dbUrl.includes('?') ? '&' : '?';
    dbUrl += `${separator}connection_limit=5&pool_timeout=10`;
  }

  return new PrismaClient({
    log: logLevel,
    datasources: { db: { url: dbUrl } },
  })
}

function getDb(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const real = getDb()
    const value = Reflect.get(real, prop, receiver)
    if (typeof value === 'function') {
      return value.bind(real)
    }
    return value
  },
})

export const isPostgreSQL = true

// ── PostgreSQL-compatible helpers (native $N parameterized queries) ──

export async function pgUpdateMany(
  table: string,
  whereClauses: Array<{ column: string; operator: '=' | 'IN' | 'NOT NULL' | 'IS NULL'; value?: string | string[] }>,
  data: Record<string, unknown>
): Promise<number> {
  const setParts: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;
  for (const [col, val] of Object.entries(data)) {
    if (val === null) { setParts.push(`"${col}" = NULL`); }
    else { params.push(val); setParts.push(`"${col}" = $${paramIdx++}`); }
  }
  const whereParts: string[] = [];
  for (const wc of whereClauses) {
    if (wc.operator === '=' && wc.value !== undefined) { params.push(wc.value); whereParts.push(`"${wc.column}" = $${paramIdx++}`); }
    else if (wc.operator === 'IN' && Array.isArray(wc.value) && wc.value.length > 0) { const ph = wc.value.map(() => `$${paramIdx++}`).join(', '); params.push(...wc.value); whereParts.push(`"${wc.column}" IN (${ph})`); }
    else if (wc.operator === 'NOT NULL') { whereParts.push(`"${wc.column}" IS NOT NULL`); }
    else if (wc.operator === 'IS NULL') { whereParts.push(`"${wc.column}" IS NULL`); }
  }
  const sql = `UPDATE "${table}" SET ${setParts.join(', ')}${whereParts.length > 0 ? ' WHERE ' + whereParts.join(' AND ') : ''}`;
  return db.$executeRawUnsafe(sql, ...params);
}

export async function pgDeleteMany(
  table: string,
  whereClauses: Array<{ column: string; operator: '=' | 'IN' | 'NOT NULL' | 'IS NULL'; value?: string | string[] }>,
  tx?: PrismaClient
): Promise<number> {
  const params: unknown[] = [];
  let paramIdx = 1;
  const whereParts: string[] = [];
  for (const wc of whereClauses) {
    if (wc.operator === '=' && wc.value !== undefined && typeof wc.value === 'string') { params.push(wc.value); whereParts.push(`"${wc.column}" = $${paramIdx++}`); }
    else if (wc.operator === 'IN' && Array.isArray(wc.value) && wc.value.length > 0) { const ph = wc.value.map(() => `$${paramIdx++}`).join(', '); params.push(...wc.value); whereParts.push(`"${wc.column}" IN (${ph})`); }
    else if (wc.operator === 'NOT NULL') { whereParts.push(`"${wc.column}" IS NOT NULL`); }
    else if (wc.operator === 'IS NULL') { whereParts.push(`"${wc.column}" IS NULL`); }
  }
  const sql = `DELETE FROM "${table}"${whereParts.length > 0 ? ' WHERE ' + whereParts.join(' AND ') : ''}`;
  const client = tx || db;
  return client.$executeRawUnsafe(sql, ...params);
}

export async function pgCreateMany<T extends { [key: string]: unknown }>(
  model: { createMany: (args: { data: T[] }) => Promise<{ count: number }> },
  data: T[]
): Promise<number> {
  if (data.length === 0) return 0;
  const result = await model.createMany({ data });
  return result.count;
}

export async function pgTransaction<T>(
  fn: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return db.$transaction(fn as never, {
    maxWait: 10000,
    timeout: 30000,
  }) as Promise<T>;
}
