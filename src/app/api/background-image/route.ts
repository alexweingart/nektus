import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/options';
import { getFirebaseAdmin } from '@/lib/firebase/adminConfig';
import { getFirestore } from 'firebase-admin/firestore';

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
    const { bio, name, profileImage } = body;
    
    if (!bio || !name) {
      console.log('[Background Image API] Missing required data');
      return NextResponse.json({ error: 'Missing bio or name' }, { status: 400 });
    }
    
    // Get user's profile image from Firebase
    console.log('[Background Image API] Fetching user profile image...');
    const { adminApp, storage } = await getFirebaseAdmin();
    const db = getFirestore(adminApp);
    
    let profileImageUrl = null;
    try {
      const profileDoc = await db.collection('profiles').doc(userId).get();
      if (profileDoc.exists) {
        const profileData = profileDoc.data();
        profileImageUrl = profileData?.profileImage || null;
        console.log('[Background Image API] Profile image found:', !!profileImageUrl);
      }
    } catch (error) {
      console.log('[Background Image API] Could not fetch profile image:', error);
      // Continue without profile image - it's optional
    }

    console.log('[Background Image API] Generating background image for:', name);
    console.log('[Background Image API] Bio preview:', bio.substring(0, 100) + '...');
    console.log('[Background Image API] Profile image from request:', !!profileImage);
    console.log('[Background Image API] Profile image from Firebase:', !!profileImageUrl);
    
    // Use profile image from request if provided, otherwise use the one from Firebase
    const finalProfileImage = profileImage || profileImageUrl;
    console.log('[Background Image API] Final profile image available:', !!finalProfileImage);
    
    // Call OpenAI API with simplified responses approach
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const openaiUrl = `${baseUrl}/api/openai`;
    console.log('[Background Image API] Calling OpenAI API at:', openaiUrl);
    
    const openaiResponse = await fetch(openaiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'background',
        profile: {
          name: name,
          bio: bio,
          profileImage: finalProfileImage,
          userId: userId
        }
      })
    });
    
    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('[Background Image API] OpenAI API failed with status:', openaiResponse.status);
      console.error('[Background Image API] OpenAI API error:', errorText);
      return NextResponse.json({ error: 'Failed to generate image', details: errorText }, { status: 500 });
    }
    
    // Handle streaming response from OpenAI
    const contentType = openaiResponse.headers.get('content-type');
    if (contentType?.includes('text/event-stream')) {
      console.log('[Background Image API] Processing streaming response');
      
      // Create a stream to send partial images to client
      const stream = new ReadableStream({
        async start(controller) {
          let finalImageUrl: string | null = null;
          
          const reader = openaiResponse.body?.getReader();
          if (!reader) {
            controller.error(new Error('No reader available'));
            return;
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
                      
                      // Stream partial image to client
                      const partialImageUrl = `data:image/png;base64,${imageData}`;
                      finalImageUrl = partialImageUrl; // Keep updating with latest
                      
                      // Send partial image update to client
                      const eventData = `data: ${JSON.stringify({
                        type: 'partial_image',
                        imageUrl: partialImageUrl,
                        index: data.partial_image_index
                      })}\n\n`;
                      
                      controller.enqueue(new TextEncoder().encode(eventData));
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
            
            // After streaming is complete, upload final image to Firebase Storage
            if (finalImageUrl) {
              console.log('[Background Image API] Image generated, uploading to storage...');
              
              // Upload to Firebase Storage using Admin SDK
              const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
              console.log('[Background Image API] Storage bucket from env:', storageBucket);
              
              const bucket = storageBucket ? storage.bucket(storageBucket) : storage.bucket();
              console.log('[Background Image API] Using bucket name:', bucket.name);
              
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
              
              // Get the public URL using the bucket's configured name
              const bucketName = bucket.name;
              const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}?t=${Date.now()}`;
              console.log('[Background Image API] Public URL generated:', publicUrl);
              
              // Send final result with Firebase Storage URL
              const finalEventData = `data: ${JSON.stringify({
                type: 'completed',
                imageUrl: publicUrl
              })}\n\n`;
              
              controller.enqueue(new TextEncoder().encode(finalEventData));
            } else {
              console.error('[Background Image API] No image received from OpenAI');
              controller.error(new Error('No image generated'));
            }
            
            controller.close();
          } finally {
            reader.releaseLock();
          }
        }
      });
      
      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
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
