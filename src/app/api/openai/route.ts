import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { UserProfile, SocialProfile } from '@/types/profile';

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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }
  
  // Initialize the basic OpenAI client
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.openai.com/v1',
    defaultQuery: { 'api-version': '2024-02-15-preview' },
    defaultHeaders: { 
      'OpenAI-Beta': 'assistants=v2',
      'Content-Type': 'application/json'
    }
  });
  
  // Create custom client with extended functionality
  const customClient = {
    ...client,
    responses: {
      create: async (params: any) => {
        const response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
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
  
  // Type assertion for our custom client with extended image generation
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
          
          // Image generation with model, size, and quality parameters
          
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
  
  // OpenAI client initialized successfully
} catch (error) {
  console.error('Failed to initialize OpenAI client:', error);
}

// Define a more specific type for OpenAI responses
interface OpenAIResponse {
  output?: Array<{
    role?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  text?: string | { value?: string };
  choices?: Array<{
    message?: { content?: string };
    text?: string;
  }>;
}

// Helper function to extract text content from OpenAI response
function extractTextFromResponse(response: OpenAIResponse): string {
  // Check for assistant's response first
  const assistantResponse = response.output?.find((item: any) => item.role === 'assistant');
  if (assistantResponse?.content) {
    const textContent = assistantResponse.content.find((c: any) => 
      c.type === 'output_text' || c.type === 'text');
    if (textContent?.text) {
      return textContent.text.trim();
    }
  }
  
  // Fallback to any text content in the output
  if (response.output) {
    for (const item of response.output) {
      if (item.content) {
        const textContent = item.content.find((c: any) => 
          c.type === 'output_text' || c.type === 'text');
        if (textContent?.text) {
          return textContent.text.trim();
        }
      }
    }
  }
  
  return '';
}

// Helper function to extract social media links from profile
function extractSocialLinks(profile: ProfileData): string | null {
  if (!profile?.contactChannels) return null;
  
  const socialLinks: string[] = [];
  
  // Extract from contactChannels structure
  const platforms: (keyof typeof profile.contactChannels)[] = [
    'facebook', 'instagram', 'x', 'linkedin', 'snapchat', 'whatsapp', 'telegram', 'wechat'
  ];
  
  for (const platform of platforms) {
    if (platform === 'phoneInfo' || platform === 'email') continue; // Skip non-social channels
    
    const channel = profile.contactChannels[platform as keyof typeof profile.contactChannels] as SocialProfile;
    if (channel?.username && channel.username.trim() !== '') {
      socialLinks.push(`${platform}: ${channel.username}${channel.url ? ` (${channel.url})` : ''}`);
    }
  }
  
  // Also check legacy socialProfiles array for backward compatibility
  if (profile.socialProfiles && Array.isArray(profile.socialProfiles)) {
    profile.socialProfiles.forEach((social: SocialProfile) => {
      // Add platform property check since SocialProfile doesn't have platform
      const socialWithPlatform = social as SocialProfile & { platform?: string };
      if (socialWithPlatform.platform && social.username && social.username.trim() !== '' && 
          !socialLinks.some(link => link.startsWith(socialWithPlatform.platform!))) {
        socialLinks.push(`${socialWithPlatform.platform}: ${social.username}${social.url ? ` (${social.url})` : ''}`);
      }
    });
  }
  
  return socialLinks.length > 0 ? socialLinks.join('\n') : null;
}

// Helper function to extract social profile URLs from profile
function getSocialProfileUrls(profile: ProfileData): string[] {
  if (!profile?.contactChannels) return [];
  
  const urls: string[] = [];
  const socialPlatforms = [
    'facebook', 'instagram', 'x', 'whatsapp', 'snapchat', 'telegram', 'linkedin'
  ];

  for (const platform of socialPlatforms) {
    const channel = profile.contactChannels[platform as keyof typeof profile.contactChannels] as SocialProfile;
    if (channel?.url) {
      urls.push(channel.url);
    }
  }

  return urls;
}

async function generateBio(profile: ProfileData) {
  // Bio generation started
  console.log('[generateBio] Received profile data:', JSON.stringify(profile, null, 2));

  // Safety check for OpenAI client
  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }
  
  try {
    // Get social profile URLs
    const socialProfileUrls = getSocialProfileUrls(profile);
    console.log('[generateBio] Extracted social profile URLs:', socialProfileUrls);
    
    // Also check extractSocialLinks
    const socialLinks = extractSocialLinks(profile);
    console.log('[generateBio] Extracted social links:', socialLinks);

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
            text: `Generate a hyper-personalized bio for a person named ${profile.name}. The bio should be no more than 14 words. Only return the bio text, nothing else. Do not mention their name in the bio. You should always come up with something unique and creative.`
          }
        ]
      }
    ];

    // Add social profile URLs to the prompt if available
    if (socialProfileUrls.length > 0) {
      const socialLinksText = socialProfileUrls.join(', ');
      input[1].content[0].text += ` Please follow these web links to read about ${profile.name}: ${socialLinksText}. If the webpage was updated more recently, that information is more important.`;
    }

    console.log('[generateBio] Final prompt being sent:', input[1].content[0].text);

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

    // Generate bio with specified model
    const response = await openai.responses.create(requestParams);
    
    // Use our module-level helper function to extract the text
    
    // Extract the generated bio from the response
    const bio = extractTextFromResponse(response);
    
    if (!bio) {
      // Get the assistant response again for error reporting
      const assistantResponse = response.output?.find((item: any) => item.role === 'assistant');
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
    return createErrorResponse(error, 'BIO_GENERATION_ERROR', 'Failed to generate bio', 500, {
      profile: {
        name: profile?.name,
        hasContactChannels: !!profile?.contactChannels,
        contactChannels: profile?.contactChannels ? Object.keys(profile.contactChannels) : []
      }
    });
  }
}

