import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/options';

export async function GET() {
  return NextResponse.json({ 
    message: 'Background image API GET works',
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Background Image API] Minimal POST handler starting');
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    console.log('[Background Image API] Request received for user:', session.user.id);
    
    return NextResponse.json({ 
      message: 'Background image API POST works',
      userId: session.user.id,
      timestamp: new Date().toISOString(),
      received: { bio: body.bio?.substring(0, 50), name: body.name }
    });
    
  } catch (error) {
    console.error('[Background Image API] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
