/**
 * API endpoint for ping and logging functionality
 * - HEAD: Simple ping for RTT measurement
 * - POST: Logging endpoint for client events
 */

import { NextRequest, NextResponse } from 'next/server';

// For HEAD requests (simple ping)
export async function HEAD() {
  return NextResponse.json({ success: true });
}

// For POST requests (logging)
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Log the received data
    console.log(`[SYSTEM/PING] ${data.event || 'event'}:`, 
      data.message || '',
      data.sessionId ? `(session: ${data.sessionId})` : ''
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ping log error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}