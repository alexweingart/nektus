import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';

// Initialize OpenAI client if API key is available
let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // Server-side environment variable
  });
}

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Check if OpenAI client is initialized
    if (!openai) {
      return NextResponse.json(
        { error: 'AI service not available' },
        { status: 503 }
      );
    }

    // Parse request body
    const { type, profile } = await request.json();

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile data is required' },
        { status: 400 }
      );
    }

    // Handle different generation types
    switch (type) {
      case 'bio':
        return await generateBio(profile);
      case 'background':
        return await generateBackground(profile);
      case 'avatar':
        return await generateAvatar(profile);
      default:
        return NextResponse.json(
          { error: 'Invalid generation type' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('AI generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    );
  }
}

async function generateBio(profile: any) {
  try {
    if (!openai) {
      return NextResponse.json({ bio: 'Connecting people through technology' });
    }
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that generates short, engaging personal bios.'
        },
        {
          role: 'user',
          content: `Generate a creative, engaging bio for a person named ${profile.name}. 
          The bio should be no more than 10 words and should be personal and uplifting.
          Only return the bio text, nothing else.`
        }
      ],
      max_tokens: 50,
      temperature: 0.7,
    });

    const bio = response.choices[0]?.message?.content?.trim() || 
      'Connecting people through technology';
    
    return NextResponse.json({ bio });
  } catch (error) {
    console.error('Bio generation error:', error);
    return NextResponse.json(
      { bio: 'Connecting people through technology' }
    );
  }
}

async function generateBackground(profile: any) {
  try {
    if (!openai) {
      return NextResponse.json({ imageUrl: '/gradient-bg.jpg' });
    }
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `Create an abstract, gradient background image that represents the essence of ${profile.name}. 
      The image should be subtle, elegant, and suitable as a profile page background. 
      Use soft colors that create a professional appearance. No text or people should be visible.`,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    const imageUrl = response.data && response.data[0] && response.data[0].url ? response.data[0].url : '/gradient-bg.jpg';
    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error('Background generation error:', error);
    return NextResponse.json({ imageUrl: '/gradient-bg.jpg' });
  }
}

async function generateAvatar(profile: any) {
  try {
    if (!openai) {
      return NextResponse.json({ 
        imageUrl: profile.picture || '/default-avatar.png' 
      });
    }
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `Create a stylized, artistic profile picture based on the essence of a person named ${profile.name}. 
      The image should be a professional, friendly avatar suitable for a social network. 
      It should be a portrait-style image with a clean background. 
      Ensure the design is simple, recognizable, and approachable.`,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    const avatarUrl = response.data && response.data[0] && response.data[0].url ? response.data[0].url : (profile.picture || '/default-avatar.png');
    return NextResponse.json({ imageUrl: avatarUrl });
  } catch (error) {
    console.error('Avatar generation error:', error);
    return NextResponse.json({ 
      imageUrl: profile.picture || '/default-avatar.png' 
    });
  }
}
