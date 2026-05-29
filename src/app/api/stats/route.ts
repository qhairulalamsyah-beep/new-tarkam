import { db } from '@/lib/db';
import { SEASON_TOTAL_WEEKS } from '@/lib/constants';
import { NextResponse } from 'next/server';
import { buildSkinMap } from '@/lib/build-skin-map';
import { buildCacheHeaders, buildErrorCacheHeaders, CACHE_TIER_2 } from '@/lib/cache-tiers';

// ⚠️ PRISMA-KEPT: This route uses 14+ parallel queries with complex joins, groupBy aggregations,
// deep nested includes (4+ levels), and extensive in-memory post-processing (composite scoring,
// donor matching, season snapshots, skin maps). Kept as Prisma for complex query support.
// Complex aggregation pipeline requires Prisma's groupBy and deep nested includes.

// Force dynamic — this route is never statically rendered
export const dynamic = 'force-dynamic';

// ★ Vercel serverless: 14+ parallel DB queries need more than the default 10s timeout
export const maxDuration = 60;

// ── Time-Aware Caching Strategy for /api/stats ──
// Uses CACHE_TIER_2 with dynamic TTL based on WITA peak hours.
// Peak: 45s CDN (fresh data during tournaments)
// Pre-peak: 90s CDN (warm before rush)
// Off-peak: 300s CDN (5min, save DB quota at night)
// Surrogate-Key: stats-data for targeted purge.
// Admin mutations that affect standings/scores call revalidateTag('stats-data').

