/**
 * Simple ping endpoint for RTT estimation and debug logging
 */

export async function HEAD() {
  return new Response(null, { 
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}

export async function GET() {
  return Response.json({ 
    timestamp: Date.now(),
    message: 'pong' 
  });
}

export async function POST(request: Request) {
  try {
    const { event, message, sessionId, timestamp } = await request.json();
    
    // Safe timestamp handling
    const timeStr = timestamp ? 
      (new Date(timestamp).toISOString()) : 
      new Date().toISOString();
    
    console.log(`📱 CLIENT LOG [${sessionId || 'no-session'}] ${event}: ${message} (${timeStr})`);
    
    return Response.json({ success: true });
  } catch (error) {
    console.error('Failed to process client log:', error);
    return Response.json({ success: false }, { status: 400 });
  }
}
