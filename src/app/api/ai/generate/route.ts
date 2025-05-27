import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';
// Temporarily disabled Firebase imports
// import { db } from '../../../lib/firebase';
// import { doc, getDoc, setDoc } from 'firebase/firestore';

// Extend the OpenAI type to include the responses API
declare module 'openai' {
  interface OpenAI {
    responses: {
      create: (params: {
        model: string;
        input: Array<{
          role: 'system' | 'user' | 'assistant';
          content: Array<{
            type: string;
            text: string;
          }>;
        }>;
        tools?: Array<{
          type: string;
          user_location?: {
            type: string;
            country: string;
            region?: string;
            city?: string;
          };
          search_context_size?: string;
        }>;
        temperature?: number;
        max_tokens?: number;
        top_p?: number;
        store?: boolean;
      }) => Promise<any>;
    };
  }
}

// Initialize OpenAI client with beta features
let openai: OpenAI | null = null;
try {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }
  
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    // Use beta endpoint for responses API
    baseURL: 'https://api.openai.com/v1',
    defaultQuery: { 'api-version': '2024-02-15-preview' },
    defaultHeaders: { 
      'OpenAI-Beta': 'assistants=v2',
      'Content-Type': 'application/json'
    }
  });
  
  // Add the responses API to the client
  openai.responses = {
    create: async (params) => {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          ...params,
          // Ensure we're using the latest model if not specified
          model: params.model || 'gpt-4-turbo-preview'
        })
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`);
      }
      
      return response.json();
    }
  };
  
  console.log('OpenAI client with responses API initialized successfully');
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
  console.log('Starting bio generation for profile:', profile?.name || 'unknown');

  // Safety check for OpenAI client
  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }
  
  try {
    // Get social profile URLs
    const socialProfileUrls = getSocialProfileUrls(profile);
    
    // Prepare the input for the responses API with proper typing
    const input: Array<{
      role: 'system' | 'user' | 'assistant';
      content: Array<{ type: string; text: string }>;
    }> = [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: 'You are an amazing copywriter that generates short, personalized, and specific personal bios.'
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Generate a hyper-personalized, specific bio for a person named ${profile.name}. The bio should be no more than 20 words. Only return the bio text, nothing else. Do not mention their name in the bio.`
          }
        ]
      }
    ];

    // Add social profile URLs to the prompt if available
    if (socialProfileUrls.length > 0) {
      const socialLinksText = socialProfileUrls.join('\n');
      input[1].content[0].text += `\n\nPlease follow these web links to read about ${profile.name} and write the bio. If the webpage was updated more recently, that information is more important.`;
      
      // Add each social URL as a separate input
      socialProfileUrls.forEach((url, index) => {
        input.push({
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: url
            }
          ]
        });
      });
    }

    // Prepare the request for the responses API
    const response = await openai.responses.create({
      model: 'gpt-4-turbo-preview',
      input,
      tools: [
        {
          type: 'web_search_preview',
          user_location: {
            type: 'approximate',
            country: 'US',
            region: 'California',
            city: 'San Francisco'
          },
          search_context_size: 'medium'
        }
      ],
      temperature: 0.8,
      max_tokens: 150,
      top_p: 1,
      store: true
    });
    
    console.log('Received response from OpenAI API:', JSON.stringify(response, null, 2));
    
    // Extract the generated bio from the response
    // The response format may vary, so we need to handle different possible structures
    let bio = '';
    
    // Try to find the assistant's response with the generated bio
    const assistantResponse = response.output?.find((item: any) => item.role === 'assistant');
    if (assistantResponse?.content) {
      const textContent = assistantResponse.content.find((c: any) => c.type === 'output_text');
      if (textContent?.text) {
        bio = textContent.text.trim();
      }
    }
    
    // Fallback to the first text content if no assistant response found
    if (!bio && response.output) {
      for (const item of response.output) {
        if (item.content) {
          const textContent = item.content.find((c: any) => c.type === 'output_text' || c.type === 'text');
          if (textContent?.text) {
            bio = textContent.text.trim();
            break;
          }
        }
      }
    }
    
    if (!bio) {
      console.error('No bio was generated in the response:', response);
      throw new Error('No bio was generated in the response');
    }
    
    return NextResponse.json({ bio });
    
  } catch (error) {
    console.error('Error in generateBio:', error);
    // Fallback to a simple bio if the API call fails
    return NextResponse.json({ 
      bio: profile.bio || 'Passionate about connecting with others and sharing experiences.' 
    });
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
