/**
 * API endpoint for clock synchronization
 * Returns the current Redis timestamp for consistent time across all serverless instances
 */

import { NextResponse } from 'next/server';
import { getRedisTime } from '@/lib/services/server/redisTimeService';

export async function GET() {
  try {
    const serverTime = await getRedisTime();
    
    return NextResponse.json({
      success: true,
      serverTime
    });
  } catch (error) {
    console.error('Clock sync error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
} 