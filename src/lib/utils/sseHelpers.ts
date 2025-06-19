/**
 * Server-Sent Events helper functions
 */

import { storeSseConnection } from '@/lib/redis/client';

// In-memory store for active SSE connections
// Note: This still needs to be in-memory since we can't store WritableStream in Redis
// In production, you'd use a separate WebSocket server or message queue
const activeConnections = new Map<string, { 
  writer: WritableStreamDefaultWriter,
  sessionId: string,
  userId?: string,
  connectedAt: number
}>();

/**
 * Add a connection to the active connections store
 */
export function addSseConnection(sessionId: string, writer: WritableStreamDefaultWriter) {
  activeConnections.set(sessionId, {
    writer,
    sessionId,
    connectedAt: Date.now()
  });
}

/**
 * Remove a connection from the active connections store
 */
export function removeSseConnection(sessionId: string) {
  activeConnections.delete(sessionId);
}

/**
 * Send a message to a specific session
 */
export function sendToSession(sessionId: string, message: any): boolean {
  const connection = activeConnections.get(sessionId);
  if (connection) {
    const encoder = new TextEncoder();
    const data = `data: ${JSON.stringify(message)}\n\n`;
    
    try {
      connection.writer.write(encoder.encode(data));
      return true;
    } catch (error) {
      console.error('Failed to send SSE message:', error);
      activeConnections.delete(sessionId);
      return false;
    }
  }
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
      connection.writer.write(encoder.encode(data));
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
