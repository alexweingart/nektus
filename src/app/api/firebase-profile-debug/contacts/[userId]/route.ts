/**
 * Debug endpoint to check contacts for a specific user
 * GET /api/firebase-profile-debug/contacts/[userId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase/adminConfig';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  try {
    const { userId } = await context.params;
    
    console.log(`🔍 DEBUG: Checking contacts for user: ${userId}`);
    
    const { db } = await getFirebaseAdmin();
    const contactsRef = db.collection('profiles').doc(userId).collection('contacts');
    const snapshot = await contactsRef.get();
    
    const contacts: any[] = [];
    
    snapshot.forEach(doc => {
      contacts.push({
        id: doc.id,
        data: doc.data()
      });
    });
    
    console.log(`📋 DEBUG: Found ${contacts.length} contacts for ${userId}:`, contacts.map(c => ({ id: c.id, name: c.data?.name })));
    
    return NextResponse.json({
      userId: userId,
      count: contacts.length,
      contacts: contacts.map(contact => ({
        contactId: contact.id,
        name: contact.data?.name || 'Unknown',
        email: contact.data?.contactChannels?.email?.email || 'No email',
        phone: contact.data?.contactChannels?.phoneInfo?.internationalPhone || 'No phone',
        addedAt: contact.data?.addedAt ? new Date(contact.data.addedAt).toISOString() : 'Unknown',
        matchToken: contact.data?.matchToken || 'No token',
        fullData: contact.data
      })),
      message: `Found ${contacts.length} contacts for user ${userId}`
    });
    
  } catch (error) {
    console.error(`❌ DEBUG: Error checking contacts:`, error);
    return NextResponse.json({
      userId: context.params ? (await context.params).userId : 'unknown',
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Error checking contacts'
    }, { status: 500 });
  }
}
