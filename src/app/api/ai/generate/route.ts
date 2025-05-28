import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';
// Temporarily disabled Firebase imports
// import { db } from '../../../lib/firebase';
// import { doc, getDoc, setDoc } from 'firebase/firestore';

// Create a custom type for our extended OpenAI client
type ExtendedOpenAI = OpenAI & {
  // Our custom responses API
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
  
  // Custom images API with our implementation
  images: {
    generate: (params: {
      model?: string;
      prompt: string;
      n?: number;
      size?: '256x256' | '512x512' | '1024x1024' | '1024x1536' | '1536x1024' | '1792x1024' | '1024x1792' | 'auto';
      quality?: 'standard' | 'hd' | 'medium';
    }) => Promise<{
      data: Array<{
        url: string;
      }>;
    }>;
  };
};

// Initialize our extended OpenAI client
let openai: ExtendedOpenAI | null = null;

try {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }
  
  // Initialize the base client with all required configuration
  const baseClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: 'https://api.openai.com/v1',
    defaultQuery: { 'api-version': '2024-02-15-preview' },
    defaultHeaders: { 
      'OpenAI-Beta': 'assistants=v2',
      'Content-Type': 'application/json'
    }
  });
  
  // Cast to our extended type and add custom methods
  openai = baseClient as unknown as ExtendedOpenAI;
  
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
  
  // Add the images API with our custom implementation
  openai.images = {
    generate: async (params) => {
      // Prepare the request body with proper typing
      const requestBody: any = {
        ...params,
        model: params.model || 'dall-e-3',
        n: params.n || 1,
        size: params.size || '1024x1024'
      };
      
      // Only add quality if it's a valid value
      if (params.quality && ['standard', 'hd'].includes(params.quality)) {
        requestBody.quality = params.quality;
      } else if (params.quality === 'medium') {
        // Map 'medium' to 'standard' if needed
        requestBody.quality = 'standard';
      }
      
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`OpenAI Image API error: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`);
      }
      
      return response.json();
    }
  } as ExtendedOpenAI['images'];
  
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
  const requestId = Math.random().toString(36).substring(2, 8);
  const requestStartTime = Date.now();
  
  console.log(`[${new Date().toISOString()}] [Request ${requestId}] Starting API request`);
  
  try {
    // Log request headers for debugging
    const headers = Object.fromEntries(request.headers.entries());
    console.log(`[Request ${requestId}] Headers:`, JSON.stringify(headers, null, 2));
    
    // Verify OpenAI client is initialized
    if (!openai) {
      const error = 'OpenAI API key is not configured';
      console.error(`[Request ${requestId}] ${error}`);
      return NextResponse.json(
        { error, code: 'OPENAI_NOT_CONFIGURED' },
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

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await request.json();
      console.log(`[Request ${requestId}] Request body:`, JSON.stringify({
        type: requestBody?.type,
        hasProfile: !!requestBody?.profile,
        profileKeys: requestBody?.profile ? Object.keys(requestBody.profile) : []
      }, null, 2));
    } catch (e) {
      const error = 'Failed to parse request body';
      console.error(`[Request ${requestId}] ${error}:`, e);
      return NextResponse.json(
        { error, code: 'INVALID_REQUEST_BODY' },
        { status: 400 }
      );
    }
    
    const { type, profile } = requestBody;
    
    // Validate request parameters
    if (!type || typeof type !== 'string') {
      const error = 'Missing or invalid type parameter';
      console.error(`[Request ${requestId}] ${error}`);
      return NextResponse.json(
        { error, code: 'INVALID_TYPE_PARAMETER' },
        { status: 400 }
      );
    }
    
    if (!profile || typeof profile !== 'object') {
      const error = 'Missing or invalid profile data';
      console.error(`[Request ${requestId}] ${error}`);
      return NextResponse.json(
        { error, code: 'INVALID_PROFILE_DATA' },
        { status: 400 }
      );
    }
    
    console.log(`[Request ${requestId}] Processing request for type: ${type}`);
    
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
    const errorId = `err_${Math.random().toString(36).substring(2, 8)}`;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    const errorDetails = {
      errorId,
      message: errorMessage,
      name: error instanceof Error ? error.name : 'UnknownError',
      stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      timestamp: new Date().toISOString(),
      requestId,
      durationMs: Date.now() - requestStartTime,
      // Include additional context that might be helpful for debugging
      environment: process.env.NODE_ENV,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      openAiKeyPrefix: process.env.OPENAI_API_KEY ? 
        `${process.env.OPENAI_API_KEY.substring(0, 5)}...${process.env.OPENAI_API_KEY.substring(-3)}` : 
        'Not set'
    };

    console.error(`[Request ${requestId}] AI generation error (${errorId}):`, JSON.stringify(errorDetails, null, 2));
    
    // Return detailed error in development, sanitized in production
    return NextResponse.json(
      { 
        error: 'Failed to generate content',
        errorId,
        code: 'GENERATION_ERROR',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorDetails : {
          errorId,
          message: errorMessage
        }
      },
      { 
        status: 500,
        headers: {
          'X-Request-ID': requestId,
          'X-Error-ID': errorId
        }
      }
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
            text: `Generate a hyper-personalized bio for a person named ${profile.name}. The bio should be no more than 20 words. Only return the bio text, nothing else. Do not mention their name in the bio. You should always come up with something unique and creative.`
          }
        ]
      }
    ];

    // Add social profile URLs to the prompt if available
    if (socialProfileUrls.length > 0) {
      const socialLinksText = socialProfileUrls.join(', ');
      input[1].content[0].text += `Please follow these web links to read about ${profile.name}: ${socialLinksText}. If the webpage was updated more recently, that information is more important.`;
    }

    // Prepare the request for the responses API
    const requestParams = {
      model: 'gpt-4.1',
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
      temperature: .8,
      max_output_tokens: 2048,
      top_p: 1,
      store: true
    };

    console.log('Sending request to OpenAI API:', JSON.stringify({
      model: requestParams.model,
      input: requestParams.input.map(i => ({
        role: i.role,
        content: i.content.map(c => ({
          type: c.type,
          text: c.text.substring(0, 50) + (c.text.length > 50 ? '...' : '')
        }))
      })),
      tools: requestParams.tools
    }, null, 2));
    
    const response = await openai.responses.create(requestParams);
    
    console.log('Received response from OpenAI API:', JSON.stringify({
      output: response.output?.map((o: any) => ({
        role: o.role,
        content: o.content?.map((c: any) => ({
          type: c.type,
          text: c.text ? c.text.substring(0, 100) + (c.text.length > 100 ? '...' : '') : undefined
        }))
      }))
    }, null, 2));
    
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
      const errorMessage = 'No bio was generated in the response';
      const errorDetails = {
        responseSummary: {
          outputLength: response.output?.length,
          assistantResponse: !!assistantResponse,
          hasContent: assistantResponse?.content?.length > 0,
          rawResponse: JSON.stringify(response, null, 2).substring(0, 1000) + '...' // Truncate long responses
        },
        requestParams: {
          model: requestParams.model,
          inputLength: requestParams.input.length,
          hasTools: requestParams.tools?.length > 0,
          inputPreview: JSON.stringify(requestParams.input, null, 2).substring(0, 500) + '...'
        },
        profile: {
          name: profile?.name,
          contactChannels: Object.keys(profile?.contactChannels || {})
        },
        timestamp: new Date().toISOString()
      };
      
      console.error(errorMessage, errorDetails);
      
      // Return error with details for frontend
      return NextResponse.json(
        { 
          error: errorMessage,
          details: errorDetails,
          code: 'NO_BIO_GENERATED'
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ bio });
    
  } catch (error) {
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'UnknownError',
      profile: {
        name: profile?.name,
        hasContactChannels: !!profile?.contactChannels,
        contactChannels: profile?.contactChannels ? Object.keys(profile.contactChannels) : []
      },
      timestamp: new Date().toISOString(),
      errorType: 'BIO_GENERATION_ERROR'
    };

    console.error('Error in generateBio:', JSON.stringify(errorDetails, null, 2));
    
    // Return a more detailed error response
    return NextResponse.json(
      { 
        error: 'Failed to generate bio',
        details: errorDetails.message,
        code: 'BIO_GENERATION_ERROR'
      },
      { status: 500 }
    );
  }
}

