import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';
// Temporarily disabled Firebase imports
// import { db } from '../../../lib/firebase';
// import { doc, getDoc, setDoc } from 'firebase/firestore';

// Initialize OpenAI client with proper error handling
let openai: OpenAI | null = null;
try {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }
  
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  console.log('OpenAI client initialized successfully');
} catch (error) {
  console.error('Failed to initialize OpenAI client:', error);
  console.error('Please check your OPENAI_API_KEY in .env.local');
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
        // Temporarily disabled Firestore access
        // const aiContentRef = doc(db, 'ai_content', profile.userId);
        // const aiContentSnap = await getDoc(aiContentRef);
        
        // if (aiContentSnap.exists()) {
        //   const aiContent = aiContentSnap.data();
          
        //   // If the requested type already exists in the stored AI content, return it
        //   if (type === 'bio' && aiContent.bio) {
        //     return NextResponse.json({ bio: aiContent.bio });
        //   } else if (type === 'background' && aiContent.backgroundImage) {
        //     return NextResponse.json({ imageUrl: aiContent.backgroundImage });
        //   } else if (type === 'avatar' && aiContent.avatarImage) {
        //     return NextResponse.json({ imageUrl: aiContent.avatarImage });
        //   }
        //   // If content doesn't exist for the specific type, continue to generate it
        // }
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
        try {
          return await generateBio(profile);
        } catch (error) {
          console.error('Bio generation error:', error);
          return NextResponse.json({ 
            error: 'Failed to generate bio',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 });
        }
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

// Helper function to extract social profile URLs from profile
function getSocialProfileUrls(profile: any): string[] {
  if (!profile?.contactChannels) return [];
  
  const urls: string[] = [];
  const socialPlatforms = [
    'facebook', 'instagram', 'x', 'whatsapp', 'snapchat', 'telegram', 'linkedin'
  ];

  for (const platform of socialPlatforms) {
    const channel = profile.contactChannels[platform];
    if (channel?.url) {
      urls.push(channel.url);
    }
  }

  return urls;
}

async function generateBio(profile: any) {
  // Safety check for OpenAI client
  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

  try {
    // Get social profile URLs
    const socialProfileUrls = getSocialProfileUrls(profile);
    
    // Prepare the messages for the API
    const messages = [
      {
        role: 'system' as const,
        content: [
          {
            type: 'input_text' as const,
            text: 'You are an amazing copywriter that generates short, personalized, and specific personal bios.'
          }
        ]
      },
      {
        role: 'user' as const,
        content: [
          {
            type: 'input_text' as const,
            text: `Generate a hyper-personalized, specific bio for a person named ${profile.name}. The bio should be no more than 20 words. Only return the bio text, nothing else. Do not mention their name in the bio.`
          }
        ]
      }
    ];

    // Add social profile URLs to the prompt if available
    if (socialProfileUrls.length > 0) {
      const socialLinksText = socialProfileUrls.join('\n');
      messages[1].content[0].text += `\n\nPlease follow these web links to read about ${profile.name} and write the bio. If the webpage was updated more recently, that information is more important:\n${socialLinksText}`;
    }

    const requestPayload = {
      model: 'gpt-4.1',
      input: messages,
      text: {
        format: {
          type: 'text' as const
        }
      },
      tools: [{
        type: 'web_search_preview' as const,
        web_search_preview: {
          search_context_size: 'high' as const
        }
      }],
      temperature: 0.8,
      max_output_tokens: 150,
      top_p: 1,
      store: true
    };

    console.log('Sending request to OpenAI API with payload:', JSON.stringify(requestPayload, null, 2));
    
    const response = await openai.responses.create(requestPayload);
    console.log('Raw OpenAI API response:', JSON.stringify(response, null, 2));
    
    // Extract the generated bio from the response
    const firstOutput = response?.output?.[0];
    
    if (firstOutput && 'type' in firstOutput && firstOutput.type === 'message') {
      const messageOutput = firstOutput as { content?: Array<{ type: string; text?: string }> };
      const firstContent = messageOutput.content?.[0];
      
      if (firstContent?.type === 'output_text' && firstContent.text) {
        const bio = firstContent.text.trim();
        console.log('Successfully extracted bio from response');
        return NextResponse.json({ bio });
      }
    }
    
    throw new Error('Unexpected response format from OpenAI API');
    
  } catch (error) {
    console.error('Error generating bio:', error);
    throw error;
  }
}

async function generateBackground(profile: any) {
  try {
    // Safety check for OpenAI client
    if (!openai) {
      return NextResponse.json({ imageUrl: '/gradient-bg.jpg' });
    }

    // Extract social media information from profile
    const socialLinks = extractSocialLinks(profile);
    
    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: `Create an abstract, gradient background image that represents the essence of ${profile.name}. 
      The image should be subtle, elegant, and suitable as a profile page background. 
      Use soft colors that create a professional appearance. No text or people should be visible.
      
      ${socialLinks ? `Personalize based on these social media profiles:
      ${socialLinks}` : ''}`,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    const imageUrl = response.data && response.data[0] && response.data[0].url ? response.data[0].url : '/gradient-bg.jpg';
    
    // Temporarily disabled Firestore save
    // if (profile.userId) {
    //   try {
    //     const aiContentRef = doc(db, 'ai_content', profile.userId);
    //     await setDoc(aiContentRef, { backgroundImage: imageUrl }, { merge: true });
    //   } catch (error) {
    //     console.error('Error storing AI background image content:', error);
    //   }
    // }
    
    return NextResponse.json({ imageUrl });
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
    
    // Temporarily disabled Firestore save
    // if (profile.userId) {
    //   try {
    //     const aiContentRef = doc(db, 'ai_content', profile.userId);
    //     await setDoc(aiContentRef, { avatarImage: avatarUrl }, { merge: true });
    //   } catch (error) {
    //     console.error('Error storing AI avatar content:', error);
    //   }
    // }
    
    return NextResponse.json({ imageUrl: avatarUrl });
  } catch (error) {
    console.error('Avatar generation error:', error);
    return NextResponse.json({ 
      imageUrl: profile.picture || '/default-avatar.png' 
    });
  }
}
