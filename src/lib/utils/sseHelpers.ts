/**
 * Server-Sent Events helper functions
 */

import { storeSseConnection } from '@/lib/redis/client';

// In-memory store for active SSE connections
// Note: This still needs to be in-memory since we can't store ReadableStreamDefaultController in Redis
// In production, you'd use a separate WebSocket server or message queue
const activeConnections = new Map<string, { 
  controller: ReadableStreamDefaultController<Uint8Array>,
  sessionId: string,
  userId?: string,
  connectedAt: number
}>();

/**
 * Add a connection to the active connections store
 */
export function addSseConnection(sessionId: string, controller: ReadableStreamDefaultController<Uint8Array>) {
  activeConnections.set(sessionId, {
    controller,
    sessionId,
    connectedAt: Date.now()
  });
  
  console.log(`🔗 Added SSE connection for session: ${sessionId}. Total connections: ${activeConnections.size}`);
}

/**
 * Remove a connection from the active connections store
 */
export function removeSseConnection(sessionId: string) {
  const wasPresent = activeConnections.delete(sessionId);
  console.log(`🔗 Removed SSE connection for session: ${sessionId}. Was present: ${wasPresent}. Total connections: ${activeConnections.size}`);
}

/**
 * Send a message to a specific session
 */
export function sendToSession(sessionId: string, message: any): boolean {
  const connection = activeConnections.get(sessionId);
  
  console.log(`📤 Attempting to send message to session: ${sessionId}`);
  console.log(`📤 Connection found: ${!!connection}`);
  console.log(`📤 Active connections: ${Array.from(activeConnections.keys()).join(', ')}`);
  
  if (connection) {
    const encoder = new TextEncoder();
    const data = `data: ${JSON.stringify(message)}\n\n`;
    
    try {
      connection.controller.enqueue(encoder.encode(data));
      console.log(`✅ Successfully sent message to session: ${sessionId}`);
      return true;
    } catch (error) {
      console.error('Failed to send SSE message:', error);
      activeConnections.delete(sessionId);
      return false;
    }
  }
  
  console.log(`❌ No active connection found for session: ${sessionId}`);
  return false;
}

/**
 * Broadcast a message to all connected sessions
 */
export function broadcastToAll(message: any): void {
  const encoder = new TextEncoder();
  const data = `data: ${JSON.stringify(message)}\n\n`;
  
  for (const [sessionId, connection] of activeConnections) {
    try {
      connection.controller.enqueue(encoder.encode(data));
    } catch (error) {
      console.error(`Failed to send to session ${sessionId}:`, error);
      activeConnections.delete(sessionId);
    }
  }
}

/**
 * Get active connections count
 */
export function getActiveConnections(): number {
  return activeConnections.size;
}

/**
 * Store a SSE connection info in Redis (optional - for monitoring)
 */
export async function storeConnection(sessionId: string, data: any): Promise<void> {
  try {
    await storeSseConnection(sessionId, data);
  } catch (error) {
    console.warn('Failed to store connection in Redis:', error);
  }
}
