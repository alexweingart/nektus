import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';
// Temporarily disabled Firebase imports
// import { db } from '../../../lib/firebase';
// import { doc, getDoc, setDoc } from 'firebase/firestore';

// Custom types for our extended OpenAI client
// Define our custom sizes which may include ones not supported natively by the OpenAI SDK
type CustomImageSize = '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792' | '1024x1536';
type ResponseFormat = 'url' | 'b64_json';

interface ImageGenerationParams {
  prompt: string;
  n?: number;
  size?: CustomImageSize;
  response_format?: ResponseFormat;
  quality?: 'low' | 'medium' | 'high' | 'auto';
  model?: string; // Making model optional since we'll set it in the wrapper
}

interface ImageGenerationResponse {
  data: Array<{
    b64_json?: string;
    url?: string;
  }>;
}

interface CustomImagesAPI {
  generate: (params: ImageGenerationParams) => Promise<ImageGenerationResponse>;
}

interface CustomResponsesAPI {
  create: (params: any) => Promise<any>;
}

interface CustomOpenAI extends Omit<OpenAI, 'images' | 'responses'> {
  images: CustomImagesAPI;
  responses: CustomResponsesAPI;
}

// Initialize OpenAI client
let openai: CustomOpenAI | null = null;

try {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }
  
  // Initialize the OpenAI client
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.openai.com/v1',
    defaultQuery: { 'api-version': '2024-02-15-preview' },
    defaultHeaders: { 
      'OpenAI-Beta': 'assistants=v2',
      'Content-Type': 'application/json'
    }
  });
  
  // Add the responses API to our custom client
  const customClient = {
    ...client,
    responses: {
      create: async (params: any) => {
        if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }
    
    const response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'OpenAI-Beta': 'assistants=v2'
          },
          body: JSON.stringify({
            ...params,
            model: params.model || 'gpt-4-turbo-preview'
          })
        });
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`);
        }
        
        return response.json();
      }
    }
  };
  
  // Type assertion for our custom client
  openai = {
    ...customClient,
    images: {
      ...customClient.images,
      async generate(params: ImageGenerationParams) {
        try {
          // Extract the size parameter before creating finalParams
          const size = params.size || '1024x1024';
          
          // Remove size from params to avoid type conflicts
          const { size: _, response_format: __, ...restParams } = params;
          
          // Ensure we're using correct model and parameters compatible with gpt-image-1
          const finalParams = {
            ...restParams,
            model: params.model || 'gpt-image-1',
            // Remove response_format as it's not supported with gpt-image-1
            // The API now returns b64_json by default
            // Pass size as a string directly to avoid type conflicts
            size: size, 
            n: params.n || 1,
            quality: params.quality || 'medium'
          };
          
          console.log('Generating image with params:', JSON.stringify(finalParams, null, 2));
          
          // Call the underlying implementation
          const response = await customClient.images.generate(finalParams as any);
          return response;
        } catch (error) {
          console.error('Error in image generation:', error);
          throw error;
        }
      }
    }
  } as unknown as CustomOpenAI;
  
  // OpenAI client initialized
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

// Handle AI generation requests
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(2, 8);
  const requestStartTime = Date.now();
  
  try {
    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (error) {
      console.error(`[${requestId}] Failed to parse request body:`, error);
      return NextResponse.json(
        { 
          error: 'Invalid JSON payload',
          code: 'INVALID_JSON' 
        },
        { status: 400 }
      );
    }

    const { type, profile } = requestBody;
    
    // Input validation
    if (!type) {
      return NextResponse.json(
        { 
          error: 'Type parameter is required',
          code: 'MISSING_TYPE' 
        },
        { status: 400 }
      );
    }
    
    if (!profile) {
      return NextResponse.json(
        { 
          error: 'Profile data is required',
          code: 'MISSING_PROFILE' 
        },
        { status: 400 }
      );
    }
    
    // Verify OpenAI client is initialized
    if (!openai) {
      const error = 'OpenAI API key is not configured';
      console.error(`[${requestId}] ${error}`);
      return NextResponse.json(
        { 
          error,
          code: 'OPENAI_NOT_CONFIGURED' 
        },
        { status: 500 }
      );
    }

    // Route to the appropriate generator
    switch (type) {
      case 'background':
        return await generateBackground(profile);
      case 'bio':
        return await generateBio(profile);
      case 'avatar':
        return await generateAvatar(profile);
      default:
        return NextResponse.json(
          { 
            error: `Invalid generation type: ${type}`,
            code: 'INVALID_GENERATION_TYPE'
          },
          { status: 400 }
        );
    }
  } catch (error) {
    const errorId = `err_${Math.random().toString(36).substring(2, 8)}`;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const openAiKey = process.env.OPENAI_API_KEY || '';
    
    const errorDetails = {
      errorId,
      message: errorMessage,
      name: errorName,
      stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      timestamp: new Date().toISOString(),
      requestId,
      durationMs: Date.now() - requestStartTime,
      environment: process.env.NODE_ENV || 'development',
      hasOpenAIKey: !!openAiKey,
      openAiKeyPrefix: openAiKey 
        ? `${openAiKey.substring(0, 5)}...${openAiKey.substring(-3)}` 
        : 'Not set'
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
  // Bio generation started

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
    // Return existing background image if it exists
    if (profile.backgroundImage) {
      // Using existing background image
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
    
    // Generating background image
    
    // Using type assertion for the size parameter to satisfy TypeScript
    // Create a safer, more abstract prompt
    const safePrompt = `Create a simple, abstract background with subtle textures. 
      Use a color palette that's professional and modern. No text, people, or recognizable objects. 
      The style should be minimal and clean, suitable for a profile background.`;
      
    // Using safe prompt
    
    console.log('Sending request to OpenAI with prompt:', safePrompt);
    console.log('Generating background image with gpt-image-1 model');
    const response = await openai.images.generate({
      prompt: safePrompt,
      size: '1024x1536',
      quality: 'medium',
      model: 'gpt-image-1'
      // Note: response_format is not needed and not supported by gpt-image-1
    });

    // Log the raw response for debugging
    console.log('OpenAI API response:', JSON.stringify({
      hasData: !!response.data,
      dataLength: response.data?.length,
      firstItem: response.data?.[0] ? { 
        hasB64Json: !!response.data[0].b64_json,
        keys: Object.keys(response.data[0])
      } : 'no items'
    }, null, 2));

    // Check if we got a valid base64 image
    const imageB64 = response.data?.[0]?.b64_json;
    if (!imageB64) {
      throw new Error('No base64 image data in response');
    }
    
    // Convert base64 to data URL
    const imageUrl = `data:image/png;base64,${imageB64}`;
    
    if (!imageUrl) {
      const errorMessage = 'No image URL in response from OpenAI API';
      console.error(errorMessage, 'Response structure:', JSON.stringify(response, null, 2));
      return NextResponse.json({ 
        success: false,
        error: errorMessage,
        responseStructure: JSON.stringify(response, null, 2)
      }, { status: 500 });
    }
    
    // Successfully generated background image
    
    // Return the generated image URL in a consistent format
    return NextResponse.json({ 
      success: true,
      data: {
        imageUrl: imageUrl
      }
    });
    
  } catch (error) {
    try {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during background generation';
      console.error('Background generation error:', error);
      return NextResponse.json({ 
        success: false,
        error: `Background generation failed: ${errorMessage}`,
        code: 'BACKGROUND_GENERATION_ERROR'
      }, { status: 500 });
    } catch (innerError) {
      console.error('Error in error handler:', innerError);
      return NextResponse.json({ 
        success: false,
        error: 'An unexpected error occurred',
        code: 'UNEXPECTED_ERROR'
      }, { status: 500 });
    }
  }
}

async function generateAvatar(profile: any) {
  try {
    // Avatar generation started
    
    // Return existing profile image if it exists
    if (profile.picture || profile.profileImage) {
      const existingImage = profile.picture || profile.profileImage;
      // Using existing profile image
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
    
    console.log('Generating avatar with gpt-image-1 model');
    const response = await openai.images.generate({
      prompt: `Create a professional profile picture for ${profile.name || 'a user'}. ` +
              `The image should be a simple, abstract, and modern avatar. ` +
              `Use a clean, professional style with a solid color background. ` +
              `The image should be suitable for a professional networking context.`,
      size: '1024x1024',
      quality: 'medium',
      model: 'gpt-image-1'
      // Note: response_format is not needed and not supported by gpt-image-1
    });

    // Check if we got a valid base64 image
    const imageB64 = response.data?.[0]?.b64_json;
    if (!imageB64) {
      throw new Error('No base64 image data in response');
    }
    
    // Convert base64 to data URL
    const avatarUrl = `data:image/png;base64,${imageB64}`;
    
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
