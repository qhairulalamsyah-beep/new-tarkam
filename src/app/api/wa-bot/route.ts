/**
 * WA Bot Status API
 * GET /api/wa-bot
 *
 * Proxies status info from the WA bot service.
 * On Vercel (serverless), the WA bot must be hosted externally
 * and its URL provided via WA_BOT_URL env var.
 * Falls back to "not running" if bot is offline.
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  // Determine bot base URL: env var (Vercel/production) or localhost (dev)
  const botUrl = process.env.WA_BOT_URL || 'http://127.0.0.1:3004'

  // Try direct connection to WA bot service
  try {
    const res = await fetch(`${botUrl}/status`, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      const data = await res.json()
      return NextResponse.json(data)
    }
  } catch {}

  // Fallback: try health endpoint
  try {
    const res = await fetch(`${botUrl}/health`, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      const data = await res.json()
      return NextResponse.json({
        ...data,
        waStatus: 'connecting',
        message: 'WA Bot service is starting up...',
      })
    }
  } catch {}

  return NextResponse.json({
    service: 'idm-wa-bot',
    waStatus: 'offline',
    message: 'WA Bot service is not running. Set WA_BOT_URL env var to connect to an external bot service.',
    commands: [
      { cmd: 'p help', desc: 'Bantuan & daftar command', usage: 'p help' },
      { cmd: 'p daftar', desc: 'Daftar peserta turnamen', usage: 'p daftar <nickname> <M/F> [nama] [club]' },
      { cmd: 'p info', desc: 'Cek status registrasi', usage: 'p info' },
      { cmd: 'p batal', desc: 'Batalkan registrasi', usage: 'p batal' },
      { cmd: 'p ranking', desc: 'Top 10 leaderboard', usage: 'p ranking [M/F]' },
      { cmd: 'p status', desc: 'Cek stats pemain', usage: 'p status [nickname]' },
      { cmd: 'p recap', desc: 'Recap turnamen', usage: 'p recap [M/F]' },
      { cmd: 'p next', desc: 'Match selanjutnya', usage: 'p next [nickname]' },
      { cmd: 'p live', desc: 'Match sedang berlangsung', usage: 'p live [M/F]' },
      { cmd: 'p botinfo', desc: 'Info bot', usage: 'p botinfo' },
      { cmd: 'p result', desc: 'Admin: Input hasil match', usage: 'p result <matchId> <skor1>-<skor2>' },
      { cmd: 'p mvp', desc: 'Admin: Set MVP', usage: 'p mvp <matchId> <nickname>' },
      { cmd: 'p start', desc: 'Admin: Mulai turnamen', usage: 'p start <tournamentId>' },
      { cmd: 'p end', desc: 'Admin: Akhiri turnamen', usage: 'p end <tournamentId>' },
      { cmd: 'p broadcast', desc: 'Admin: Broadcast pesan', usage: 'p broadcast <pesan>' },
      { cmd: 'p ban', desc: 'Admin: Ban player', usage: 'p ban <gamertag>' },
      { cmd: 'p unban', desc: 'Admin: Unban player', usage: 'p unban <gamertag>' },
      { cmd: 'p cekgrup', desc: 'Admin: Info grup', usage: 'p cekgrup' },
    ],
  }, { status: 503 })
}