async function generateBackground(profile: any) {
  try {
    // Log the start of background generation
    console.log('Starting background image generation for profile:', {
      name: profile.name,
      hasExistingBackground: !!profile.backgroundImage
    });

    // Return existing background image if it exists
    if (profile.backgroundImage) {
      console.log('Using existing background image:', profile.backgroundImage);
      return NextResponse.json({ imageUrl: profile.backgroundImage });
    }

    // Safety check for OpenAI client
    if (!openai) {
      console.error('OpenAI client is not initialized');
      return NextResponse.json({ 
        imageUrl: null,
        error: 'OpenAI client not initialized' 
      });
    }

    // Extract social media information from profile
    const socialLinks = extractSocialLinks(profile);
    
    console.log('Generating background image with prompt for:', profile.name);
    
    // Using type assertion for the size parameter to satisfy TypeScript
    // Create a safer, more abstract prompt
    const safePrompt = `Create a soft, abstract gradient background with subtle textures. 
      Use a color palette that's professional and modern. No text, people, or recognizable objects. 
      The style should be minimal and clean, suitable for a profile background.`;
      
    console.log('Using safe prompt for background image generation');
    
    console.log('Sending request to OpenAI with prompt:', safePrompt);
    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: safePrompt,
      n: 1,
      size: '1024x1536' as any, // Type assertion to bypass TypeScript error for gpt-image-1 model
      quality: 'medium',
    });

    // Log the raw response for debugging
    console.log('OpenAI API response:', JSON.stringify({
      hasData: !!response.data,
      dataLength: response.data?.length,
      firstItem: response.data?.[0] ? { 
        hasUrl: !!response.data[0].url,
        keys: Object.keys(response.data[0])
      } : 'no items'
    }, null, 2));

    // Check if we got a valid image URL
    const imageUrl = response.data?.[0]?.url;
    
    if (!imageUrl) {
      const errorMessage = 'No image URL in response from OpenAI API';
      console.error(errorMessage, 'Response structure:', JSON.stringify(response, null, 2));
      return NextResponse.json({ 
        imageUrl: null,
        error: errorMessage,
        responseStructure: JSON.stringify(response, null, 2)
      }, { status: 500 });
    }
    
    console.log('Successfully generated background image');
    
    // Return the generated image URL
    return NextResponse.json({ 
      imageUrl,
      generated: true 
    });
    
  } catch (error) {
    console.error('Background generation error:', error);
    return NextResponse.json({ 
      imageUrl: null,
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
}

async function generateAvatar(profile: any) {
  try {
    console.log('Starting avatar generation for profile:', {
      name: profile.name,
      hasPicture: !!profile.picture,
      hasProfileImage: !!profile.profileImage
    });
    
    // Return existing profile image if it exists
    if (profile.picture || profile.profileImage) {
      const existingImage = profile.picture || profile.profileImage;
      console.log('Using existing profile image:', existingImage);
      return NextResponse.json({ 
        imageUrl: existingImage,
        generated: false
      });
    }
    
    // Safety check for OpenAI client
    if (!openai) {
      return NextResponse.json({ 
        imageUrl: '/default-avatar.png' 
      });
    }

    // Extract social media information from profile
    const socialLinks = extractSocialLinks(profile);
    
    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: `Create a stylized, artistic profile picture based on the essence of a person named ${profile.name}. 
      The image should be a professional, friendly avatar suitable for a social network. 
      It should be a portrait-style image with a clean background. 
      Ensure the design is simple, recognizable, and approachable`,
      n: 1,
      size: '1024x1024',
      quality: 'medium',
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
