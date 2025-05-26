import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';
import { db } from '../../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Initialize OpenAI client with proper null check for the API key
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY, // Server-side environment variable
    })
  : null;

// Check if OpenAI client is properly initialized
if (!openai) {
  console.error('OpenAI API key is missing. Please set OPENAI_API_KEY in your environment variables.');
}

// Helper function to extract social media links from profile
function extractSocialLinks(profile: any): string | null {
  if (!profile) return null;
  
  const socialLinks: string[] = [];
  
  // Extract individual social fields
  const platforms = [
    'facebook', 'instagram', 'twitter', 'linkedin', 'snapchat', 'whatsapp', 'telegram', 'x'
  ];
  
  for (const platform of platforms) {
    const usernameKey = `${platform}Username`;
    const urlKey = `${platform}Url`;
    
    if (profile[usernameKey] && profile[usernameKey].trim() !== '') {
      socialLinks.push(`${platform}: ${profile[usernameKey]}${profile[urlKey] ? ` (${profile[urlKey]})` : ''}`);
    }
  }
  
  // Also check socialProfiles array for backward compatibility
  if (profile.socialProfiles && Array.isArray(profile.socialProfiles)) {
    profile.socialProfiles.forEach((social: any) => {
      if (social.platform && social.username && social.username.trim() !== '' && 
          !socialLinks.some(link => link.startsWith(social.platform))) {
        socialLinks.push(`${social.platform}: ${social.username}${social.url ? ` (${social.url})` : ''}`);
      }
    });
  }
  
  return socialLinks.length > 0 ? socialLinks.join('\n') : null;
}

export async function POST(request: NextRequest) {
  try {
    // Verify OpenAI client is initialized
    if (!openai) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    // Verify user is authenticated - Note: getServerSession usage in Next.js App Router
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const { type, profile } = await request.json();
    
    // Check if we've already generated AI content for this user
    if (profile?.userId) {
      try {
        const aiContentRef = doc(db, 'ai_content', profile.userId);
        const aiContentSnap = await getDoc(aiContentRef);
        
        if (aiContentSnap.exists()) {
          const aiContent = aiContentSnap.data();
          
          // If the requested type already exists in the stored AI content, return it
          if (type === 'bio' && aiContent.bio) {
            return NextResponse.json({ bio: aiContent.bio });
          } else if (type === 'background' && aiContent.backgroundImage) {
            return NextResponse.json({ imageUrl: aiContent.backgroundImage });
          } else if (type === 'avatar' && aiContent.avatarImage) {
            return NextResponse.json({ imageUrl: aiContent.avatarImage });
          }
          // If content doesn't exist for the specific type, continue to generate it
        }
      } catch (error) {
        console.error('Error checking for existing AI content:', error);
        // Continue with generation if there's an error checking
      }
    }

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
    // Safety check for OpenAI client
    if (!openai) {
      return NextResponse.json(
        { bio: 'Connecting people through technology' }
      );
    }

    // Extract social media information from profile
    const socialLinks = extractSocialLinks(profile);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that generates short, engaging personal bios.'
        },
        {
          role: 'user',
          content: `Generate a creative, engaging bio for a person named ${profile.name}. 
          The bio should be no more than 10 words and should be personal and uplifting.
          Only return the bio text, nothing else.
          
          ${socialLinks ? `Here are their social media profiles to help you understand them better:
          ${socialLinks}` : ''}`
        }
      ],
      max_tokens: 50,
      temperature: 0.7,
    });

    const bio = response.choices[0]?.message?.content?.trim() || 
      'Connecting people through technology';
    
    // Store the generated bio in Firestore
    if (profile.userId) {
      try {
        const aiContentRef = doc(db, 'ai_content', profile.userId);
        await setDoc(aiContentRef, { bio }, { merge: true });
      } catch (error) {
        console.error('Error storing AI bio content:', error);
      }
    }
    
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
    // Safety check for OpenAI client
    if (!openai) {
      console.error('OpenAI client not initialized - API key may be missing');
      return NextResponse.json({ imageUrl: '/gradient-bg.jpg' });
    }

    // Extract social media information from profile
    const socialLinks = extractSocialLinks(profile);
    
    console.log('Starting OpenAI background image generation with model: gpt-image-1');
    
    try {
      // Create a prompt for the image generation
      const prompt = `Create an abstract, gradient background image that represents the essence of ${profile.name}. 
      The image should be subtle, elegant, and suitable as a profile page background. 
      Use soft colors that create a professional appearance. No text or people should be visible.
      
      ${socialLinks ? `Personalize based on these social media profiles:
      ${socialLinks}` : ''}`;
      
      console.log('OpenAI request prompt:', prompt);
      
      // Use the simple API format exactly as shown in the example - without additional parameters
      console.log('Calling OpenAI API with minimal parameters');
      
      // Create a promise that rejects after a timeout
      const timeout = new Promise((_, reject) => {
        const timeoutId = setTimeout(() => {
          clearTimeout(timeoutId);
          reject(new Error('OpenAI API request timed out after 10 seconds'));
        }, 10000); // 10 second timeout
      });
      
      // Race the API call against the timeout
      const result = await Promise.race([
        openai.images.generate({
          model: 'gpt-image-1',
          prompt,
        }),
        timeout
      ]) as OpenAI.Images.ImagesResponse;
      
      console.log('OpenAI response received, data structure:', 
        JSON.stringify(Object.keys(result), null, 2));
      
      // Log the complete response for debugging
      console.log('Full OpenAI response:', JSON.stringify(result, null, 2));
      
      // Check all possible response formats
      console.log('Response data array:', result.data);
      console.log('First item in data array:', result.data[0]);
      
      // Try to find a URL or image data in the response
      let imageUrl = '/gradient-bg.jpg';
      
      if (result.data && result.data[0]) {
        if (result.data[0].url) {
          // If there's a direct URL
          imageUrl = result.data[0].url;
          console.log('Found URL in response:', imageUrl);
        } else if (result.data[0].b64_json) {
          // If there's base64 data
          imageUrl = `data:image/png;base64,${result.data[0].b64_json}`;
          console.log('Found base64 data in response');
        } else if (typeof result.data[0] === 'string') {
          // If the data itself is a string (URL)
          imageUrl = result.data[0];
          console.log('Data is a string URL:', imageUrl);
        } else {
          console.error('Unexpected response format:', result.data[0]);
          // Keep the default image URL
        }
      } else {
        console.error('No data in response:', result);
        // Keep the default image URL
      }
      
      // Store the generated background image URL in Firestore
      if (profile.userId) {
        try {
          const aiContentRef = doc(db, 'ai_content', profile.userId);
          await setDoc(aiContentRef, { backgroundImage: imageUrl }, { merge: true });
        } catch (error) {
          console.error('Error storing AI background image content:', error);
        }
      }
      
      return NextResponse.json({ imageUrl });
    } catch (error: any) {
      // Log detailed error information for debugging
      console.error('OpenAI API error during background generation:');
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      } else if (error.message) {
        console.error('Error message:', error.message);
      } else {
        console.error('Unknown error:', error);
      }
      
      return NextResponse.json({ 
        imageUrl: '/gradient-bg.jpg',
        error: error.message || 'Unknown error during image generation'
      });
    }
  } catch (error) {
    console.error('Background generation error:', error);
    return NextResponse.json({ imageUrl: '/gradient-bg.jpg' });
  }
}

