import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';

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
          
          // Log only essential parameters for debugging
          console.log('Generating image:', {
            model: finalParams.model,
            size: finalParams.size,
            quality: finalParams.quality
          });
          
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
  
  console.log('OpenAI client initialized successfully');
} catch (error) {
  console.error('Failed to initialize OpenAI client:', error);
  console.error('Please check your OPENAI_API_KEY in .env.local');
}

// Helper function to extract social media links from profile
// Helper function to extract text content from OpenAI response
function extractTextFromResponse(response: any): string {
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

// Helper function for consistent error responses
function createErrorResponse(error: unknown, code: string, message: string, status = 500, requestDetails?: any) {
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

    // Log only essential parameters for debugging
    console.log('Generating bio with model:', requestParams.model);
    
    const response = await openai.responses.create(requestParams);
    
    // Log response received
    console.log('Bio generation completed with model:', requestParams.model);
    
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

async function generateBackground(profile: any) {
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
    
    // First step: Generate a personalized prompt using GPT-4.1
    console.log('Generating personalized background prompt with GPT-4.1');
    
    // Create new OpenAI instance
    // Use existing OpenAI client instead of creating a new one
    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }
    
    // Use our custom responses API client
    console.log('Using OpenAI client responses API for GPT-4.1');
    
    // Prepare the request data
    const requestData = {
      model: "gpt-4.1",
      input: [
        {
          "role": "system",
          "content": [
            {
              "type": "input_text",
              "text": "You are an expert at creating prompts for AI image generation. Your task is to create a highly personalized prompt for a background image that matches the user's profile."
            }
          ]
        },
        {
          "role": "user",
          "content": [
            {
              "type": "input_text",
              "text": `Generate a prompt for creating a background image for a user with the following bio: ${profile.bio || 'No bio available'}.
              ${profile.profileImage ? 'In the prompt, describe the main features of the attached picture in this message to help inform the type of background image, the main colors this attached picture has, and then suggest the specific colors to use directly in the prompt for the image to be generated.' : 'Use a professional color palette.'} The background should be simple and abstract, but still relate to the personal details of the person. The style should be minimal, modern, and suitable for a profile background. No text or people should be in the image. Return only the prompt text, nothing else.`
            },
            ...(profile.profileImage ? [{
              "type": "input_image",
              "image_url": profile.profileImage
            }] : [])
          ]
        }
      ],
      text: {
        "format": {
          "type": "text"
        }
      },
      reasoning: {},
      tools: [],
      temperature: 1,
      max_output_tokens: 2048,
      top_p: 1,
      store: true
    };
    
    // Call the OpenAI API using our client
    const responseData = await openai.responses.create(requestData);
    console.log('Prompt generation completed with model: GPT-4.1');
    
    // Extract the generated prompt from the response
    let customPrompt = '';
    
    // Use the previously defined helper function if the response has the same structure
    if (responseData.output && Array.isArray(responseData.output)) {
      customPrompt = extractTextFromResponse(responseData);
    } 
    // Handle various other response formats from the OpenAI API
    else if (typeof responseData.text === 'string') {
      // Direct text property (string)
      customPrompt = responseData.text.trim();
    } else if (responseData.text && typeof responseData.text.value === 'string') {
      // Nested text.value property
      customPrompt = responseData.text.value.trim();
    } else if (responseData.choices && Array.isArray(responseData.choices) && responseData.choices.length > 0) {
      // Handle format from completion API
      const choice = responseData.choices[0];
      if (choice.message && choice.message.content) {
        customPrompt = choice.message.content.trim();
      } else if (choice.text) {
        customPrompt = choice.text.trim();
      }
    }
    
    // Use a fallback prompt if no custom prompt was generated
    if (!customPrompt) {
      console.warn('No custom prompt was generated, using fallback prompt');
      customPrompt = `Create a simple, abstract background with subtle textures. 
        Use a color palette that's professional and modern. No text, people, or recognizable objects. 
        The style should be minimal and clean, suitable for a profile background.`;
    }
    
    // Log shorter version of the prompt for debugging
    console.log('Generated prompt:', customPrompt.substring(0, 100) + (customPrompt.length > 100 ? '...' : ''));
    
    // Second step: Use the generated prompt to create the background image
    console.log('Generating background image with gpt-image-1 model using custom prompt');
    if (!openai) {
      throw new Error('OpenAI client is not initialized for image generation');
    }
    
    // Use the responses API with streaming for image generation
    console.log('Using responses API with streaming for image generation');
    
    // Function to save image to localStorage on the client side
    const saveImageToLocalStorage = (imageBase64: string, index: number) => {
      // Always use index in the filename for consistency
      const key = `backgroundImageResponse${index}.png`;
      return `
        if (typeof window !== 'undefined') {
          try {
            // Get existing user profile from localStorage
            const profileJson = localStorage.getItem('nektus_user_profile');
            if (profileJson) {
              const profile = JSON.parse(profileJson);
              
              // Update the backgroundImage property
              profile.backgroundImage = 'data:image/png;base64,${imageBase64}';
              
              // Save back to localStorage
              localStorage.setItem('nektus_user_profile', JSON.stringify(profile));
              console.log('Updated nektus_user_profile with new backgroundImage: ${key}');
            } else {
              console.warn('nektus_user_profile not found in localStorage');
            }
          } catch (error) {
            console.error('Error updating backgroundImage in localStorage:', error);
          }
        }
      `;
    };
    
    try {
      console.log('Using responses API with image generation streaming');
      
      // We still need direct fetch for streaming functionality
      // as the OpenAI SDK doesn't fully support this specific streaming use case
      const fetchResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          model: 'gpt-4.1',
          input: customPrompt,
          stream: true,
          tools: [{ type: 'image_generation', partial_images: 3 }]
        }),
      });
      
      console.log(`Responses API status: ${fetchResponse.status}`);
      
      if (!fetchResponse.ok) {
        const errorText = await fetchResponse.text();
        console.error(`OpenAI Responses API error: ${fetchResponse.status} ${fetchResponse.statusText} - ${errorText}`);
        throw new Error(`OpenAI Responses API error: ${fetchResponse.status}`);
      }
      
      if (!fetchResponse.body) {
        throw new Error('No response body from OpenAI API');
      }
      
      // Get a reader for the streaming response
      const reader = fetchResponse.body.getReader();
      
      // Array to collect client-side script portions
      const clientScripts: string[] = [];
      let imageUrl = ''; // Will hold the final image URL
      
      // Process the streaming response
      let done = false;
      try {
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          
          if (done) break;
          
          // Process the chunk directly - this is a ReadableStream of event data
          // The format will be "data: {JSON object}\n\n"
          const chunk = new TextDecoder().decode(value);
          const eventLines = chunk.split('\n\n');
          
          for (const eventLine of eventLines) {
            if (eventLine.startsWith('data: ')) {
              try {
                const eventData = JSON.parse(eventLine.substring(6));
                
                if (eventData.type === "response.image_generation_call.partial_image") {
                  const idx = eventData.partial_image_index;
                  const imageBase64 = eventData.partial_image_b64;
                  
                  // Only log the index of the received partial image to reduce noise
                  console.log(`Received partial image ${idx}`);
                  
                  // Add script to update localStorage on client side
                  clientScripts.push(saveImageToLocalStorage(imageBase64, idx));
                  
                  // If this is the final image (index 2), save it for the response
                  if (idx === 2) {
                    imageUrl = `data:image/png;base64,${imageBase64}`;
                  }
                }
              } catch (e) {
                console.error('Error parsing event data:', e);
              }
            }
          }
        }
      } catch (streamError: unknown) {
        console.error('Error processing stream:', streamError);
        const errorMessage = streamError instanceof Error ? streamError.message : 'Unknown stream processing error';
        throw new Error(`Error processing image stream: ${errorMessage}`);
      } finally {
        reader.releaseLock();
      }
      
      // Check if we got at least one image
      if (!imageUrl) {
        // Fallback to standard image generation if streaming failed
        if (!openai) {
          throw new Error('OpenAI client is not initialized for fallback image generation');
        }
        
        console.log('Streaming failed, falling back to standard image generation');
        const response = await openai.images.generate({
          prompt: customPrompt,
          size: '1024x1536',
          quality: 'medium',
          model: 'gpt-image-1',
          response_format: 'b64_json'
        });
        
        const imageB64 = response.data?.[0]?.b64_json;
        if (!imageB64) {
          throw new Error('No base64 image data in fallback response');
        }
        
        // Set the final image
        imageUrl = `data:image/png;base64,${imageB64}`;
        
        // Create simulated partial images with the fallback image
        clientScripts.length = 0; // Clear any partial scripts
        for (let i = 0; i < 3; i++) {
          clientScripts.push(saveImageToLocalStorage(imageB64, i));
          console.log(`Created simulated partial image ${i} using fallback`);
        }
      }
      
      // Return the image URL with client scripts
      return NextResponse.json({ 
        success: true,
        data: {
          imageUrl: imageUrl,
          clientScripts: clientScripts.join('\n'),
          debug: {
            generatedPrompt: customPrompt,
            // Only include essential info to avoid response size issues
            requestInfo: {
              model: requestData.model,
              temperature: requestData.temperature,
              bioUsed: profile.bio || 'No bio available'
            }
          }
        }
      });
    } catch (error) {
      return createErrorResponse(error, 'BACKGROUND_GENERATION_ERROR', 'Background generation failed', 500, {
        source: 'image_generation'
      });
    }
    
  } catch (error) {
    try {
      return createErrorResponse(error, 'BACKGROUND_GENERATION_ERROR', 'Background generation failed', 500, {
        source: 'background_generation'
      });
    } catch (innerError) {
      console.error('Error in error handler:', innerError);
      return createErrorResponse(innerError, 'UNEXPECTED_ERROR', 'An unexpected error occurred', 500);
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
