import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/options';
import { db } from '../../lib/firebase';
import { doc, deleteDoc, getDoc } from 'firebase/firestore';
import { cookies } from 'next/headers';

/**
 * API route to delete a user account and related data from Firebase
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
    
    // Log for debugging
    console.log('Deleting account data for user:', userId);
    
    // Delete user profile from Firestore
    try {
      // First check if profile exists
      const profileDocRef = doc(db, 'profiles', userId);
      const profileSnapshot = await getDoc(profileDocRef);
      
      if (profileSnapshot.exists()) {
        // Delete the profile document
        await deleteDoc(profileDocRef);
        console.log(`Successfully deleted profile for user: ${userId}`);
      } else {
        console.log(`No profile found for user: ${userId}`);
      }

      // Note: If there are additional collections storing user data, they should be deleted here as well
      // For example: connections, messages, etc.
      
    } catch (firestoreError) {
      console.error('Error deleting Firestore data:', firestoreError);
      // Continue execution even if Firestore deletion fails
      // This allows the account disconnection to proceed
    }
    
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
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