async function generateAvatar(profile: any) {
  try {
    // Skip avatar generation if profile already has a picture from Google sign-in
    if (profile.picture && profile.picture.includes('googleusercontent.com')) {
      return NextResponse.json({ imageUrl: profile.picture });
    }
    
    // Safety check for OpenAI client
    if (!openai) {
      return NextResponse.json({ 
        imageUrl: profile.picture || '/default-avatar.png' 
      });
    }

    // Extract social media information from profile
    const socialLinks = extractSocialLinks(profile);
    
    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: `Create a stylized, artistic profile picture based on the essence of a person named ${profile.name}. 
      The image should be a professional, friendly avatar suitable for a social network. 
      It should be a portrait-style image with a clean background. 
      Ensure the design is simple, recognizable, and approachable.
      
      ${socialLinks ? `Personalize based on these social media profiles:
      ${socialLinks}` : ''}`,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    const avatarUrl = response.data && response.data[0] && response.data[0].url ? response.data[0].url : (profile.picture || '/default-avatar.png');
    
    // Store the generated avatar URL in Firestore
    if (profile.userId) {
      try {
        const aiContentRef = doc(db, 'ai_content', profile.userId);
        await setDoc(aiContentRef, { avatarImage: avatarUrl }, { merge: true });
      } catch (error) {
        console.error('Error storing AI avatar content:', error);
      }
    }
    
    return NextResponse.json({ imageUrl: avatarUrl });
  } catch (error) {
    console.error('Avatar generation error:', error);
    return NextResponse.json({ 
      imageUrl: profile.picture || '/default-avatar.png' 
    });
  }
}
