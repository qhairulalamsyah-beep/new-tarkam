import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requirePlayer, verifyPlayer } from '@/lib/api-auth';

// GET /api/predictions — Get user's predictions
// Query params: ?matchId= (for specific match) or all predictions for user
export async function GET(request: NextRequest) {
  try {
    const player = await verifyPlayer(request);
    if (!player) {
      return NextResponse.json({ error: 'Login diperlukan' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');

    const where: any = { accountId: player.id };
    if (matchId) where.matchId = matchId;

    const predictions = await db.prediction.findMany({
      where,
      include: {
        account: {
          select: {
            id: true,
            username: true,
            player: {
              select: { id: true, gamertag: true, avatar: true, division: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, predictions });
  } catch (error) {
    console.error('Get predictions error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// POST /api/predictions — Submit a prediction
export async function POST(request: NextRequest) {
  try {
    const player = await requirePlayer(request);
    if (player instanceof NextResponse) return player;

    const body = await request.json();
    const { matchId, predictedWinnerId } = body;

    if (!matchId || !predictedWinnerId) {
      return NextResponse.json(
        { error: 'matchId dan predictedWinnerId diperlukan' },
        { status: 400 }
      );
    }

    // Fetch the match with team info
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        team1: { select: { id: true, name: true } },
        team2: { select: { id: true, name: true } },
      },
    });

    if (!match) {
      return NextResponse.json({ error: 'Match tidak ditemukan' }, { status: 404 });
    }

    // Validate: match must be in a state where prediction is allowed
    const allowedStatuses = ['pending', 'ready'];
    if (!allowedStatuses.includes(match.status)) {
      return NextResponse.json(
        { error: 'Prediksi hanya bisa dilakukan sebelum match dimulai' },
        { status: 400 }
      );
    }

    // Validate: predicted team must be in the match
    if (match.team1Id !== predictedWinnerId && match.team2Id !== predictedWinnerId) {
      return NextResponse.json(
        { error: 'Tim yang diprediksi tidak ada di match ini' },
        { status: 400 }
      );
    }

    // Validate: both teams must be assigned
    if (!match.team1Id || !match.team2Id) {
      return NextResponse.json(
        { error: 'Tim belum ditentukan untuk match ini' },
        { status: 400 }
      );
    }

    // Check if user already predicted this match
    const existing = await db.prediction.findUnique({
      where: {
        accountId_matchId: {
          accountId: player.id,
          matchId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Kamu sudah memprediksi match ini', prediction: existing },
        { status: 409 }
      );
    }

    // Create the prediction
    const prediction = await db.prediction.create({
      data: {
        accountId: player.id,
        matchId,
        predictedWinnerId,
      },
    });

    return NextResponse.json({ success: true, prediction }, { status: 201 });
  } catch (error: any) {
    // Handle Prisma unique constraint violation
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Kamu sudah memprediksi match ini' },
        { status: 409 }
      );
    }
    console.error('Create prediction error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
