import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { buildCacheHeaders, buildErrorCacheHeaders, CACHE_TIER_1 } from '@/lib/cache-tiers';

// Force dynamic — this route is never statically rendered
export const dynamic = 'force-dynamic';

export async function GET() {
  // ★ Time-aware cache headers — Tier 1 (stable): TTL adjusts based on WITA peak hours
  const headers = buildCacheHeaders(CACHE_TIER_1, 'donations-data');
  headers.set('Vary', 'Accept-Encoding');

  try {
    // Get top 5 donors grouped by name, with their latest donation details
    const topDonors = await db.donation.groupBy({
      by: ['donorName'],
      _sum: { amount: true },
      _count: { id: true },
      _max: { createdAt: true },
      where: { status: 'approved' },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    });

    // Batch fetch latest donations for all top donors in ONE query
    const donorNames = topDonors.map(d => d.donorName).filter(Boolean) as string[];

    const latestDonationsList = await db.donation.findMany({
      where: {
        donorName: { in: donorNames },
        status: 'approved',
      },
      orderBy: { createdAt: 'desc' },
      select: { donorName: true, type: true, createdAt: true },
    });

    // Deduplicate: keep only the first (latest) for each donorName
    const latestMap = new Map<string, { type: string; createdAt: Date }>();
    for (const d of latestDonationsList) {
      if (!latestMap.has(d.donorName)) {
        latestMap.set(d.donorName, { type: d.type, createdAt: d.createdAt });
      }
    }

    const donorsWithDetails = topDonors.map(d => ({
      donorName: d.donorName || 'Anonymous',
      totalAmount: d._sum.amount || 0,
      donationCount: d._count.id,
      latestType: latestMap.get(d.donorName!)?.type || 'weekly',
      latestDate: latestMap.get(d.donorName!)?.createdAt?.toISOString() || null,
    }));

    // Get overall totals for the summary header in parallel
    const [totals, uniqueDonors] = await Promise.all([
      db.donation.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: { status: 'approved' },
      }),
      db.donation.groupBy({
        by: ['donorName'],
        where: { status: 'approved' },
        _count: { id: true },
      }),
    ]);

    return NextResponse.json({
      donors: donorsWithDetails,
      summary: {
        totalAmount: totals._sum.amount || 0,
        totalDonors: uniqueDonors.length,
        totalDonations: totals._count.id || 0,
      },
    }, { headers });
  } catch {
    return NextResponse.json(
      { donors: [], summary: { totalAmount: 0, totalDonors: 0, totalDonations: 0 } },
      { headers: Object.fromEntries(buildErrorCacheHeaders().entries()), status: 200 }
    );
  }
}
