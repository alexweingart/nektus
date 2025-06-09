import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/options';
import { getFirebaseAdmin } from '@/lib/firebase/adminConfig';
import { getStorage } from 'firebase-admin/storage';

export async function GET() {
  return NextResponse.json({ 
    message: 'Background image API GET works',
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Background Image API] Starting streaming background image generation');
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { bio, name } = body;
    console.log('[Background Image API] Request received for user:', session.user.id);
    console.log('[Background Image API] Bio length:', bio?.length, 'Name:', name);
    
    // Call OpenAI background generation API
    const openaiUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/openai`;
    console.log('[Background Image API] Calling OpenAI API:', openaiUrl);
    
    const openaiResponse = await fetch(openaiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'background',
        profile: {
          userId: session.user.id,
          name,
          bio,
          profileImage: body.profileImage,
          backgroundImage: body.backgroundImage || '',
          contactChannels: body.contactChannels || {}
        }
      })
    });
    
    console.log('[Background Image API] OpenAI response status:', openaiResponse.status);
    
    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('[Background Image API] OpenAI error:', errorText);
      console.error('[Background Image API] OpenAI status:', openaiResponse.status);
      return NextResponse.json({ 
        error: 'OpenAI request failed', 
        status: openaiResponse.status,
        details: errorText 
      }, { status: 500 });
    }
    
    if (!openaiResponse.body) {
      return NextResponse.json({ error: 'No streaming body from OpenAI' }, { status: 500 });
    }
    
    // Create streaming response that processes OpenAI stream and uploads final image
    const stream = new ReadableStream({
      async start(controller) {
        console.log('[Background Image API] Starting streaming response processing');
        let finalImageUrl: string | null = null;
        
        const reader = openaiResponse.body!.getReader();
        const decoder = new TextDecoder();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log('[Background Image API] OpenAI streaming completed');
              break;
            }
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const jsonStr = line.slice(6);
                  if (jsonStr.trim() === '[DONE]') continue;
                  
                  const data = JSON.parse(jsonStr);
                  
                  // Forward streaming updates to client
                  controller.enqueue(new TextEncoder().encode(line + '\n'));
                  
                  // Check for final image in response.completed event
                  if (data.type === 'response.completed' && data.response?.output?.[0]?.result) {
                    const base64Data = data.response.output[0].result;
                    console.log('[Background Image API] Found final image, length:', base64Data.length);
                    
                    // Upload to Firebase Storage
                    console.log('[Background Image API] Uploading to Firebase Storage...');
                    const { adminApp } = await getFirebaseAdmin();
                    const storage = getStorage(adminApp);
                    const bucket = storage.bucket();
                    const fileName = `users/${session.user.id}/background-image-${Date.now()}.png`;
                    const file = bucket.file(fileName);
                    
                    const imageBuffer = Buffer.from(base64Data, 'base64');
                    await file.save(imageBuffer, {
                      metadata: {
                        contentType: 'image/png',
                      },
                    });
                    
                    // Make public
                    await file.makePublic();
                    
                    // Generate public URL
                    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
                    finalImageUrl = publicUrl;
                    
                    console.log('[Background Image API] Image uploaded to:', publicUrl);
                    
                    // Send completion event with Firebase Storage URL
                    const completionEvent = `data: ${JSON.stringify({
                      type: 'completed',
                      imageUrl: publicUrl
                    })}\n\n`;
                    controller.enqueue(new TextEncoder().encode(completionEvent));
                  }
                } catch (e) {
                  // Skip invalid JSON lines
                  console.log('[Background Image API] Skipping invalid JSON line:', line.substring(0, 50));
                }
              }
            }
          }
          
          controller.close();
        } catch (error) {
          console.error('[Background Image API] Streaming error:', error);
          controller.error(error);
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
    
  } catch (error) {
    console.error('[Background Image API] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
