import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/options';

export async function GET() {
  return NextResponse.json({ 
    message: 'Background image test API is working',
    timestamp: new Date().toISOString(),
    method: 'GET'
  });
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Background Image Test API] Starting simple test');
    
    // Get session to verify user
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('[Background Image Test API] No valid session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    console.log('[Background Image Test API] Authenticated user:', userId);
    
    const body = await request.json();
    console.log('[Background Image Test API] Request body received');
    
    // Return a simple test response
    return NextResponse.json({ 
      success: true,
      message: 'Background image test API POST is working',
      userId: userId,
      timestamp: new Date().toISOString(),
      method: 'POST'
    });
    
  } catch (error) {
    console.error('[Background Image Test API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
}
