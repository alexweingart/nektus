import { NextRequest, NextResponse } from 'next/server';

interface LogEntry {
  timestamp: string;
  event: string;
  message: string;
  sessionId?: string;
}

// In-memory log store (will reset on server restart, which is fine for debugging)
let logs: LogEntry[] = [];
const MAX_LOGS = 100; // Keep last 100 logs

export async function GET() {
  return NextResponse.json({ logs: logs.slice(-50) }); // Return last 50 logs
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      event: data.event || 'unknown',
      message: data.message || '',
      sessionId: data.sessionId
    };

    logs.push(logEntry);

    // Keep only the last MAX_LOGS entries
    if (logs.length > MAX_LOGS) {
      logs = logs.slice(-MAX_LOGS);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Debug log error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  logs = [];
  return NextResponse.json({ success: true });
}