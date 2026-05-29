import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { buildCacheHeaders, CACHE_TIER_3 } from '@/lib/cache-tiers';

export const dynamic = 'force-dynamic';

interface ActivityItem {
  id: string;
  type: 'registration' | 'match_result' | 'donation' | 'achievement' | 'top_donor' | 'live_match' | 'tournament_status' | 'mvp';
  title: string;
  description: string;
  icon: string;
  timestamp: string;
  division?: string;
}

function formatRupiah(amount: number): string {
  if (amount >= 1000000) return `Rp${(amount / 1000000).toFixed(1)}jt`;
  if (amount >= 1000) return `Rp${(amount / 1000).toFixed(0)}rb`;
  return `Rp${amount}`;
}

export async function GET() {
  const activities: ActivityItem[] = [];

  // Run all queries in parallel for performance
  const [
    recentRegistrations,
    recentMatchResults,
    recentDonations,
    recentAchievements,
    topDonors,
    liveMatches,
    recentMvp,
    activeTournaments,
  ] = await Promise.all([
    // Recent player registrations (exclude soft-deleted, last 7 days for freshness)
    db.player.findMany({
      where: { isActive: true, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        gamertag: true,
        division: true,
        createdAt: true,
      },
    }),

    // Recent completed matches (tournament bracket matches)
    db.match.findMany({
      where: { status: 'completed', tournament: { status: { in: ['main_event', 'finalization', 'completed'] } } },
      orderBy: { completedAt: 'desc' },
      take: 8,
      include: {
        team1: { select: { name: true } },
        team2: { select: { name: true } },
        mvpPlayer: { select: { gamertag: true } },
        tournament: { select: { name: true, division: true, weekNumber: true } },
      },
    }),

    // Recent approved donations
    db.donation.findMany({
      where: { status: 'approved' },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, donorName: true, amount: true, type: true, division: true, createdAt: true },
    }),

    // Recent achievement awards
    db.playerAchievement.findMany({
      orderBy: { earnedAt: 'desc' },
      take: 5,
      include: {
        player: { select: { gamertag: true, division: true } },
        achievement: { select: { displayName: true, icon: true } },
      },
    }),

    // Top donors (penyawer terbanyak) — aggregate by donorName
    db.donation.groupBy({
      by: ['donorName'],
      _sum: { amount: true },
      _count: { id: true },
      _max: { createdAt: true },
      where: { status: 'approved' },
      orderBy: { _sum: { amount: 'desc' } },
      take: 3,
    }),

    // Live matches currently in progress
    db.match.findMany({
      where: { status: 'live' },
      orderBy: { scheduledAt: 'desc' },
      take: 5,
      include: {
        team1: { select: { name: true } },
        team2: { select: { name: true } },
        tournament: { select: { name: true, division: true, weekNumber: true } },
      },
    }),

    // Recent MVP performances
    db.match.findMany({
      where: {
        status: 'completed',
        mvpPlayerId: { not: null },
        tournament: { status: { in: ['main_event', 'finalization', 'completed'] } },
      },
      orderBy: { completedAt: 'desc' },
      take: 5,
      include: {
        mvpPlayer: { select: { gamertag: true, division: true } },
        tournament: { select: { name: true, division: true, weekNumber: true } },
      },
    }),

    // Active/upcoming tournaments (status changes = new info)
    db.tournament.findMany({
      where: { status: { in: ['registration', 'main_event', 'bracket_generation'] } },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        division: true,
        weekNumber: true,
        status: true,
        updatedAt: true,
        season: { select: { name: true } },
      },
    }),
  ]);

  // ─── Active Tournaments (status updates) ───
  const statusLabels: Record<string, string> = {
    setup: 'Disiapkan',
    registration: 'Pendaftaran Dibuka',
    approval: 'Verifikasi Pemain',
    team_generation: 'Pembentukan Tim',
    bracket_generation: 'Pembuatan Bracket',
    main_event: 'Pertandingan Berlangsung',
    finalization: 'Finalisasi',
    completed: 'Selesai',
  };

  for (const t of activeTournaments) {
    const statusLabel = statusLabels[t.status] || t.status;
    const divLabel = t.division === 'male' ? '♂ Cowo' : '♀ Cewe';
    activities.push({
      id: `tstatus-${t.id}`,
      type: 'tournament_status',
      title: `W${t.weekNumber} ${divLabel}`,
      description: `${statusLabel}`,
      icon: '🏆',
      timestamp: t.updatedAt.toISOString(),
      division: t.division,
    });
  }

  // ─── Player Registrations ───
  for (const p of recentRegistrations) {
    const divLabel = p.division === 'male' ? '♂' : '♀';
    activities.push({
      id: `reg-${p.id}`,
      type: 'registration',
      title: 'Pendaftaran Baru',
      description: `${p.gamertag} ${divLabel} bergabung di tarkam`,
      icon: '👋',
      timestamp: p.createdAt.toISOString(),
      division: p.division,
    });
  }

  // ─── Match Results ───
  for (const m of recentMatchResults) {
    const s1 = m.score1 ?? 0;
    const s2 = m.score2 ?? 0;
    const team1Name = m.team1?.name || 'TBD';
    const team2Name = m.team2?.name || 'TBD';
    const isSweep = (s1 === 0 || s2 === 0) && (s1 > 0 || s2 > 0);
    const mvpTag = m.mvpPlayer ? ` • MVP: ${m.mvpPlayer.gamertag}` : '';

    activities.push({
      id: `match-${m.id}`,
      type: 'match_result',
      title: `${isSweep ? '🔥 Sweep! ' : ''}W${m.tournament.weekNumber} Pertandingan`,
      description: `${team1Name} ${s1}-${s2} ${team2Name}${mvpTag}`,
      icon: '⚔️',
      timestamp: m.completedAt?.toISOString() || m.createdAt.toISOString(),
      division: m.tournament?.division,
    });
  }

  // ─── Live Matches ───
  for (const m of liveMatches) {
    const team1Name = m.team1?.name || 'TBD';
    const team2Name = m.team2?.name || 'TBD';
    const s1 = m.score1 ?? 0;
    const s2 = m.score2 ?? 0;

    activities.push({
      id: `live-${m.id}`,
      type: 'live_match',
      title: '🔴 LIVE W' + m.tournament.weekNumber,
      description: `${team1Name} ${s1}-${s2} ${team2Name}`,
      icon: '🔴',
      timestamp: m.scheduledAt?.toISOString() || new Date().toISOString(),
      division: m.tournament?.division,
    });
  }

  // ─── MVP Performances ───
  for (const m of recentMvp) {
    if (!m.mvpPlayer) continue;
    activities.push({
      id: `mvp-${m.id}`,
      type: 'mvp',
      title: '⭐ MVP W' + (m.tournament?.weekNumber || '?'),
      description: `${m.mvpPlayer.gamertag} tampil outstanding!`,
      icon: '⭐',
      timestamp: m.completedAt?.toISOString() || m.createdAt.toISOString(),
      division: m.mvpPlayer.division,
    });
  }

  // ─── Donations ───
  for (const d of recentDonations) {
    const divLabel = d.division === 'male' ? '♂' : d.division === 'female' ? '♀' : '';
    activities.push({
      id: `don-${d.id}`,
      type: 'donation',
      title: 'Penyawer Baru',
      description: `${d.donorName} ${divLabel} menyawer ${formatRupiah(d.amount)}`,
      icon: '❤️',
      timestamp: d.createdAt.toISOString(),
      division: d.division,
    });
  }

  // ─── Top Donors (Sultan) ───
  for (let i = 0; i < topDonors.length; i++) {
    const d = topDonors[i];
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
    const total = d._sum.amount || 0;
    const count = d._count.id || 0;

    activities.push({
      id: `topdon-${d.donorName}`,
      type: 'top_donor',
      title: `${medal} Penyawer Terbanyak`,
      description: `${d.donorName} — total ${formatRupiah(total)} (${count}x sawer)`,
      icon: medal,
      timestamp: d._max.createdAt?.toISOString() || new Date().toISOString(),
    });
  }

  // ─── Achievement Awards ───
  for (const a of recentAchievements) {
    activities.push({
      id: `ach-${a.id}`,
      type: 'achievement',
      title: 'Pencapaian Baru',
      description: `${a.player.gamertag} mendapat ${a.achievement.displayName}`,
      icon: a.achievement.icon || '🏆',
      timestamp: a.earnedAt.toISOString(),
      division: a.player.division,
    });
  }

  // Sort all activities by timestamp descending
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Limit to 20 most recent
  const limited = activities.slice(0, 20);

  // ★ Time-aware cache headers — Tier 3 (dynamic): TTL adjusts based on WITA peak hours
  const headers = buildCacheHeaders(CACHE_TIER_3, 'activity');
  headers.set('Vary', 'Accept-Encoding');

  return NextResponse.json(
    { activities: limited },
    { headers }
  );
}
