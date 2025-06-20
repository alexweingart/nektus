/**
 * Debug endpoint to list all users and their contact counts
 * GET /api/firebase-profile-debug/contacts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase/adminConfig';

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    console.log(`🔍 DEBUG: Listing all users and their contact counts`);
    
    const { db } = await getFirebaseAdmin();
    const profilesRef = db.collection('profiles');
    const snapshot = await profilesRef.get();
    
    const userStats: any[] = [];
    
    // Check contacts for each user
    for (const doc of snapshot.docs) {
      const userId = doc.id;
      const profileData = doc.data();
      
      try {
        const contactsRef = db.collection('profiles').doc(userId).collection('contacts');
        const contactsSnapshot = await contactsRef.get();
        const contactsCount = contactsSnapshot.size;
        
        // Get basic contact info
        const contacts = contactsSnapshot.docs.map(contactDoc => ({
          id: contactDoc.id,
          name: contactDoc.data()?.name || 'Unknown',
          addedAt: contactDoc.data()?.addedAt ? new Date(contactDoc.data().addedAt).toISOString() : 'Unknown'
        }));
        
        userStats.push({
          userId: userId,
          userName: profileData?.name || 'Unknown',
          userEmail: profileData?.contactChannels?.email?.email || 'No email',
          contactsCount: contactsCount,
          contacts: contacts,
          debugUrl: `/api/firebase-profile-debug/contacts/${userId}`
        });
        
      } catch (error) {
        console.warn(`⚠️ DEBUG: Could not check contacts for ${userId}:`, error);
        userStats.push({
          userId: userId,
          userName: profileData?.name || 'Unknown',
          userEmail: profileData?.contactChannels?.email?.email || 'No email',
          contactsCount: 0,
          contacts: [],
          error: error instanceof Error ? error.message : 'Unknown error',
          debugUrl: `/api/firebase-profile-debug/contacts/${userId}`
        });
      }
    }
    
    const totalUsers = userStats.length;
    const totalContacts = userStats.reduce((sum, user) => sum + user.contactsCount, 0);
    
    console.log(`📊 DEBUG: Found ${totalUsers} users with ${totalContacts} total contacts`);
    
    return NextResponse.json({
      summary: {
        totalUsers: totalUsers,
        totalContacts: totalContacts,
        usersWithContacts: userStats.filter(u => u.contactsCount > 0).length
      },
      users: userStats,
      message: `Found ${totalUsers} users with ${totalContacts} total contacts`
    });
    
  } catch (error) {
    console.error(`❌ DEBUG: Error listing user contacts:`, error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Error listing user contacts'
    }, { status: 500 });
  }
}
