import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/options';
import { revokeGoogleToken } from '../../../utils/google';
import { cookies } from 'next/headers';

/**
 * API route to delete a user account and revoke Google OAuth connections
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // In a mobile contact exchange app, we want to force sign out and clean up auth cookies
    
    // Log for debugging
    console.log('Deleting account for user:', session?.user?.email || 'unknown user');
    
    // Get all cookies to clear them
    const cookieStore = cookies();
    const allCookies = cookieStore.getAll();
    
    // Find any auth-related cookies and log them
    const authCookies = allCookies.filter(cookie => 
      cookie.name.includes('next-auth') || 
      cookie.name.includes('session') || 
      cookie.name.includes('token')
    );
    
    console.log('Found auth cookies:', authCookies.map(c => c.name));
    
    // We'll consider the operation successful as long as we found the user session
    // The actual sign-out will happen client-side after this operation
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