async function generateBackground(profile: ProfileData) {
  try {
    // Return existing background image if it exists
    if (profile.backgroundImage) {
      // Using existing background image
      return NextResponse.json({ imageUrl: profile.backgroundImage });
    }

    // Check if OpenAI client is initialized
    if (!openai) {
      console.error('OpenAI client is not initialized');
      return NextResponse.json({ 
        imageUrl: null,
        error: 'OpenAI API key not configured' 
      });
    }

    // Extract social media information from profile
    const socialLinks = extractSocialLinks(profile);
    
    console.log('Generating background image with simplified responses API approach');
    
    // Create content array for the prompt
    const content: Array<{
      type: "input_text";
      text: string;
    } | {
      type: "input_image";
      image_url: string;
    }> = [
      {
        type: "input_text",
        text: `Create a prompt for generating a personalized background image for a user with the following details:

Bio: ${profile.bio || 'No bio available'}
Name: ${profile.name || 'User'}
${socialLinks ? `Social Media: ${socialLinks}` : ''}

${profile.profileImage ? 
  'Analyze the attached profile image to understand the person\'s style, main colors, and aesthetic preferences. Create a background that complements these colors and style.' : 
  'Use a professional and modern color palette.'}

The background should be:
- Simple and abstract
- Suitable for a professional profile
- No text, people, or recognizable objects
- Minimal and modern design
- Colors that complement the overall aesthetic

Return only a detailed image generation prompt, nothing else.`
      }
    ];

    // Add profile image if available
    if (profile.profileImage) {
      content.push({
        type: "input_image",
        image_url: profile.profileImage
      });
    }

    // Use responses API directly to generate the background prompt
    const promptResponse = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [{
        role: "user",
        content: content
      }],
      text: {
        format: {
          type: "text"
        }
      },
      temperature: 1,
      max_output_tokens: 1024,
      top_p: 1
    });

    // Extract the generated prompt
    let customPrompt = '';
    if (promptResponse.output_text) {
      customPrompt = promptResponse.output_text.trim();
    } else if (promptResponse.output && Array.isArray(promptResponse.output)) {
      customPrompt = extractTextFromResponse(promptResponse);
    }

    // Use fallback prompt if generation failed
    if (!customPrompt) {
      console.log('No custom prompt generated, using fallback');
      customPrompt = `Create a simple, abstract background with subtle textures. 
        Use a color palette that's professional and modern. No text, people, or recognizable objects. 
        The image should be suitable for a professional networking context.`;
    }

    console.log('Generated prompt preview:', customPrompt.substring(0, 150) + '...');

    // Generate the background image using the custom prompt with streaming
    console.log('Generating background image with streaming using responses API');
    
    try {
      // Use the responses API with streaming for image generation
      const fetchResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          model: 'gpt-4.1',
          // Structure input as a message with input_text for tool invocation
          input: [
            {
              role: 'user',
              content: [
                { type: 'input_text', text: customPrompt }
              ]
            }
          ],
          stream: true,
          tools: [
            {
              type: 'image_generation',
              partial_images: 3,
              size: '1024x1024',
              output_format: 'png',
              quality: 'medium'
            }
          ]
        }),
      });
      
      // Directly return the raw SSE stream from OpenAI
      if (!fetchResponse.body) {
        throw new Error('No response body from OpenAI Responses API');
      }
      return new NextResponse(fetchResponse.body as any, {
        status: fetchResponse.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive'
        }
      });
      
    } catch (streamError) {
      console.error('[Background Generation] Streaming failed, falling back to standard generation:', streamError);
      
      // Fallback to standard image generation if streaming failed
      const response = await openai.images.generate({
        prompt: customPrompt,
        size: '1024x1024',
        quality: 'medium',
        model: 'gpt-image-1',
        response_format: 'b64_json'
      });
      
      const imageB64 = response.data?.[0]?.b64_json;
      if (!imageB64) {
        throw new Error('No base64 image data in fallback response');
      }
      
      const imageUrl = `data:image/png;base64,${imageB64}`;
      console.log('[Background Generation] Fallback image generated successfully');
      
      return NextResponse.json({ 
        success: true,
        imageUrl: imageUrl,
        debug: {
          generatedPrompt: customPrompt,
          fallbackUsed: true
        }
      });
    }
  } catch (error) {
    console.error('Error in generateBackground:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate background image',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function generateAvatar(profile: ProfileData) {
  try {
    // Avatar generation started
    
    // Safety check for OpenAI client
    if (!openai) {
      return NextResponse.json({ 
        imageUrl: '/default-avatar.png' 
      });
    }

    // Extract social media information from profile
    const socialLinks = extractSocialLinks(profile);
    
    // Generating avatar with gpt-image-1 model
    const response = await openai.images.generate({
      prompt: `Create a profile picture for a person with this bio: ${profile.bio || 'no bio available'}. ` +
              `The image should be a simple, casual, abstract, and modern. ` +
              `Use a clean, minimalist style with a solid color background. ` +
              `There should be no text on the image`,
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
    
    // Avatar image generated successfully
    
    return NextResponse.json({ imageUrl: avatarUrl });
  } catch (error) {
    console.error('Avatar generation error:', error);
    // In avatar generation, we fail gracefully by returning a default image
    return NextResponse.json({ 
      imageUrl: profile.picture || '/default-avatar.png',
      generated: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Define a type for profile data
interface ProfileData extends UserProfile {
  // Legacy fields for backward compatibility  
  picture?: string; // Maps to profileImage
  socialProfiles?: Array<SocialProfile>; // Legacy social profiles array
}
// Define interface for error details
interface ErrorDetails {
  requestId?: string;
  durationMs?: number;
  environment?: string;
  hasOpenAIKey?: boolean;
  openAiKeyPrefix?: string;
  profile?: {
    name?: string;
    hasContactChannels?: boolean;
    contactChannels?: string[];
  };
  source?: string;
  [key: string]: any; // Allow for additional properties
}

// Helper function for consistent error responses
function createErrorResponse(error: unknown, code: string, message: string, status = 500, requestDetails?: ErrorDetails) {
  const errorId = `err_${Math.random().toString(36).substring(2, 8)}`;
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  const errorDetails = {
    errorId,
    message: errorMessage,
    name: errorName,
    stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
    timestamp: new Date().toISOString(),
    ...requestDetails
  };

  // Log error in a consistent format
  console.error(`[ERROR:${code}] ${errorId}: ${message}`, 
    // Only log essential details to keep logs clean
    JSON.stringify({
      message: errorMessage,
      details: Object.keys(requestDetails || {}).length ? '...' : 'none',
      timestamp: new Date().toISOString()
    }));
  
  return NextResponse.json(
    { 
      error: message,
      errorId,
      code,
      details: process.env.NODE_ENV === 'development' ? errorDetails : {
        errorId,
        message: errorMessage
      }
    },
    { 
      status,
      headers: {
        'X-Error-ID': errorId
      }
    }
  );
}

// Define a type for request body
interface AIGenerationRequest {
  type: 'background' | 'bio' | 'avatar';
  profile: ProfileData;
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
      return createErrorResponse(error, 'INVALID_JSON', 'Invalid JSON payload', 400, { requestId });
    }

    const { type, profile } = requestBody as AIGenerationRequest;
    
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
    return createErrorResponse(error, 'GENERATION_ERROR', 'Failed to generate content', 500, {
      requestId,
      durationMs: Date.now() - requestStartTime,
      environment: process.env.NODE_ENV || 'development',
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      openAiKeyPrefix: process.env.OPENAI_API_KEY 
        ? `${process.env.OPENAI_API_KEY.substring(0, 5)}...` 
        : 'Not set'
    });
  }
}
