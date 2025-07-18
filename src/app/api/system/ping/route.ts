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

// For POST requests (logging + IP geolocation caching)
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Log the received data
    console.log(`[SYSTEM/PING] ${data.event || 'event'}:`, 
      data.message || '',
      data.sessionId ? `(session: ${data.sessionId})` : ''
    );
    
    // If this is an exchange start event, pre-cache IP geolocation
    if (data.event === 'exchange_start' && data.sessionId) {
      console.log(`📍 Pre-caching IP geolocation for exchange session ${data.sessionId}`);
      
      // Get client IP
      const forwarded = request.headers.get('x-forwarded-for');
      const realIp = request.headers.get('x-real-ip');
      const clientIP = forwarded?.split(',')[0].trim() || realIp || '127.0.0.1';
      
      // Pre-cache geolocation in background (don't wait for it)
      const { getIPLocation } = await import('@/lib/services/server/ipGeolocationService');
      getIPLocation(clientIP).then(location => {
        console.log(`✅ Pre-cached geolocation for ${clientIP}: ${location.city || 'unknown'}, ${location.state || 'unknown'} (VPN: ${location.isVPN})`);
      }).catch(error => {
        console.warn(`❌ Failed to pre-cache geolocation for ${clientIP}:`, error);
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ping log error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}