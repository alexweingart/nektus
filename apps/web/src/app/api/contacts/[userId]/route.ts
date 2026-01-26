import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/server/config/firebase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    // Get the current user's ID from the Authorization header
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

    // Delete the contact from Firebase
    const contactRef = db
      .collection('profiles')
      .doc(currentUserId)
      .collection('contacts')
      .doc(userId);

    const contactDoc = await contactRef.get();
    if (!contactDoc.exists) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    await contactRef.delete();

    return NextResponse.json({ success: true, message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Error deleting contact:', error);
    return NextResponse.json(
      { error: 'Failed to delete contact' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: contactUserId } = await params;

    // Get the current user's ID from session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUserId = session.user.id;
    const updates = await request.json();

    // Only allow updating specific fields (shortCode for now)
    const allowedUpdates: Partial<SavedContact> = {};
    if (updates.shortCode) {
      allowedUpdates.shortCode = updates.shortCode;
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 });
    }

    const { db } = await getFirebaseAdmin();

    // Update the contact in Firebase
    const contactRef = db
      .collection('profiles')
      .doc(currentUserId)
      .collection('contacts')
      .doc(contactUserId);

    const contactDoc = await contactRef.get();
    if (!contactDoc.exists) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    await contactRef.update(allowedUpdates);

    console.log(`📌 Updated saved contact ${contactUserId} for user ${currentUserId} with:`, allowedUpdates);

    return NextResponse.json({ success: true, updates: allowedUpdates });
  } catch (error) {
    console.error('Error updating contact:', error);
    return NextResponse.json(
      { error: 'Failed to update contact' },
      { status: 500 }
    );
  }
}
