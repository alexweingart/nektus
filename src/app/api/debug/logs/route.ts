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

    // Try to get user info from session
    let userInfo = '';
    try {
      const { getServerSession } = await import('next-auth');
      const { authOptions } = await import('@/app/api/auth/[...nextauth]/options');
      const session = await getServerSession(authOptions);
      if (session?.user?.email) {
        userInfo = session.user.email.split('@')[0]; // e.g., 'alwei1335' from 'alwei1335@gmail.com'
      }
    } catch (e) {
      // Ignore session errors
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      event: data.event || 'unknown',
      message: userInfo ? `[${userInfo}] ${data.message || ''}` : (data.message || ''),
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