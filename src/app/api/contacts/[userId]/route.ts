import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase/adminConfig';
import type { SavedContact } from '@/types/contactExchange';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    // Get the current user's ID from the session
    // For now, we'll get it from the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the session token
    const { auth, db } = await getFirebaseAdmin();
    const idToken = authHeader.replace('Bearer ', '');
    const decodedToken = await auth.verifyIdToken(idToken);
    const currentUserId = decodedToken.uid;

    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the saved contact from Firebase
    const contactDoc = await db
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