export async function GET(request: Request) {
  // ★ Time-aware cache headers — TTL adjusts based on WITA peak hours
  const headers = buildCacheHeaders(CACHE_TIER_2, 'stats-data');
  headers.set('Vary', 'Accept-Encoding');

  try {
  const { searchParams } = new URL(request.url);
  const division = searchParams.get('division') || 'semua';
  const isAllDivisions = division === 'semua';
  const divisionFilter = isAllDivisions ? { in: ['male', 'female'] } : division;

  // ═══ ROUND 1: Fetch seasons (required to derive season IDs for all subsequent queries) ═══
  const allSeasons = await db.season.findMany({
    where: { division: divisionFilter, status: { in: ['active', 'completed'] } },
    orderBy: { number: 'desc' },
    include: { _count: { select: { tournaments: true } } },
  });

  const season = allSeasons[0];

  if (!season) {
    return NextResponse.json({ hasData: false, division, allSeasons: [], weeklyChampions: [], weeklyTopPerformers: [], sultanOfWeekly: [], totalPlayers: 0, approvedPlayerCount: 0 }, {
      headers: Object.fromEntries(headers.entries()),
    });
  }

  // Derive season IDs (no DB query needed — computed from allSeasons)
  const activeSeasonId = season.id;
  // Use the same season as both active & club season initially;
  // we'll determine clubSeasonId from the parallel query below
  const seasonIds = allSeasons.map(s => s.id);

  // ★ Pre-compute IDs for batched enrichment (from allSeasons, no DB query)
  const allPlayerIds = Array.from(new Set([
    ...allSeasons.filter((s: any) => s.championPlayerId).map((s: any) => s.championPlayerId as string),
    ...allSeasons.filter((s: any) => s.sultanPlayerId).map((s: any) => s.sultanPlayerId as string),
  ]));
  const completedSeasonNumbers: number[] = Array.from(new Set(
    allSeasons.filter((s: any) => s.championPlayerId && s.status === 'completed').map((s: any) => s.number as number)
  ));

  // ═══ ROUND 2: ALL queries in ONE parallel batch ═══
  // Previously: 3 sequential rounds (seasons → seasonWithClubs+activeTournament → main Promise.all → weekly batch)
  // Now: 2 rounds (seasons → EVERYTHING ELSE in parallel)
  // ★ This is the key optimization for female division which has an active tournament
  //   and was suffering from 4+ seconds due to sequential DB round-trips.
  const [
    seasonWithClubs,
    activeNonCompletedTournament,
    fallbackTournament,
    totalPlayers,
    approvedPlayerCount,
    seasonDonations,
    seasonPointsRaw,
    allDivisionPlayers,
    allClubsRaw,
    recentMatches,
    upcomingMatches,
    tournaments,
    batchPlayers,
    batchClubProfiles,
    batchClubMembers,
    _allPlayersForDonorMatchingLegacy, // ★ Replaced by targeted query below (was full table scan)
    allDivSeasonsForStats,
    // ★ Weekly batch — pre-fetched in parallel (was sequential after main batch)
    weeklyPointsRaw,
    weeklyParticipations,
    weeklyMatchesRaw,
  ] = await Promise.all([

    // ★ Season with clubs — was SEQUENTIAL before, now PARALLEL
    db.season.findFirst({
      where: {
        division: divisionFilter,
        id: { in: seasonIds },
        clubs: { some: {} },
      },
      orderBy: { number: 'desc' },
    }),

    // ★ Active Tournament (non-completed) — was SEQUENTIAL before, now PARALLEL
    db.tournament.findFirst({
      where: {
        seasonId: { in: seasonIds },
        status: { not: 'completed' },
      },
      orderBy: { weekNumber: 'desc' },
      include: {
        teams: { include: { teamPlayers: { include: { player: { select: { id: true, gamertag: true, name: true, avatar: true, tier: true, division: true } } } } } },
        matches: { select: { id: true, round: true, matchNumber: true, bracket: true, groupLabel: true, status: true, score1: true, score2: true, format: true, team1Id: true, team2Id: true, winnerId: true, loserId: true, mvpPlayerId: true, team1: { select: { id: true, name: true } }, team2: { select: { id: true, name: true } }, mvpPlayer: { select: { id: true, gamertag: true, avatar: true } } } },
        participations: { select: { id: true, playerId: true, status: true, isMvp: true, isWinner: true, player: { select: { id: true, gamertag: true, name: true, avatar: true, tier: true, division: true } } } },
        donations: { select: { id: true, donorName: true, amount: true, status: true, createdAt: true } },
      },
    }),

    // ★ Fallback Tournament (latest, any status) — runs in parallel instead of sequential fallback
    // Only used if activeNonCompletedTournament is null
    db.tournament.findFirst({
      where: { seasonId: { in: seasonIds } },
      orderBy: { weekNumber: 'desc' },
      include: {
        teams: { include: { teamPlayers: { include: { player: { select: { id: true, gamertag: true, name: true, avatar: true, tier: true, division: true } } } } } },
        matches: { select: { id: true, round: true, matchNumber: true, bracket: true, groupLabel: true, status: true, score1: true, score2: true, format: true, team1Id: true, team2Id: true, winnerId: true, loserId: true, mvpPlayerId: true, team1: { select: { id: true, name: true } }, team2: { select: { id: true, name: true } }, mvpPlayer: { select: { id: true, gamertag: true, avatar: true } } } },
        participations: { select: { id: true, playerId: true, status: true, isMvp: true, isWinner: true, player: { select: { id: true, gamertag: true, name: true, avatar: true, tier: true, division: true } } } },
        donations: { select: { id: true, donorName: true, amount: true, status: true, createdAt: true } },
      },
    }),

    // Total players
    db.player.count({ where: { division: divisionFilter, isActive: true, registrationStatus: 'approved' } }),

    // Approved/assigned player count in active tournament
    // ★ Uses activeSeasonId (latest season) — close enough for count purposes
    db.participation.count({
      where: {
        status: { in: ['approved', 'assigned'] },
        tournament: { seasonId: { in: seasonIds } },
        player: { division: divisionFilter },
      },
    }),

    // ALL approved donations for this division — query by division field for correctness
    db.donation.findMany({
      where: {
        status: 'approved',
        division: divisionFilter,
        OR: [
          { seasonId: { in: seasonIds } },
          { seasonId: null },
        ],
      },
    }),

    // Per-season points aggregation — compute from PlayerPoint records
    db.playerPoint.groupBy({
      by: ['playerId'],
      where: { seasonId: activeSeasonId },
      _sum: { amount: true },
    }),

    // All active players for this division (needed for leaderboard even if no season points)
    db.player.findMany({
      where: { division: divisionFilter, isActive: true, registrationStatus: 'approved' },
      select: {
        id: true,
        name: true,
        gamertag: true,
        avatar: true,
        tier: true,
        points: true,
        totalWins: true,
        totalMvp: true,
        streak: true,
        maxStreak: true,
        matches: true,
        division: true,
        city: true,
        isActive: true,
        clubMembers: {
          where: { leftAt: null },
          include: { profile: { select: { id: true, name: true, logo: true } } },
          take: 1,
        },
      },
    }),

    // Clubs standings — query across all seasons, will filter by clubSeasonId after
    db.club.findMany({
      where: { seasonId: { in: seasonIds } },
      orderBy: [{ points: 'desc' }, { gameDiff: 'desc' }],
      include: { profile: { include: { _count: { select: { members: true } } } }, season: { select: { name: true, division: true } } },
    }),

    // Recent matches (Tarkam: use tournament matches)
    // Only show matches from tournaments in main_event or later status
    // AND only for the requested division (avoids scanning the other division's matches)
    db.match.findMany({
      where: { status: 'completed', tournament: { status: { in: ['main_event', 'finalization', 'completed'] }, division: divisionFilter } },
      orderBy: { completedAt: 'desc' },
      take: 3,
      include: { team1: true, team2: true, mvpPlayer: true },
    }),

    // Upcoming matches (Tarkam: no upcoming matches query)
    Promise.resolve([] as any[]),

    // Tournaments list — fetch from ALL seasons for this division (not just activeSeasonId)
    // so that MVP Hall of Fame and weeklyChampions include completed seasons too
    db.tournament.findMany({
      where: { seasonId: { in: seasonIds } },
      orderBy: { weekNumber: 'asc' },
      include: {
        _count: { select: { teams: true, participations: true } },
        teams: {
          where: { isWinner: true },
          include: {
            teamPlayers: {
              include: {
                player: {
                  include: {
                    clubMembers: {
                      where: { leftAt: null },
                      include: { profile: { select: { id: true, name: true, logo: true } } },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
        participations: {
          where: { isMvp: true },
          include: { player: true },
        },
      },
    }),

    // ★ Batch: all champion + sultan players (replaces per-season findUnique)
    allPlayerIds.length > 0
      ? db.player.findMany({
          where: { id: { in: allPlayerIds } },
          include: {
            clubMembers: {
              where: { leftAt: null },
              include: { profile: { select: { id: true, name: true, logo: true } } },
              take: 1,
            },
          },
        })
      : Promise.resolve([] as any[]),

    // ★ Batch: all champion club profiles (Tarkam: not needed, empty)
    Promise.resolve([] as any[]),

    // ★ Batch: all club members for completed seasons (Tarkam: not needed for champion club)
    Promise.resolve([] as any[]),

    // ★ REMOVED: Was fetching ALL approved players across BOTH divisions (200+ rows)
    // just to match ~10-20 donor gamertags. Now done as a targeted post-batch query
    // using donor names from seasonDonations. See "Targeted donor matching query" below.
    Promise.resolve([] as any[]),

    // ★ Batch: ALL season IDs for completed season numbers (across BOTH divisions)
    completedSeasonNumbers.length > 0
      ? db.season.findMany({
          where: { number: { in: completedSeasonNumbers } },
          select: { id: true, number: true },
        })
      : Promise.resolve([] as any[]),

    // ═══ ★ Weekly Top Performers batch — pre-fetched in parallel ═══
    // Was a SEQUENTIAL round after the main batch. Now runs in parallel.
    // Queries use the active season's latest tournament (highest weekNumber in main_event+ status).
    // We query the tournament ID directly from the active season.

    // Weekly PlayerPoint groupBy — points gained per player in the latest tournament
    db.playerPoint.groupBy({
      by: ['playerId'],
      where: {
        tournament: {
          seasonId: activeSeasonId,
          status: { in: ['main_event', 'finalization', 'completed'] },
        },
      },
      _sum: { amount: true },
    }),

    // Weekly participations — for the latest tournament in the active season
    db.participation.findMany({
      where: {
        tournament: {
          seasonId: activeSeasonId,
          status: { in: ['main_event', 'finalization', 'completed'] },
        },
        status: 'approved',
      },
      include: { player: true },
      // Take only from the latest tournament — we'll filter in-memory
      orderBy: { createdAt: 'desc' },
    }),

    // Weekly completed matches — for the latest tournament in the active season
    db.match.findMany({
      where: {
        tournament: {
          seasonId: activeSeasonId,
          status: { in: ['main_event', 'finalization', 'completed'] },
        },
        status: 'completed',
      },
      include: {
        winner: { include: { teamPlayers: true } },
        loser: { include: { teamPlayers: true } },
      },
    }),
  ]);

  // ═══ Derive values from parallel results ═══
  const clubSeasonId = seasonWithClubs?.id || activeSeasonId;
  const seasonForClubs = seasonWithClubs || season;
  const activeTournament = activeNonCompletedTournament || fallbackTournament;

  // ★ Filter clubs to only the clubSeasonId (we queried across all seasonIds for parallelism)
  const clubs = (allClubsRaw as any[]).filter((c: any) => c.seasonId === clubSeasonId);

  // ═══ Build lookup maps from batched results ═══
  const playersMap = new Map((batchPlayers as any[]).map((p: any) => [p.id, p]));
  const clubProfilesMap = new Map((batchClubProfiles as any[]).map((c: any) => [c.id, c]));
  const clubMembersByProfileId = new Map<string, any[]>();
  for (const cm of batchClubMembers as any[]) {
    const existing = clubMembersByProfileId.get(cm.profileId) || [];
    existing.push(cm);
    clubMembersByProfileId.set(cm.profileId, existing);
  }

  // ═══ Build season number → IDs map from allSeasons (no DB query needed) ═══
  // Note: This map only contains seasons from the requested division(s).
  // For playerSeasonStats, we need ALL divisions' seasons for each season number,
  // because club members span both divisions. That's handled by the separate
  // allSeasonsForStats query below.
  const seasonNumberToIds = new Map<number, string[]>();
  for (const s of allSeasons) {
    const existing = seasonNumberToIds.get(s.number) || [];
    existing.push(s.id);
    seasonNumberToIds.set(s.number, existing);
  }

  // ═══ Compute per-season topPlayers leaderboard ═══
  // Build a map of playerId → per-season points from PlayerPoint aggregation
  const seasonPointsMap = new Map(seasonPointsRaw.map((sp: { playerId: string; _sum: { amount: number | null } }) => [sp.playerId, sp._sum.amount || 0]));

  // Merge: players with season points first (sorted by per-season points), then those without
  const topPlayers = (allDivisionPlayers as any[])
    .map(p => {
      const activeClub = p.clubMembers?.[0]?.profile;
      return {
        ...p,
        points: seasonPointsMap.get(p.id) || p.points, // Use per-season points if available, else lifetime points
        seasonPoints: seasonPointsMap.get(p.id) || 0,
        lifetimePoints: p.points,
        club: activeClub ? { id: activeClub.id, name: activeClub.name, logo: activeClub.logo } : undefined,
      };
    })
    .sort((a: any, b: any) => {
      if (b.seasonPoints !== a.seasonPoints) return b.seasonPoints - a.seasonPoints;
      // When season points are equal (including both 0), use lifetime points as tiebreaker
      if (b.lifetimePoints !== a.lifetimePoints) return b.lifetimePoints - a.lifetimePoints;
      if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
      return b.totalMvp - a.totalMvp;
    });

  // ═══ Secondary: buildSkinMap ═══
  // ★ Removed batchPlayerSeasonStats query — memberPlayerIds was always [] (dead code),
  //   so the query never executed. Also removed the statsByPlayerAndSeasonNumber Map
  //   that processed its (always empty) results. This saves 1 DB query per request.
  const completedTournaments = tournaments.filter(t => t.status === 'completed');

  // ═══ ★ Targeted donor matching query (replaces full-table scan) ═══
  // Previously: fetched ALL approved players across both divisions (200+ rows)
  // Now: only fetch players whose gamertag matches a donor name or whose ID is a sultanPlayerId
  // This reduces the query from O(all players) to O(donor count + sultan count) ≈ 10-30 rows
  const uniqueDonorNames = Array.from(new Set(
    (seasonDonations as any[]).map((d: any) => d.donorName).filter(Boolean)
  ));
  const sultanPlayerIds = Array.from(new Set(
    (tournaments as any[]).map((t: any) => t.sultanPlayerId).filter(Boolean)
  ));

  // Build OR conditions for targeted query
  const donorMatchConditions: any[] = [];
  if (uniqueDonorNames.length > 0) {
    donorMatchConditions.push({
      gamertag: { in: uniqueDonorNames.map((n: string) => n.toLowerCase()).concat(uniqueDonorNames) },
    });
  }
  if (sultanPlayerIds.length > 0) {
    donorMatchConditions.push({ id: { in: sultanPlayerIds } });
  }

  const allPlayersForDonorMatching = donorMatchConditions.length > 0
    ? await db.player.findMany({
        where: {
          isActive: true,
          registrationStatus: 'approved',
          OR: donorMatchConditions,
        },
        select: {
          id: true,
          name: true,
          gamertag: true,
          avatar: true,
          tier: true,
          division: true,
          clubMembers: {
            where: { leftAt: null },
            include: { profile: { select: { id: true, name: true, logo: true } } },
            take: 1,
          },
        },
      })
    : [];
  const playerIds = topPlayers.map((p: { id: string }) => p.id);

  const skinMap = await buildSkinMap({
    playerIds,
    allSeasons: allSeasons as any[],
    completedTournaments: completedTournaments as any[],
  });

  // ── Compute derived values in-memory (no extra DB queries) ──

  // Total prize pool — base prizePool from tournaments + weekly donations (saweran)
  const weeklyDonations = seasonDonations.filter(d => d.type === 'weekly');
  const donationTotal = weeklyDonations.reduce((sum, d) => sum + d.amount, 0);
  const maleDonationTotal = weeklyDonations.filter(d => d.division === 'male').reduce((sum, d) => sum + d.amount, 0);
  const femaleDonationTotal = weeklyDonations.filter(d => d.division === 'female').reduce((sum, d) => sum + d.amount, 0);

  // Sum base prize pool from all tournaments in the season (admin-inputted)
  const basePrizePoolTotal = tournaments.reduce((sum, t) => sum + (t.prizePool || 0), 0);
  const baseMalePrizePool = tournaments.filter(t => t.division === 'male').reduce((sum, t) => sum + (t.prizePool || 0), 0);
  const baseFemalePrizePool = tournaments.filter(t => t.division === 'female').reduce((sum, t) => sum + (t.prizePool || 0), 0);

  // Combined: base prize pool (admin) + saweran (donations) — SEASON AGGREGATE
  const totalPrizePool = basePrizePoolTotal + donationTotal;
  const malePrizePool = baseMalePrizePool + maleDonationTotal;
  const femalePrizePool = baseFemalePrizePool + femaleDonationTotal;

  // ═══ Active tournament prize pool — PER TOURNAMENT (for hero banner display) ═══
  // The hero banner should show only the CURRENT week's prize pool, not the season total.
  // When the "active" tournament is actually completed (fallback scenario — no new week yet),
  // the prize pool resets to 0. No active tournament = no active prize pool.
  const isActiveTournamentActuallyActive = activeTournament && activeTournament.status !== 'completed';
  const activeTournamentBasePrizePool = isActiveTournamentActuallyActive ? (activeTournament.prizePool || 0) : 0;
  const activeTournamentWeeklyDonations = isActiveTournamentActuallyActive
    ? weeklyDonations.filter(d => d.tournamentId === activeTournament.id)
    : [];
  const activeTournamentDonationTotal = activeTournamentWeeklyDonations.reduce((sum, d) => sum + d.amount, 0);
  const activeTournamentPrizePool = activeTournamentBasePrizePool + activeTournamentDonationTotal;

  // Season donation total
  const seasonDonationTotal = seasonDonations.reduce((sum, d) => sum + d.amount, 0);

  // ═══ Build cross-division player map for donor matching ═══
  // Uses allPlayersForDonorMatching (already fetched in main Promise.all)
  // Defined early so it's available for both topDonors and sultanOfWeekly enrichment
  const playerByGamertag = new Map(
    (allPlayersForDonorMatching as any[]).map((p: any) => {
      const activeClub = p.clubMembers?.[0]?.profile;
      return [p.gamertag?.toLowerCase(), { ...p, club: activeClub ? { id: activeClub.id, name: activeClub.name, logo: activeClub.logo } : null }];
    })
  );

  // Top donors — computed in-memory from seasonDonations instead of groupBy query
  const donorAccum = new Map<string, { totalAmount: number; donationCount: number }>();
  for (const d of seasonDonations) {
    const entry = donorAccum.get(d.donorName) ?? { totalAmount: 0, donationCount: 0 };
    donorAccum.set(d.donorName, {
      totalAmount: entry.totalAmount + d.amount,
      donationCount: entry.donationCount + 1,
    });
  }
  const topDonors = Array.from(donorAccum.entries())
    .map(([donorName, data]) => {
      const matchedPlayer = playerByGamertag.get(donorName?.toLowerCase());
      return {
        donorName,
        totalAmount: data.totalAmount,
        donationCount: data.donationCount,
        player: matchedPlayer ? {
          id: matchedPlayer.id,
          gamertag: matchedPlayer.gamertag,
          avatar: matchedPlayer.avatar,
          tier: matchedPlayer.tier,
          points: matchedPlayer.points,
          totalWins: matchedPlayer.totalWins,
          totalMvp: matchedPlayer.totalMvp,
          streak: matchedPlayer.streak,
          division: matchedPlayer.division,
          city: matchedPlayer.city || null,
          club: matchedPlayer.club || null,
        } : null,
      };
    })
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 50);

  // ═══ Weekly Top Donors — per active/latest tournament (for display in Top Saweran section) ═══
  // This shows donors for the CURRENT week only, so the list stays clean and relevant.
  // Season-accumulated data (topDonors) is still available for Sultan of Season calculation.
  const activeTournamentId = activeTournament?.id;
  const weeklyDonorAccum = new Map<string, { totalAmount: number; donationCount: number }>();
  for (const d of seasonDonations) {
    if (d.type !== 'weekly') continue;
    if (d.tournamentId !== activeTournamentId) continue;
    const entry = weeklyDonorAccum.get(d.donorName) ?? { totalAmount: 0, donationCount: 0 };
    weeklyDonorAccum.set(d.donorName, {
      totalAmount: entry.totalAmount + d.amount,
      donationCount: entry.donationCount + 1,
    });
  }
  const weeklyTopDonors = Array.from(weeklyDonorAccum.entries())
    .map(([donorName, data]) => ({
      donorName,
      totalAmount: data.totalAmount,
      donationCount: data.donationCount,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 50);

  // Build season lookup for tournament → season mapping
  const seasonLookup = new Map(allSeasons.map((s: { id: string; number: number; status: string }) => [s.id, s]));

  // Weekly champions — derived from completedTournaments (no new query)
  const weeklyChampions = completedTournaments.map(t => {
    const winnerTeam = t.teams[0]; // Only 1 winning team
    const mvpParticipation = t.participations.find(p => p.isMvp); // Admin-assigned MVP
    const mvpPlayer = mvpParticipation?.player;
    const tournamentSeason = seasonLookup.get(t.seasonId);
    return {
      weekNumber: t.weekNumber,
      tournamentName: t.name,
      prizePool: t.prizePool,
      completedAt: t.completedAt,
      seasonId: t.seasonId,
      seasonNumber: tournamentSeason?.number ?? 1,
      seasonStatus: tournamentSeason?.status ?? 'active',
      winnerTeam: winnerTeam ? {
        name: winnerTeam.name,
        players: winnerTeam.teamPlayers.map(tp => {
          const activeClub = (tp.player as any).clubMembers?.[0]?.profile;
          return {
            id: tp.player.id,
            gamertag: tp.player.gamertag,
            avatar: tp.player.avatar,
            tier: tp.player.tier,
            points: seasonPointsMap.get(tp.player.id) || tp.player.points,
            totalWins: tp.player.totalWins,
            totalMvp: tp.player.totalMvp,
            streak: tp.player.streak,
            matches: tp.player.matches,
            club: activeClub ? { id: activeClub.id, name: activeClub.name, logo: activeClub.logo } : null,
            city: tp.player.city || null,
          };
        }),
      } : null,
      mvp: mvpPlayer ? { id: mvpPlayer.id, gamertag: mvpPlayer.gamertag, avatar: mvpPlayer.avatar, tier: mvpPlayer.tier, totalMvp: mvpPlayer.totalMvp, points: seasonPointsMap.get(mvpPlayer.id) || mvpPlayer.points } : null,
    };
  });

  // Season progress
  const completedWeeks = tournaments.filter(t => t.status === 'completed').length;

  // MVP Hall of Fame — computed in-memory from tournament participations instead of a separate query
  const mvpHallOfFame = completedTournaments
    .flatMap(t =>
      t.participations.filter(p => p.isMvp).map(p => ({
        _sortKey: p.createdAt as Date,
        id: p.player.id,
        gamertag: p.player.gamertag,
        avatar: p.player.avatar,
        tier: p.player.tier,
        totalMvp: p.player.totalMvp,
        points: seasonPointsMap.get(p.player.id) || p.player.points,
        totalWins: p.player.totalWins,
        streak: p.player.streak,
        matches: p.player.matches,
        weekNumber: t.weekNumber,
        tournamentName: t.name,
        prizePool: t.prizePool,
        mvpScore: (p as any).mvpScore ?? null,
      }))
    )
    .sort((a, b) => +b._sortKey - +a._sortKey)
    .map(({ _sortKey, ...rest }) => rest);

  // ═══ Assemble allSeasonsInfo using batched lookup maps ═══
  // This replaces the Promise.all(allSeasons.map(async ...)) N+1 pattern
  // with synchronous map lookups over the pre-fetched batch data.
  // Type for champion player in season info
  type SeasonChampionPlayer = {
    id: string;
    gamertag: string;
    avatar?: string | null;
    tier: string;
    points: number;
    totalWins: number;
    totalMvp: number;
    streak: number;
    maxStreak: number;
    matches: number;
    club?: string | { id: string; name: string; logo?: string | null } | null;
    city?: string | null;
    division?: string;
    /** Embedded skin flag — true for all season champions (virtual skin entry)
     *  Eliminates the need for a separate skinMap lookup in components */
    hasSeasonChampionSkin?: boolean;
  };

  const allSeasonsInfo = allSeasons.map((s: any) => {
    // ── Champion player ──
    let championPlayer: SeasonChampionPlayer | null = null;

    if (s.championPlayerId) {
      // Priority 1: Use snapshot for completed seasons (preserves historical data even if player was deleted)
      if (s.championPlayerSnapshot && s.status === 'completed') {
        try {
          const snapshot = JSON.parse(s.championPlayerSnapshot);
          championPlayer = {
            id: s.championPlayerId || `snapshot-${s.id}`,
            gamertag: snapshot.gamertag || '',
            avatar: snapshot.avatar || null,
            tier: snapshot.tier || 'B',
            points: snapshot.points || 0, // Per-season points at time of closure
            totalWins: snapshot.totalWins || 0,
            totalMvp: snapshot.totalMvp || 0,
            streak: snapshot.streak || 0,
            maxStreak: snapshot.maxStreak || 0,
            matches: snapshot.matches || 0,
            club: snapshot.club || null,
            city: snapshot.city || null,
            division: snapshot.division,
            hasSeasonChampionSkin: true, // Season champions always have the virtual skin
          };

          // ★ Enrich snapshot with live data only when snapshot is missing fields.
          // Uses batched playersMap instead of per-season findUnique.
          if (!snapshot.avatar || !snapshot.city || (typeof snapshot.club === 'string' || !snapshot.club)) {
            const livePlayer = playersMap.get(s.championPlayerId);
            if (livePlayer) {
              if (!snapshot.avatar && livePlayer.avatar) {
                championPlayer.avatar = livePlayer.avatar;
              }
              if (!snapshot.city && (livePlayer as any).city) {
                championPlayer.city = (livePlayer as any).city;
              }
              if (typeof snapshot.club === 'string' || !snapshot.club) {
                const activeClub = (livePlayer as any).clubMembers?.[0]?.profile;
                if (activeClub) {
                  championPlayer.club = { id: activeClub.id, name: activeClub.name, logo: activeClub.logo };
                }
              }
            }
          }
        } catch {
          // Fallback to live data from batch
        }
      }

      // Priority 2: Query live player data from batch (for active seasons or if snapshot is missing/corrupted)
      if (!championPlayer) {
        const player = playersMap.get(s.championPlayerId);
        if (player) {
          const activeClubProfile = (player as any).clubMembers?.[0]?.profile;
          championPlayer = {
            id: player.id,
            gamertag: player.gamertag,
            avatar: player.avatar,
            tier: player.tier,
            points: s.championPlayerPoints ?? player.points, // Use snapshot per-season points if available
            totalWins: player.totalWins,
            totalMvp: player.totalMvp,
            streak: player.streak,
            maxStreak: player.maxStreak,
            matches: player.matches,
            club: activeClubProfile ? { id: activeClubProfile.id, name: activeClubProfile.name, logo: activeClubProfile.logo } : null,
            city: player.city || null,
            division: player.division,
            hasSeasonChampionSkin: true, // Season champions always have the virtual skin
          };
        }
      }
    }

    // ── Champion club ── (Tarkam mode: not used, always null)
    const championClub = null;

    // ── Sultan of Season (top penyawer) ──
    // Uses batched playersMap instead of per-season findUnique.
    let sultanPlayer: { id: string; gamertag: string; avatar: string | null; division: string; tier: string; points: number; city: string | null; club: { id: string; name: string; logo: string | null } | null } | null = null;
    if (s.sultanPlayerId) {
      const sultan = playersMap.get(s.sultanPlayerId);
      if (sultan) {
        const activeClub = (sultan as any).clubMembers?.[0]?.profile;
        sultanPlayer = {
          id: sultan.id,
          gamertag: sultan.gamertag,
          avatar: sultan.avatar,
          division: sultan.division,
          tier: sultan.tier,
          points: sultan.points,
          city: sultan.city || null,
          club: activeClub ? { id: activeClub.id, name: activeClub.name, logo: activeClub.logo } : null,
        };
      }
    }

    return {
      id: s.id,
      name: s.name,
      number: s.number,
      status: s.status,
      startDate: s.startDate,
      endDate: s.endDate,
      tournamentCount: s._count?.tournaments ?? 0,
      championPlayerId: s.championPlayerId,
      championPlayer,
      sultanPlayerId: s.sultanPlayerId,
      sultanPlayer,
    };
  });

  // ── Flatten club data for frontend compatibility ──
  // New schema: Club has profileId → ClubProfile (name, logo, bannerImage)
  // Frontend expects: { id, name, logo, wins, losses, points, gameDiff, _count: { members } }
  const flatClubs = clubs.map((c: any) => ({
    id: c.id,
    name: c.profile?.name || '',
    logo: c.profile?.logo || null,
    bannerImage: c.profile?.bannerImage || null,
    division: c.division,
    seasonId: c.seasonId,
    wins: c.wins,
    losses: c.losses,
    points: c.points,
    gameDiff: c.gameDiff,
    _count: { members: c.profile?._count?.members || 0 },
    profileId: c.profileId,
  }));

  // Flatten matches (club1/club2 now have nested profile)
  const flatRecentMatches = recentMatches.map((m: any) => ({
    ...m, club1: { id: m.club1?.id, name: m.club1?.profile?.name, logo: m.club1?.profile?.logo }, club2: { id: m.club2?.id, name: m.club2?.profile?.name, logo: m.club2?.profile?.logo },
  }));
  const flatUpcomingMatches = upcomingMatches.map((m: any) => ({
    ...m, club1: { id: m.club1?.id, name: m.club1?.profile?.name, logo: m.club1?.profile?.logo }, club2: { id: m.club2?.id, name: m.club2?.profile?.name, logo: m.club2?.profile?.logo },
  }));
  // Tarkam: no league/playoff matches
  const flatPlayoffMatches: any[] = [];
  const flatLeagueMatches: any[] = [];

  // ═══ Compute Weekly Top Performers — "Bintang Minggu Ini" ═══
  // Composite score: points gained this week (40%), win rate (25%),
  // streak (15%), tournament winner bonus (10%), tier underdog bonus (10%)
  // Tie-break: lower tier wins (S=3, A=2, B=1 — lower = better underdog)
  let weeklyTopPerformers: any[] = [];

  // Find the latest tournament for the active season (completed or in-progress)
  const latestTournament = [...tournaments]
    .filter(t => t.seasonId === activeSeasonId && ['main_event', 'finalization', 'completed'].includes(t.status))
    .sort((a, b) => b.weekNumber - a.weekNumber)[0];

  if (latestTournament) {
    // ★ Use pre-fetched weekly data from the main Promise.all (no extra DB round-trip!)
    // Filter to only the latest tournament's data
    const filteredWeeklyPoints = (weeklyPointsRaw as any[]).filter(
      (wp: any) => wp.playerId && topPlayers.some((p: any) => p.id === wp.playerId)
    );
    const filteredWeeklyParts = (weeklyParticipations as any[]).filter(
      (p: any) => p.tournamentId === latestTournament.id
    );
    const filteredWeeklyMatches = (weeklyMatchesRaw as any[]).filter(
      (m: any) => m.tournamentId === latestTournament.id
    );

    // Build map: playerId → { matchWins, matchLosses } from actual match results
    const matchStatsMap = new Map<string, { wins: number; losses: number }>();
    for (const match of filteredWeeklyMatches) {
      if (match.winner?.teamPlayers) {
        for (const tp of match.winner.teamPlayers) {
          const existing = matchStatsMap.get(tp.playerId) || { wins: 0, losses: 0 };
          existing.wins++;
          matchStatsMap.set(tp.playerId, existing);
        }
      }
      if (match.loser?.teamPlayers) {
        for (const tp of match.loser.teamPlayers) {
          const existing = matchStatsMap.get(tp.playerId) || { wins: 0, losses: 0 };
          existing.losses++;
          matchStatsMap.set(tp.playerId, existing);
        }
      }
    }

    // Build map: playerId → points gained this week
    const weeklyPointsMap = new Map(
      filteredWeeklyPoints.map((wp: { playerId: string; _sum: { amount: number | null } }) => [wp.playerId, wp._sum.amount || 0])
    );

    // Build map: playerId → participation data
    const weeklyPartMap = new Map(
      filteredWeeklyParts.map((p: any) => [p.playerId, p])
    );

    // Build map: playerId → player from topPlayers (has season points, tier, streak, etc.)
    const topPlayersMap = new Map(
      topPlayers.map((p: any) => [p.id, p])
    );

    // Collect all players who earned points this week
    const candidates: any[] = [];
    for (const [playerId, weeklyPts] of weeklyPointsMap) {
      const player = topPlayersMap.get(playerId);
      if (!player) continue;

      const part = weeklyPartMap.get(playerId);
      const matchStats = matchStatsMap.get(playerId) || { wins: 0, losses: 0 };
      const totalMatches = matchStats.wins + matchStats.losses;
      const matchWinRate = totalMatches > 0 ? Math.round((matchStats.wins / totalMatches) * 100) : 0;

      candidates.push({
        id: player.id,
        gamertag: player.gamertag,
        avatar: player.avatar,
        tier: player.tier || 'B',
        points: player.seasonPoints ?? player.points ?? 0,
        weeklyPointsGained: weeklyPts,
        weeklyWins: matchStats.wins,
        weeklyLosses: matchStats.losses,
        weeklyMatches: totalMatches,
        weeklyWinRate: matchWinRate,
        streak: player.streak ?? 0,
        city: player.city,
        club: player.clubMembers?.[0]?.profile?.name ?? null,
      });
    }

    // Also include players who participated but may not have PlayerPoint records yet
    for (const [playerId, part] of weeklyPartMap) {
      if (weeklyPointsMap.has(playerId)) continue; // Already processed
      const player = topPlayersMap.get(playerId);
      if (!player) continue;

      const matchStats = matchStatsMap.get(playerId) || { wins: 0, losses: 0 };
      const totalMatches = matchStats.wins + matchStats.losses;
      const matchWinRate = totalMatches > 0 ? Math.round((matchStats.wins / totalMatches) * 100) : 0;

      candidates.push({
        id: player.id,
        gamertag: player.gamertag,
        avatar: player.avatar,
        tier: player.tier || 'B',
        points: player.seasonPoints ?? player.points ?? 0,
        weeklyPointsGained: part.pointsEarned ?? 0,
        weeklyWins: matchStats.wins,
        weeklyLosses: matchStats.losses,
        weeklyMatches: totalMatches,
        weeklyWinRate: matchWinRate,
        streak: player.streak ?? 0,
        city: player.city,
        club: player.clubMembers?.[0]?.profile?.name ?? null,
      });
    }

    // ═══ Compute Composite Score ═══
    // Normalize each factor to 0-100 scale, then apply weights
    // UPDATED: Win rate now uses match-level W/L instead of tournament-level isWinner
    if (candidates.length > 0) {
      const maxWeeklyPts = Math.max(...candidates.map(c => c.weeklyPointsGained), 1);
      const maxStreak = Math.max(...candidates.map(c => c.streak), 1);

      // Tier underdog score: B=100, A=50, S=0 (lower tier = higher score)
      const tierScore = (tier: string) => {
        const t = tier.toUpperCase();
        if (t === 'B') return 100;
        if (t === 'A') return 50;
        return 0; // S tier
      };

      for (const c of candidates) {
        const pointsNorm = (c.weeklyPointsGained / maxWeeklyPts) * 100;
        const winRateScore = c.weeklyWinRate; // Match-level win rate (0-100)
        const streakNorm = (c.streak / maxStreak) * 100;
        // Winner bonus: 100 if player has at least 1 match win, 0 if no wins at all
        const winnerBonus = c.weeklyWins > 0 ? 100 : 0;
        const underdogScore = tierScore(c.tier);

        c.compositeScore = Math.round(
          pointsNorm * 0.40 +      // Points gained (40%)
          winRateScore * 0.25 +     // Match win rate (25%)
          streakNorm * 0.15 +       // Streak momentum (15%)
          winnerBonus * 0.10 +      // Match winner bonus (10%)
          underdogScore * 0.10      // Tier underdog bonus (10%)
        );
      }

      // Sort by composite score DESC, then tie-break: lower tier first (B < A < S)
      const tierRank = (tier: string) => {
        const t = tier.toUpperCase();
        if (t === 'B') return 1; // Best underdog — wins tie
        if (t === 'A') return 2;
        return 3; // S — loses tie
      };

      candidates.sort((a, b) => {
        if (b.compositeScore !== a.compositeScore) return b.compositeScore - a.compositeScore;
        return tierRank(a.tier) - tierRank(b.tier); // Lower tier wins on tie
      });

      weeklyTopPerformers = candidates.slice(0, 5).map(c => ({
        ...c,
        division: c.division || division,
        weekNumber: latestTournament.weekNumber,
      }));
    }
  }

  // ═══ Compute Sultan of the Week — top penyawer per tournament ═══
  // For each tournament (week), find the donor with the highest total donation amount.
  // Uses existing seasonDonations data — no extra DB queries needed.
  const tournamentMap = new Map(tournaments.map((t: any) => [t.id, t]));

  // Group donations by tournamentId, then by donorName
  // Includes earliestDonationAt for automatic tie-breaking when amounts are equal
  const tournamentDonors = new Map<string, Map<string, { totalAmount: number; donationCount: number; earliestDonationAt: Date }>>();
  for (const d of seasonDonations) {
    if (!d.tournamentId) continue;
    const tId = d.tournamentId as string;
    if (!tournamentMap.has(tId)) continue; // Only include donations for tournaments in our list

    let donorMap = tournamentDonors.get(tId);
    if (!donorMap) {
      donorMap = new Map();
      tournamentDonors.set(tId, donorMap);
    }
    const existing = donorMap.get(d.donorName);
    const donationDate = d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt as string | number);
    donorMap.set(d.donorName, {
      totalAmount: (existing?.totalAmount || 0) + d.amount,
      donationCount: (existing?.donationCount || 0) + 1,
      earliestDonationAt: existing ? (existing.earliestDonationAt < donationDate ? existing.earliestDonationAt : donationDate) : donationDate,
    });
  }

  // Also include the active tournament's donations (which may not be in tournaments list if not yet saved)
  if (activeTournament?.donations?.length) {
    const tId = activeTournament.id;
    if (!tournamentDonors.has(tId)) {
      const donorMap = new Map<string, { totalAmount: number; donationCount: number; earliestDonationAt: Date }>();
      for (const d of activeTournament.donations) {
        if (d.status !== 'approved') continue;
        const donationDate = d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt as string | number);
        const existing = donorMap.get(d.donorName);
        donorMap.set(d.donorName, {
          totalAmount: (existing?.totalAmount || 0) + d.amount,
          donationCount: (existing?.donationCount || 0) + 1,
          earliestDonationAt: existing ? (existing.earliestDonationAt < donationDate ? existing.earliestDonationAt : donationDate) : donationDate,
        });
      }
      if (donorMap.size > 0) {
        tournamentDonors.set(tId, donorMap);
      }
    }
  }

  // ═══ playerByGamertag map already built above (before topDonors) ═══

  // ═══ For each tournament with donations, determine Sultan of the Week ═══
  // Tie-breaking rules (automatic, no admin intervention needed):
  //   1. Highest totalAmount wins
  //   2. If amounts are equal → earliest donation wins (first to donate)
  //   3. If still tied → most donation count wins (more active supporter)
  //   4. If still fully tied → Co-Sultan (both get the title)
  // Admin can still override via tournament.sultanPlayerId
  const sultanOfWeekly: any[] = [];
  for (const [tId, donorMap] of tournamentDonors) {
    const tournament = tournamentMap.get(tId) || activeTournament;
    if (!tournament) continue;

    // Sort donors by: totalAmount DESC → earliestDonationAt ASC → donationCount DESC
    const sortedDonors = Array.from(donorMap.entries())
      .sort((a, b) => {
        if (b[1].totalAmount !== a[1].totalAmount) return b[1].totalAmount - a[1].totalAmount;
        // Tie-break 1: earliest donation wins
        const timeDiff = +a[1].earliestDonationAt - +b[1].earliestDonationAt;
        if (timeDiff !== 0) return timeDiff;
        // Tie-break 2: more donations wins
        return b[1].donationCount - a[1].donationCount;
      });

    if (sortedDonors.length === 0) continue;

    // ─── Check for Co-Sultan (amounts truly equal after tie-breaks) ───
    const topAmount = sortedDonors[0][1].totalAmount;
    const coSultans = sortedDonors.filter(([_, data]) => data.totalAmount === topAmount);
    const isCoSultan = coSultans.length > 1;

    // ═══ Build player info helper (used by override, co-sultan, and single sultan paths) ═══
    const buildPlayerInfo = (donorName: string) => {
      const matchedPlayer = playerByGamertag.get(donorName?.toLowerCase());
      if (!matchedPlayer) return null;
      return {
        id: matchedPlayer.id,
        gamertag: matchedPlayer.gamertag,
        avatar: matchedPlayer.avatar,
        tier: matchedPlayer.tier,
        points: matchedPlayer.points,
        totalWins: matchedPlayer.totalWins,
        totalMvp: matchedPlayer.totalMvp,
        streak: matchedPlayer.streak,
        division: matchedPlayer.division,
        city: matchedPlayer.city,
        club: matchedPlayer.club || null,
      };
    };

    // ═══ Sultan override: if admin manually set sultanPlayerId, use that instead ═══
    if (tournament.sultanPlayerId) {
      const overridePlayer = playerByGamertag.get(
        (allPlayersForDonorMatching as any[]).find((p: any) => p.id === tournament.sultanPlayerId)?.gamertag?.toLowerCase() || ''
      );

      let playerInfo: {
        id: string;
        gamertag: string;
        avatar: string | null;
        tier: string;
        points: number;
        totalWins: number;
        totalMvp: number;
        streak: number;
        division: string;
        city?: string;
        club: string | { id: string; name: string; logo?: string | null } | null;
      } | null = null;

      if (overridePlayer) {
        playerInfo = {
          id: overridePlayer.id,
          gamertag: overridePlayer.gamertag,
          avatar: overridePlayer.avatar,
          tier: overridePlayer.tier,
          points: overridePlayer.points,
          totalWins: overridePlayer.totalWins,
          totalMvp: overridePlayer.totalMvp,
          streak: overridePlayer.streak,
          division: overridePlayer.division,
          city: overridePlayer.city,
          club: overridePlayer.club || null,
        };
      }

      // Build full per-tournament donor list for leaderboard display
      const allDonorsList = sortedDonors.map(([name, data]) => ({
        donorName: name,
        totalAmount: data.totalAmount,
        donationCount: data.donationCount,
        player: buildPlayerInfo(name),
      }));

      sultanOfWeekly.push({
        weekNumber: tournament.weekNumber,
        tournamentName: tournament.name,
        tournamentId: tId,
        tournamentDivision: tournament.division,
        donorName: overridePlayer?.gamertag || sortedDonors[0]?.[0] || 'Anonymous',
        totalAmount: sortedDonors[0]?.[1]?.totalAmount || 0,
        donationCount: sortedDonors[0]?.[1]?.donationCount || 0,
        player: playerInfo,
        isCrossDivision: playerInfo ? playerInfo.division !== tournament.division : false,
        isOverride: true,
        isCoSultan: false,
        coSultans: [],
        allDonors: allDonorsList,
      });
      continue;
    }

    // ═══ Co-Sultan: multiple donors with the same top amount ═══
    if (isCoSultan) {
      const coSultanData = coSultans.map(([name, data]) => ({
        donorName: name,
        totalAmount: data.totalAmount,
        donationCount: data.donationCount,
        player: buildPlayerInfo(name),
        isCrossDivision: (() => {
          const p = playerByGamertag.get(name?.toLowerCase());
          return p ? p.division !== tournament.division : false;
        })(),
      }));

      // Exclude the primary sultan from coSultans — they're already shown as the main donorName/player
      const primaryDonorName = sortedDonors[0][0];
      const otherCoSultans = coSultanData.filter(cs => cs.donorName !== primaryDonorName);

      // Build full per-tournament donor list for leaderboard display
      const allDonorsList = sortedDonors.map(([name, data]) => ({
        donorName: name,
        totalAmount: data.totalAmount,
        donationCount: data.donationCount,
        player: buildPlayerInfo(name),
      }));

      sultanOfWeekly.push({
        weekNumber: tournament.weekNumber,
        tournamentName: tournament.name,
        tournamentId: tId,
        tournamentDivision: tournament.division,
        // Primary donor: first after tie-break (earliest donation)
        donorName: primaryDonorName || 'Anonymous',
        totalAmount: topAmount,
        donationCount: sortedDonors[0][1].donationCount,
        player: coSultanData[0].player,
        isCrossDivision: coSultanData[0].isCrossDivision,
        isCoSultan: true,
        isOverride: false,
        coSultans: otherCoSultans,
        allDonors: allDonorsList,
      });
      continue;
    }

    // ═══ Single Sultan (default case) ═══
    const [topDonorName, topDonorData] = sortedDonors[0];
    const playerInfo = buildPlayerInfo(topDonorName);

    // Build full per-tournament donor list for leaderboard display
    const allDonorsList = sortedDonors.map(([name, data]) => ({
      donorName: name,
      totalAmount: data.totalAmount,
      donationCount: data.donationCount,
      player: buildPlayerInfo(name),
    }));

    sultanOfWeekly.push({
      weekNumber: tournament.weekNumber,
      tournamentName: tournament.name,
      tournamentId: tId,
      tournamentDivision: tournament.division,
      donorName: topDonorName || 'Anonymous',
      totalAmount: topDonorData.totalAmount,
      donationCount: topDonorData.donationCount,
      player: playerInfo,
      isCrossDivision: playerInfo ? playerInfo.division !== tournament.division : false,
      isCoSultan: false,
      isOverride: false,
      coSultans: [],
      allDonors: allDonorsList,
    });
  }

  // Sort by weekNumber ascending
  sultanOfWeekly.sort((a, b) => a.weekNumber - b.weekNumber);

  // ═══ SULTAN OF THE WEEK — Add virtual skin entries to skinMap ═══
  // Only the LATEST week's Sultan gets the sultan_weekly skin (current reigning Sultan)
  // Co-Sultans also get the skin
  const SULTAN_WEEKLY_COLORS = JSON.stringify({
    frame: '#800020',
    name: '#C4A3A5|#800020|#5C0015',
    badge: 'rgba(128,0,32,0.2)|#C4A3A5',
    border: '#5C0015|#800020|#C4A3A5|#800020|#5C0015',
    glow: 'rgba(128,0,32,0.5)',
  });

  for (const sultan of sultanOfWeekly) {
    // Add skin for primary Sultan
    if (sultan.player?.id) {
      const pid = sultan.player.id;
      if (!skinMap[pid]) skinMap[pid] = [];
      if (!skinMap[pid].some((s: any) => s.type === 'sultan_weekly')) {
        skinMap[pid].push({
          type: 'sultan_weekly',
          icon: sultan.isCoSultan ? '❤️‍🔥' : '❤️',
          displayName: sultan.isCoSultan ? 'Co-Sultan of the Week' : 'Sultan of the Week',
          colorClass: SULTAN_WEEKLY_COLORS,
          priority: 5,
          duration: 'weekly',
          reason: sultan.isCoSultan
            ? `Co-Sultan of the Week ${sultan.tournamentName || 'W' + sultan.weekNumber}`
            : `Sultan of the Week ${sultan.tournamentName || 'W' + sultan.weekNumber}`,
          expiresAt: null,
        });
      }
    }
    // Add skin for Co-Sultans
    if (sultan.isCoSultan && sultan.coSultans) {
      for (const coSultan of sultan.coSultans) {
        if (coSultan.player?.id && coSultan.player.id !== sultan.player?.id) {
          const pid = coSultan.player.id;
          if (!skinMap[pid]) skinMap[pid] = [];
          if (!skinMap[pid].some((s: any) => s.type === 'sultan_weekly')) {
            skinMap[pid].push({
              type: 'sultan_weekly',
              icon: '❤️‍🔥',
              displayName: 'Co-Sultan of the Week',
              colorClass: SULTAN_WEEKLY_COLORS,
              priority: 5,
              duration: 'weekly',
              reason: `Co-Sultan of the Week ${sultan.tournamentName || 'W' + sultan.weekNumber}`,
              expiresAt: null,
            });
          }
        }
      }
    }
  }

  return NextResponse.json({
    hasData: true,
    division,
    season,
    allSeasons: allSeasonsInfo,
    seasonForClubs, // Season that has clubs — used by admin club management
    activeTournament: activeTournament ? { ...activeTournament, division: division as 'male' | 'female' } : null,
    totalPlayers,
    approvedPlayerCount,
    totalPrizePool,
    malePrizePool,
    femalePrizePool,
    activeTournamentPrizePool,
    seasonDonationTotal,
    topPlayers,
    skinMap,
    clubs: flatClubs,
    recentMatches: flatRecentMatches,
    upcomingMatches: flatUpcomingMatches,
    playoffMatches: [],
    tournaments,
    weeklyChampions,
    leagueMatches: [],
    topDonors,
    weeklyTopDonors,
    mvpHallOfFame,
    seasonProgress: {
      totalWeeks: SEASON_TOTAL_WEEKS,
      completedWeeks,
      percentage: SEASON_TOTAL_WEEKS > 0 ? Math.round((completedWeeks / SEASON_TOTAL_WEEKS) * 100) : 0,
    },
    weeklyTopPerformers,
    sultanOfWeekly,
  }, {
    headers: Object.fromEntries(headers.entries()),
  });
  } catch (error) {
    console.error('[GET /api/stats]', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { headers: Object.fromEntries(buildErrorCacheHeaders().entries()), status: 500 });
  }
}
