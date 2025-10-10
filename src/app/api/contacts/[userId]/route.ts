import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminDb } from '@/lib/firebase/firebase-admin';
import type { SavedContact } from '@/types/contactExchange';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId;

    // Get the current user's ID from the session
    // For now, we'll get it from the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the session token
    const idToken = authHeader.replace('Bearer ', '');
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const currentUserId = decodedToken.uid;

    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the saved contact from Firebase
    const contactDoc = await adminDb
      .collection('profiles')
      .doc(currentUserId)
      .collection('contacts')
      .doc(userId)
      .get();

    if (!contactDoc.exists) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const contactData = contactDoc.data() as SavedContact;

    return NextResponse.json(contactData);
  } catch (error) {
    console.error('Error fetching saved contact:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contact' },
      { status: 500 }
    );
  }
}
