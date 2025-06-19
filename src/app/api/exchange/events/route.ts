/**
 * Server-Sent Events endpoint for real-time exchange notifications
 * This replaces WebSocket functionality for real-time communication
 */

import { NextRequest } from 'next/server';
import { addSseConnection, removeSseConnection } from '@/lib/utils/sseHelpers';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session');
  
  console.log(`🔗 SSE connection request received for session: ${sessionId}`);
  
  if (!sessionId) {
    console.log('❌ SSE connection rejected: Missing session ID');
    return new Response('Missing session ID', { status: 400 });
  }

  // Create a readable stream for Server-Sent Events
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      // Create a writer for this connection
      const writer = {
        write: (chunk: Uint8Array) => controller.enqueue(chunk),
        close: () => controller.close(),
        abort: (reason?: any) => controller.error(reason)
      } as WritableStreamDefaultWriter;

      // Store the connection
      addSseConnection(sessionId, writer);

      // Send initial connection confirmation
      const initMessage = `data: ${JSON.stringify({
        type: 'connected',
        sessionId,
        timestamp: Date.now()
      })}\n\n`;
      
      controller.enqueue(encoder.encode(initMessage));

      console.log(`✅ SSE connection established and initial message sent for session: ${sessionId}`);
    },
    
    cancel() {
      // Clean up when client disconnects
      removeSseConnection(sessionId);
      console.log(`SSE connection closed for session: ${sessionId}`);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  });
}
