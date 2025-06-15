import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/options';
import { getFirebaseAdmin } from '@/lib/firebase/adminConfig';

// Server-side upload function using Firebase Admin SDK
async function uploadBackgroundImageAdmin(base64Data: string, userId: string): Promise<string> {
  try {
    const { storage } = await getFirebaseAdmin();
    
    // Convert base64 to buffer
    const base64WithoutPrefix = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(base64WithoutPrefix, 'base64');
    
    // Create storage reference
    const bucket = storage.bucket();
    const fileName = `users/${userId}/background-image.png`;
    const file = bucket.file(fileName);
    
    // Upload the buffer
    await file.save(buffer, {
      metadata: {
        contentType: 'image/png'
      }
    });
    
    // Make the file publicly readable
    await file.makePublic();
    
    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    console.log('[Firebase] Saved background image to storage for user:', userId);
    
    return publicUrl;
  } catch (error) {
    console.error('[Background Image API] Server-side upload failed:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get session to verify user
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    const body = await request.json();
    const { bio, name, profileImage, base64Data, action, debug } = body;
    
    // Enhanced logging when debug mode is enabled
    if (debug) {
      console.log('[Background Image API] DEBUG MODE ENABLED');
      console.log('[Background Image API] Request details:', {
        bio: bio ? `${bio.substring(0, 50)}...` : 'None',
        name: name || 'None',
        hasProfileImage: !!profileImage,
        profileImageLength: profileImage ? profileImage.length : 0,
        action,
        timestamp: new Date().toISOString()
      });
    }
    
    // Handle upload action
    if (action === 'upload' && base64Data) {
      try {
        const imageUrl = await uploadBackgroundImageAdmin(base64Data, userId);
        return NextResponse.json({ imageUrl });
      } catch (error) {
        console.error('[Background Image API] Upload failed:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
      }
    }
    
    // Handle generation action (streaming)
    if (!name) {
      return NextResponse.json({ error: 'Missing name' }, { status: 400 });
    }
    
    // Use profile image from request if provided
    const finalProfileImage = profileImage;

    // Fallback bio text
    const bioText = bio && bio.trim() !== '' ? bio : 'No bio provided';
    // Build the custom prompt with minor adjustments
    let promptString = `Generate a simple, minimal, modern, abstract image suitable as the background on a user's profile, for the user with the following details: ${bioText}.`;
    if (finalProfileImage) {
      promptString += ` Analyze the attached profile image to understand the person's style, main colors, and aesthetic preferences. The background must use colors and styles that complement the profile image.`;
    } else {
      promptString += ` No profile image provided, so use a neutral modern style, using darker colors, so that white text can be easily read on top of it.`;
    }
    promptString += ` The image should have no text, people, or recognizable objects. White text should be easily readable on top of it.`;

    // Initialize encoder for streaming
    const encoder = new TextEncoder();

    // Prepare structured input for streaming
    const userMessage = {
      role: 'user',
      content: [
        { type: 'input_text', text: promptString },
        ...(finalProfileImage ? [{ type: 'input_image', image_url: finalProfileImage, detail: 'auto' }] : [])
      ]
    };

    // Create streaming response with abort handling
    const stream = new ReadableStream({
      async start(controller) {
        let isControllerClosed = false;
        
        // Check if request was aborted
        if (request.signal?.aborted) {
          controller.close();
          return;
        }
        
        // Listen for request abort
        const abortHandler = () => {
          isControllerClosed = true;
          try {
            controller.close();
          } catch (e) {
            console.warn('[Background Image API] Error closing controller on abort:', e);
          }
        };
        
        request.signal?.addEventListener('abort', abortHandler);
        
        // Monitor controller state
        const originalClose = controller.close.bind(controller);
        controller.close = () => {
          if (!isControllerClosed) {
            isControllerClosed = true;
            request.signal?.removeEventListener('abort', abortHandler);
            originalClose();
          }
        };
        
        try {
          console.log('[OpenAI] Starting background image request:', {
            model: 'gpt-4o',
            hasProfileImage: !!finalProfileImage,
            promptLength: promptString.length,
            timestamp: new Date().toISOString()
          });
          
          const startTime = Date.now();
          
          // Use the fetch API directly to call OpenAI Responses API with streaming
          const fetchResponse = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify({
              model: 'gpt-4o',
              input: [userMessage],
              stream: true,
              tools: [
                {
                  type: 'image_generation',
                  partial_images: 3,
                  size: '1024x1536',
                  output_format: 'png',
                  quality: 'medium'
                }
              ]
            })
          });
          
          if (!fetchResponse.ok) {
            const error = await fetchResponse.json().catch(() => ({}));
            throw new Error(`OpenAI API error: ${fetchResponse.status} ${fetchResponse.statusText} - ${JSON.stringify(error)}`);
          }
          
          if (!fetchResponse.body) {
            throw new Error('No response body from OpenAI Responses API');
          }
          
          const reader = fetchResponse.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          
          console.log('[OpenAI] Request sent, streaming response...');
          
          let lastImageUrl = '';
          let partialCount = 0;
          let eventCount = 0;
          let firstEventTime: number | null = null;
          let eventTypes: string[] = []; // Track event types for debugging
          let rawEvents: any[] = []; // Store raw events for debugging (limited to first 10)
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                break;
              }

              const chunk = decoder.decode(value, { stream: true });
              buffer += chunk;
              
              // Process complete lines
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep incomplete line
              
              for (const line of lines) {
                if (line.trim() === '') continue;
                
                eventCount++;
                const eventTime = Date.now();
                
                if (firstEventTime === null) {
                  firstEventTime = eventTime;
                }
                
                if (line.startsWith('data: ')) {
                  try {
                    const jsonStr = line.slice(6).trim();
                    if (jsonStr === '[DONE]') {
                      break;
                    }
                    
                    const data = JSON.parse(jsonStr);
                    
                    // Enhanced debugging: Track event types and store samples
                    const eventType = data.type || (data.partial ? 'partial_image' : data.image_b64 ? 'final_image' : 'unknown');
                    eventTypes.push(eventType);
                    
                    if (rawEvents.length < 10) {
                      rawEvents.push({
                        type: eventType,
                        hasPartialB64: !!(data.partial_image_b64 || data.delta?.image?.b64_json || (data.partial && data.b64_json)),
                        hasFullB64: !!(data.image_b64 || data.b64_json),
                        keys: Object.keys(data),
                        timestamp: eventTime - startTime
                      });
                    }
                    
                    // Check for partial images in various formats
                    const partialB64 = data.partial_image_b64 || data.delta?.image?.b64_json || (data.partial && data.b64_json);
                    const fullB64 = data.image_b64 || data.b64_json;
                    
                    // Handle partial images
                    if (partialB64 && (data.partial || data.partial_image_b64 || data.delta?.image)) {
                      partialCount++;
                      const url = `data:image/png;base64,${partialB64}`;
                      lastImageUrl = url;
                      console.log(`[OpenAI] Received partial image ${partialCount}, size: ${url.length}`);
                      
                      // Check if controller is still open before enqueueing
                      if (!isControllerClosed) {
                        try {
                          const streamData = `data: ${JSON.stringify({ type: 'partial_image', imageUrl: url })}\n\n`;
                          controller.enqueue(encoder.encode(streamData));
                        } catch (controllerError) {
                          console.warn(`[Background Image API] Controller error while streaming partial image ${partialCount}:`, controllerError);
                          isControllerClosed = true;
                        }
                      }
                    }
                    
                    // Handle final image
                    else if (fullB64 && !data.partial) {
                      console.log(`[OpenAI] Received final image, size: ${fullB64.length}`);
                      lastImageUrl = `data:image/png;base64,${fullB64}`;
                    }
                    
                  } catch (parseError) {
                    console.warn('[Background Image API] Failed to parse streaming data:', parseError);
                  }
                }
              }
              
              if (lastImageUrl && buffer.includes('[DONE]')) break;
            }
          } finally {
            reader.releaseLock();
          }
          
          const totalTime = Date.now() - startTime;
          console.log('[OpenAI] Background image generation completed:', {
            totalTime: `${totalTime}ms`,
            partialCount,
            hasImage: !!lastImageUrl,
            eventTypes: [...new Set(eventTypes)], // Unique event types
            totalEvents: eventCount,
            sampleEvents: rawEvents
          });
          
          // Check if we got any image data
          if (lastImageUrl) {
            if (!isControllerClosed) {
              try {
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ type: 'completed', imageUrl: lastImageUrl })}\n\n`
                ));
                console.log('[Background Image API] Successfully sent completion event');
              } catch (controllerError) {
                console.warn('[Background Image API] Controller error while sending completion event:', controllerError);
                isControllerClosed = true;
              }
            } else {
              console.warn('[Background Image API] Controller already closed, skipping completion event');
            }
          } else {
            console.error('[Background Image API] CRITICAL: Stream completed but no image data received');
            console.error('[Background Image API] This indicates an OpenAI API issue - they returned 200 but no image events');
            console.error('[Background Image API] Debug info:', {
              totalEvents: eventCount,
              partialImages: partialCount,
              streamDuration: `${totalTime}ms`,
              firstEventTime: firstEventTime ? `${firstEventTime - startTime}ms` : 'N/A',
              eventTypes: [...new Set(eventTypes)],
              sampleEvents: rawEvents,
              possibleCauses: [
                'OpenAI API rate limiting (silent)',
                'OpenAI API service degradation',
                'Model temporarily unavailable',
                'Request rejected by content filter',
                'API quota exceeded'
              ]
            });
            
            if (!isControllerClosed) {
              try {
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ 
                    type: 'error', 
                    message: 'No image data received from OpenAI',
                    debugInfo: { 
                      eventCount, 
                      partialCount, 
                      totalTime,
                      timeToFirstEvent: firstEventTime ? firstEventTime - startTime : null,
                      possibleCause: eventCount === 0 ? 'API_NO_RESPONSE' : 'API_NO_IMAGE_DATA'
                    }
                  })}\n\n`
                ));
              } catch (controllerError) {
                console.warn('[Background Image API] Controller error while sending error event:', controllerError);
                isControllerClosed = true;
              }
            } else {
              console.warn('[Background Image API] Controller already closed, skipping error event');
            }
          }
          
        } catch (error) {
          console.error('[Background Image API] Stream error:', error);
          
          // Categorize the error for better debugging
          let errorCategory = 'UNKNOWN';
          let errorDetails = '';
          
          if (error instanceof Error) {
            const errorMessage = error.message.toLowerCase();
            if (errorMessage.includes('rate') || errorMessage.includes('quota')) {
              errorCategory = 'RATE_LIMIT';
              errorDetails = 'OpenAI API rate limit or quota exceeded';
            } else if (errorMessage.includes('timeout')) {
              errorCategory = 'TIMEOUT';
              errorDetails = 'Request timed out';
            } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
              errorCategory = 'NETWORK';
              errorDetails = 'Network connectivity issue';
            } else if (errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
              errorCategory = 'AUTH';
              errorDetails = 'Authentication or authorization failed';
            } else if (errorMessage.includes('model')) {
              errorCategory = 'MODEL';
              errorDetails = 'Model unavailable or invalid';
            } else {
              errorDetails = error.message;
            }
          }
          
          console.error('[Background Image API] Error category:', errorCategory);
          console.error('[Background Image API] Error details:', errorDetails);
          
          if (!isControllerClosed) {
            try {
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ 
                  type: 'error', 
                  message: 'Stream failed',
                  category: errorCategory,
                  details: errorDetails
                })}\n\n`
              ));
            } catch (controllerError) {
              console.warn('[Background Image API] Controller error while sending stream error:', controllerError);
              isControllerClosed = true;
            }
          } else {
            console.warn('[Background Image API] Controller already closed, skipping stream error');
          }
        } finally {
          console.log('[Background Image API] Cleaning up stream, controller closed:', isControllerClosed);
          if (!isControllerClosed) {
            try {
              controller.close();
              console.log('[Background Image API] Successfully closed controller');
            } catch (closeError) {
              console.warn('[Background Image API] Error closing controller:', closeError);
            }
          }
        }
      }
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      }
    });

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
