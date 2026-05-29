import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getDatabaseUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  const dbUrl = getDatabaseUrl();
  const startTime = Date.now();

  try {
    // Test database connectivity
    let playerCount = 0;
    let tournamentCount = 0;

    try {
      playerCount = await db.player.count();
      tournamentCount = await db.tournament.count();
    } catch (queryErr) {
      return NextResponse.json({
        status: 'error',
        database: 'connection_failed',
        provider: 'postgresql',
        urlPrefix: dbUrl ? dbUrl.substring(0, 20) + '...' : 'NOT_SET',
        error: queryErr instanceof Error ? queryErr.message : 'Unknown error',
        hint: !dbUrl
          ? 'DATABASE_URL is not set! Add it in your deployment environment variables'
          : 'Check if the Neon database has the schema pushed (run: bun run db:push)',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      provider: 'postgresql',
      urlPrefix: dbUrl ? dbUrl.substring(0, 20) + '...' : 'NOT_SET',
      stats: {
        players: playerCount,
        tournaments: tournamentCount,
      },
      responseTimeMs: responseTime,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({
      status: 'error',
      database: 'unknown_error',
      error: err instanceof Error ? err.message : 'Unknown error',
      provider: 'postgresql',
      urlPrefix: dbUrl ? dbUrl.substring(0, 20) + '...' : 'NOT_SET',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
