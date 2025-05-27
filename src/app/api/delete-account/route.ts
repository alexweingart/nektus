import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/options';
import { cookies } from 'next/headers';

/**
 * API route to handle account deletion
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.email;
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 400 });
    }
    
    console.log('Processing account deletion for user:', userId);
    
    // Get auth cookies for logging purposes
    const cookieStore = cookies();
    const allCookies = cookieStore.getAll();
    
    // Find any auth-related cookies and log them
    const authCookies = allCookies.filter(cookie => 
      cookie.name.includes('next-auth') || 
      cookie.name.includes('session') || 
      cookie.name.includes('token')
    );
    
    console.log('Found auth cookies to be cleared client-side:', authCookies.map(c => c.name));
    
    return NextResponse.json({ 
      success: true,
      message: 'Account deletion processed. Please clear client-side auth state.'
    });
  } catch (error) {
    console.error('Error processing account deletion:', error);
    return NextResponse.json({ error: 'Failed to process account deletion' }, { status: 500 });
  }
}
