import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';
import { getFirebaseAdmin } from '@/lib/firebase/adminConfig';

// Server-side upload function using Firebase Admin SDK
async function uploadProfileImageAdmin(base64Data: string, userId: string): Promise<string> {
  try {
    const { storage } = await getFirebaseAdmin();
    
    // Convert base64 to buffer
    const base64WithoutPrefix = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(base64WithoutPrefix, 'base64');
    
    // Create storage reference with timestamp to avoid overwriting
    const bucket = storage.bucket();
    const timestamp = Date.now();
    const fileName = `users/${userId}/profile-image-${timestamp}.png`;
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
    console.log('[Firebase] Saved profile image to storage for user:', userId, 'URL:', publicUrl);
    
    return publicUrl;
  } catch (error) {
    console.error('[Profile Image API] Server-side upload failed:', error);
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
    
    if (!imageData) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    console.log('[Profile Image API] Processing profile image upload for user:', session.user.id);

    try {
      const imageUrl = await uploadProfileImageAdmin(imageData, session.user.id);
      console.log('[Profile Image API] Successfully uploaded profile image:', imageUrl);
      
      return NextResponse.json({ 
        imageUrl,
        message: 'Profile image uploaded successfully' 
      });
    } catch (uploadError) {
      console.error('[Profile Image API] Upload failed:', uploadError);
      return NextResponse.json({ 
        error: 'Upload failed', 
        details: uploadError instanceof Error ? uploadError.message : 'Unknown error' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[Profile Image API] Request processing failed:', error);
    return NextResponse.json({ 
      error: 'Request failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

// Add GET handler for debugging
export async function GET() {
  return NextResponse.json({ 
    message: 'Profile image API is working',
    timestamp: new Date().toISOString(),
    method: 'GET'
  });
}
