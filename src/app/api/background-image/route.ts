import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/options';

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
        bio,
        name,
        profileImage: body.profileImage
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
    
    // Create streaming response
    const stream = new ReadableStream({
      start(controller) {
        console.log('[Background Image API] Starting streaming response');
        
        const reader = openaiResponse.body!.getReader();
        const decoder = new TextDecoder();
        
        const processStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                console.log('[Background Image API] OpenAI streaming completed');
                controller.close();
                break;
              }
              
              const chunk = decoder.decode(value, { stream: true });
              console.log('[Background Image API] Received chunk from OpenAI, size:', chunk.length);
              
              // Forward the chunk directly to client
              controller.enqueue(new TextEncoder().encode(chunk));
            }
          } catch (error) {
            console.error('[Background Image API] Streaming error:', error);
            controller.error(error);
          }
        };
        
        processStream();
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
