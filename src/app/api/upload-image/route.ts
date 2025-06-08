import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/options';
import { getFirebaseAdmin } from '@/lib/firebase/adminConfig';

export async function POST(request: NextRequest) {
  try {
    console.log('[Upload API] Starting image upload process');
    
    // Get session to verify user
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('[Upload API] No valid session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    console.log('[Upload API] Authenticated user:', userId);
    
    const body = await request.json();
    const { base64Data, imageType } = body;
    
    if (!base64Data || !imageType) {
      console.log('[Upload API] Missing required data');
      return NextResponse.json({ error: 'Missing base64Data or imageType' }, { status: 400 });
    }
    
    console.log('[Upload API] Processing upload for type:', imageType);
    console.log('[Upload API] Base64 data length:', base64Data.length);
    
    // Convert base64 to buffer
    const base64WithoutPrefix = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(base64WithoutPrefix, 'base64');
    
    console.log('[Upload API] Buffer size:', buffer.length, 'bytes');
    
    // Get Firebase Admin Storage
    const { storage } = await getFirebaseAdmin();
    const bucket = storage.bucket();
    const fileName = `users/${userId}/${imageType}-image.png`;
    const file = bucket.file(fileName);
    
    console.log('[Upload API] Uploading to path:', fileName);
    
    // Upload the buffer
    await file.save(buffer, {
      metadata: {
        contentType: 'image/png',
      },
    });
    
    console.log('[Upload API] File uploaded successfully');
    
    // Make the file publicly readable
    await file.makePublic();
    console.log('[Upload API] File made public');
    
    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    console.log('[Upload API] Public URL generated:', publicUrl);
    
    return NextResponse.json({ 
      success: true, 
      url: publicUrl 
    });
    
  } catch (error) {
    console.error('[Upload API] Error uploading image:', error);
    return NextResponse.json(
      { error: 'Failed to upload image', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
}
