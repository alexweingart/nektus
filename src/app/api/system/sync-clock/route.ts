/**
 * API endpoint for clock synchronization
 * Returns the current server timestamp for client-server time normalization
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      serverTime: Date.now()
    });
  } catch (error) {
    console.error('Clock sync error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
} 