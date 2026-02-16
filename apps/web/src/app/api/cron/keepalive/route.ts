/**
 * Cron job to keep Upstash Redis active
 * Runs weekly to prevent deletion due to inactivity (14 day limit)
 */

import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/server/config/redis';
import { CACHE_TTL } from '@nektus/shared-client';

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!redis) {
      return NextResponse.json({ error: 'Redis not configured' }, { status: 503 });
    }

    // Simple ping to keep Redis active
    const timestamp = Date.now();
    await redis.set('keepalive:last_ping', timestamp, { ex: CACHE_TTL.WEEKLY_S }); // 7 day TTL
    const pong = await redis.get('keepalive:last_ping');

    console.log(`🏓 Redis keepalive ping successful: ${pong}`);

    return NextResponse.json({
      success: true,
      message: 'Redis keepalive ping successful',
      timestamp: pong
    });
  } catch (error) {
    console.error('Redis keepalive error:', error);
    return NextResponse.json(
      { error: 'Redis ping failed', details: String(error) },
      { status: 500 }
    );
  }
}
