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
          
          const decoder = new TextDecoder();
          let buffer = '';
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                console.log('[Background Image API] OpenAI streaming completed');
                break;
              }

              const chunk = decoder.decode(value, { stream: true });
              buffer += chunk;
              
              // Process complete lines
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep incomplete line
              
              for (const line of lines) {
                if (line.trim() === '') continue;
                
                console.log('[Background Image API] Processing line:', line.substring(0, 100) + '...');
                
                if (line.startsWith('data: ')) {
                  try {
                    const jsonStr = line.slice(6).trim();
                    if (jsonStr === '[DONE]') {
                      console.log('[Background Image API] Received [DONE] signal');
                      break;
                    }
                    
                    const data = JSON.parse(jsonStr);
                    console.log('[Background Image API] Parsed OpenAI data:', JSON.stringify(data, null, 2));
                    console.log('[Background Image API] Full response structure:', JSON.stringify(data, null, 4));
                    
                    // Handle different OpenAI response formats
                    if (data.type === 'content.delta') {
                      // Handle streaming content delta from OpenAI responses API  
                      if (data.delta?.image?.url) {
                        console.log('[Background Image API] Received partial image from OpenAI');
                        const partialEventData = `data: ${JSON.stringify({
                          type: 'partial_image',
                          imageUrl: data.delta.image.url
                        })}\n\n`;
                        controller.enqueue(new TextEncoder().encode(partialEventData));
                      }
                    } else if (data.type === 'response.done' || data.type === 'content.done') {
                      // Handle completion from OpenAI responses API
                      if (data.response?.output?.[0]?.content?.[0]?.image?.url) {
                        finalImageUrl = data.response.output[0].content[0].image.url;
                        console.log('[Background Image API] Final image URL received from OpenAI');
                      } else if (data.content?.[0]?.image?.url) {
                        finalImageUrl = data.content[0].image.url;
                        console.log('[Background Image API] Final image URL received from content');
                      }
                    } else if (data.image?.url || data.imageUrl) {
                      // Handle direct image URL format
                      const imageUrl = data.image?.url || data.imageUrl;
                      if (data.type === 'partial' || data.partial) {
                        console.log('[Background Image API] Received partial image (direct format)');
                        const partialEventData = `data: ${JSON.stringify({
                          type: 'partial_image',
                          imageUrl: imageUrl
                        })}\n\n`;
                        controller.enqueue(new TextEncoder().encode(partialEventData));
                      } else {
                        console.log('[Background Image API] Received final image (direct format)');
                        finalImageUrl = imageUrl;
                      }
                    }
                    
                    // Also check if this is a base64 image in any format
                    if (data.b64_json && !finalImageUrl) {
                      const base64ImageUrl = `data:image/png;base64,${data.b64_json}`;
                      if (data.partial) {
                        console.log('[Background Image API] Received partial base64 image');
                        const partialEventData = `data: ${JSON.stringify({
                          type: 'partial_image',
                          imageUrl: base64ImageUrl
                        })}\n\n`;
                        controller.enqueue(new TextEncoder().encode(partialEventData));
                      } else {
                        console.log('[Background Image API] Received final base64 image');
                        finalImageUrl = base64ImageUrl;
                      }
                    }
                    
                    // Broader pattern matching for any completion event
                    if (!finalImageUrl) {
                      // Check for any nested image URL patterns
                      const checkForImageUrl = (obj: any, path: string = ''): string | null => {
                        if (!obj || typeof obj !== 'object') return null;
                        
                        for (const [key, value] of Object.entries(obj)) {
                          const currentPath = path ? `${path}.${key}` : key;
                          
                          if ((key === 'url' || key === 'imageUrl') && typeof value === 'string' && 
                              (value.startsWith('data:image/') || value.startsWith('http'))) {
                            console.log(`[Background Image API] Found image URL at ${currentPath}:`, value.substring(0, 50) + '...');
                            return value;
                          }
                          
                          if (typeof value === 'object') {
                            const found = checkForImageUrl(value, currentPath);
                            if (found) return found;
                          }
                        }
                        return null;
                      };
                      
                      const foundImageUrl = checkForImageUrl(data);
                      if (foundImageUrl) {
                        finalImageUrl = foundImageUrl;
                        console.log('[Background Image API] Final image URL found via deep search');
                      }
                    }
                    
                    if (finalImageUrl) {
                      console.log('[Background Image API] OpenAI response completed');
                      break;
                    }
                  } catch (parseError) {
                    console.warn('[Background Image API] Failed to parse streaming data:', parseError);
                  }
                }
              }
              
              if (finalImageUrl) break;
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

// Add GET handler for debugging
export async function GET() {
  return NextResponse.json({ 
    message: 'Background image API is working',
    timestamp: new Date().toISOString(),
    method: 'GET'
  });
}
