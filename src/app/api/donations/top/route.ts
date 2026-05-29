import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// Force dynamic — this route is never statically rendered
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const headers = new Headers();
  headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  headers.set('Surrogate-Key', 'league-data');
  headers.set('Vary', 'Accept-Encoding');

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '10');

  const topDonors = await db.donation.groupBy({
    by: ['donorName'],
    _sum: { amount: true },
    _count: { id: true },
    where: { status: 'approved' },
    orderBy: { _sum: { amount: 'desc' } },
    take: limit,
  });

  return NextResponse.json(topDonors.map(d => ({
    donorName: d.donorName,
    totalAmount: d._sum.amount,
    donationCount: d._count.id,
  })), { headers });
}
