/**
 * Clock synchronization API endpoint
 * Returns the current server time for client-server clock sync
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const serverTime = Date.now();
    
    return NextResponse.json({ 
      serverTime,
      timestamp: new Date(serverTime).toISOString()
    });
  } catch (error) {
    console.error('Clock sync API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
