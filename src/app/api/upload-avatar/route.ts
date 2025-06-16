import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/options';
import { getFirebaseAdmin } from '@/lib/firebase/adminConfig';

// Server-side upload function using Firebase Admin SDK
async function uploadAvatarAdmin(base64Data: string, userId: string): Promise<string> {
  try {
    const { storage } = await getFirebaseAdmin();
    
    // Convert base64 to buffer
    const base64WithoutPrefix = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(base64WithoutPrefix, 'base64');
    
    // Create storage reference with timestamp to avoid overwriting
    const bucket = storage.bucket();
    const timestamp = Date.now();
    const fileName = `users/${userId}/avatar-${timestamp}.png`;
    const file = bucket.file(fileName);
    
    // Upload the buffer
    await file.save(buffer, {
      metadata: {
        contentType: 'image/png'
      }
    });
    
    // Make the file publicly readable
    await file.makePublic();
    
    // Get the correct public URL using Firebase Storage public URL format
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    console.log('[Firebase] Saved avatar to storage for user:', userId, 'URL:', publicUrl);
    
    return publicUrl;
  } catch (error) {
    console.error('[Upload API] Server-side upload failed:', error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageData } = await req.json();
    
    if (!imageData || !imageData.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 });
    }

    console.log('[Upload API] Uploading generated avatar for user:', session.user.id);
    
    // Upload to Firebase Storage using server-side admin credentials
    const uploadedUrl = await uploadAvatarAdmin(imageData, session.user.id);
    
    console.log('[Upload API] Avatar uploaded successfully');
    
    return NextResponse.json({ 
      imageUrl: uploadedUrl,
      success: true 
    });

  } catch (error) {
    console.error('[Upload API] Avatar upload failed:', error);
    return NextResponse.json(
      { error: 'Failed to upload avatar' }, 
      { status: 500 }
    );
  }
}
