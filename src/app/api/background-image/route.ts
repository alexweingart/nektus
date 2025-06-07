import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/options';
import { getFirebaseAdmin } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    console.log('[Background Image API] Starting background image generation');
    
    // Get session to verify user
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('[Background Image API] No valid session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    console.log('[Background Image API] Authenticated user:', userId);
    
    const body = await request.json();
    const { bio, name } = body;
    
    if (!bio || !name) {
      console.log('[Background Image API] Missing required data');
      return NextResponse.json({ error: 'Missing bio or name' }, { status: 400 });
    }
    
    console.log('[Background Image API] Generating background image for:', name);
    console.log('[Background Image API] Bio preview:', bio.substring(0, 100) + '...');
    
    // Call OpenAI API - use absolute URL for server-side request
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const openaiResponse = await fetch(`${baseUrl}/api/openai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'background',
        profile: {
          name: name,
          bio: bio,
          userId: userId
        }
      })
    });
    
    if (!openaiResponse.ok) {
      console.error('[Background Image API] OpenAI API failed');
      return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
    }
    
    // Handle streaming response from OpenAI
    const contentType = openaiResponse.headers.get('content-type');
    if (contentType?.includes('text/event-stream')) {
      console.log('[Background Image API] Processing streaming response');
      
      let finalImageUrl: string | null = null;
      
      const reader = openaiResponse.body?.getReader();
      if (!reader) {
        return NextResponse.json({ error: 'No reader available' }, { status: 500 });
      }
      
      try {
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const dataStr = line.slice(6);
                const data = JSON.parse(dataStr);
                
                // Handle OpenAI partial images format
                if (data.type === 'response.image_generation_call.partial_image' && data.partial_image_b64) {
                  const imageData = data.partial_image_b64;
                  console.log(`[Background Image API] Received partial image (index: ${data.partial_image_index})`);
                  
                  // Store the latest image (use the last one received)
                  finalImageUrl = `data:image/png;base64,${imageData}`;
                }
                
                // Handle completion
                if (data.type === 'response.completed') {
                  console.log('[Background Image API] OpenAI response completed');
                  break;
                }
              } catch (parseError) {
                console.warn('[Background Image API] Failed to parse streaming data:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      
      if (!finalImageUrl) {
        console.error('[Background Image API] No image received from OpenAI');
        return NextResponse.json({ error: 'No image generated' }, { status: 500 });
      }
      
      console.log('[Background Image API] Image generated, uploading to storage...');
      
      // Get Firebase Admin Storage using the admin SDK
      const { app } = await getFirebaseAdmin();
      
      // Import Firebase Admin Storage module
      const { getStorage } = await import('firebase-admin/storage');
      
      // Get the project ID to construct bucket name
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      
      // Try legacy bucket format first, then new format
      let bucketName = `${projectId}.appspot.com`;
      console.log('[Background Image API] Trying legacy bucket format:', bucketName);
      
      try {
        const bucket = getStorage(app).bucket(bucketName);
        const fileName = `users/${userId}/background-image.png`;
        const file = bucket.file(fileName);
        
        console.log('[Background Image API] Uploading to storage path:', fileName);
        
        const base64WithoutPrefix = finalImageUrl.replace(/^data:image\/[a-z]+;base64,/, '');
        const buffer = Buffer.from(base64WithoutPrefix, 'base64');
        
        console.log('[Background Image API] Buffer size:', buffer.length, 'bytes');
        
        // Upload the buffer
        await file.save(buffer, {
          metadata: {
            contentType: 'image/png',
          },
        });
        
        console.log('[Background Image API] File uploaded successfully');
        
        // Make the file publicly readable
        await file.makePublic();
        console.log('[Background Image API] File made public');
        
        // Get the public URL
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
        console.log('[Background Image API] Public URL generated:', publicUrl);
        
        return NextResponse.json({ 
          success: true, 
          imageUrl: publicUrl 
        });
        
      } catch (legacyError) {
        console.log('[Background Image API] Legacy bucket failed, trying new format...');
        
        // Try new bucket format
        bucketName = `${projectId}.firebasestorage.app`;
        console.log('[Background Image API] Trying new bucket format:', bucketName);
        
        const bucket = getStorage(app).bucket(bucketName);
        const fileName = `users/${userId}/background-image.png`;
        const file = bucket.file(fileName);
        
        console.log('[Background Image API] Uploading to storage path:', fileName);
        
        const base64WithoutPrefix = finalImageUrl.replace(/^data:image\/[a-z]+;base64,/, '');
        const buffer = Buffer.from(base64WithoutPrefix, 'base64');
        
        console.log('[Background Image API] Buffer size:', buffer.length, 'bytes');
        
        // Upload the buffer
        await file.save(buffer, {
          metadata: {
            contentType: 'image/png',
          },
        });
        
        console.log('[Background Image API] File uploaded successfully');
        
        // Make the file publicly readable
        await file.makePublic();
        console.log('[Background Image API] File made public');
        
        // Get the public URL
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
        console.log('[Background Image API] Public URL generated:', publicUrl);
        
        return NextResponse.json({ 
          success: true, 
          imageUrl: publicUrl 
        });
      }
      
    } else {
      // Handle regular JSON response (fallback)
      const result = await openaiResponse.json();
      console.log('[Background Image API] Regular response:', result);
      
      if (result.imageUrl) {
        // If we get a URL directly, we might need to download and re-upload
        // For now, just return it as-is
        return NextResponse.json({ 
          success: true, 
          imageUrl: result.imageUrl 
        });
      } else {
        return NextResponse.json({ error: 'No image in response' }, { status: 500 });
      }
    }
    
  } catch (error) {
    console.error('[Background Image API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate background image', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
}
