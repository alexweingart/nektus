import OpenAI from 'openai';

// Custom types for our extended OpenAI client to support specific models/params
// We use a custom client to enable features not yet in the official SDK
// or to enforce specific model usage like 'gpt-image-1'

type CustomImageSize = '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792' | '1024x1536';

interface ImageGenerationParams {
  prompt: string;
  n?: number;
  size?: CustomImageSize;
  quality?: 'low' | 'medium' | 'high' | 'auto';
  model?: string;
}

interface ImageGenerationResponse {
  data: Array<{
    b64_json?: string;
    url?: string;
  }>;
}

// Types for the responses API
interface WebSearchTool {
  type: 'web_search_preview';
  user_location: {
    type: string;
    country: string;
    region: string;
    city: string;
  };
  search_context_size: string;
}

interface ResponseCreateParams {
  model: string;
  input: {
    messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }>;
  };
  tools?: Array<WebSearchTool>;
  temperature?: number;
  max_output_tokens?: number;
  top_p?: number;
  store?: boolean;
}

interface ResponseOutput {
  output: {
    text: string;
    [key: string]: any;
  };
  [key: string]: any;
}

// Our custom OpenAI client with our specialized APIs
export type CustomOpenAI = {
  chat: OpenAI['chat'];
  images: {
    generate: (params: ImageGenerationParams) => Promise<ImageGenerationResponse>;
  };
  responses: {
    create: (params: ResponseCreateParams) => Promise<ResponseOutput>;
  };
};

let openaiClient: CustomOpenAI | null = null;

// Create a custom implementation of our OpenAI client
export function getOpenAIClient(): CustomOpenAI {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  // Initialize standard OpenAI client
  const standardClient = new OpenAI({
    apiKey,
    baseURL: 'https://api.openai.com/v1',
    defaultQuery: { 'api-version': '2024-02-15-preview' },
    defaultHeaders: { 
      'OpenAI-Beta': 'assistants=v2',
      'Content-Type': 'application/json'
    }
  });

  // Build our custom client with specific implementations for each API
  const customClient = {
    // Pass through the chat API directly
    chat: standardClient.chat,
    
    // Custom implementation for images API
    images: {
      generate: async (params: ImageGenerationParams): Promise<ImageGenerationResponse> => {
        try {
          // Just use the standard client directly without trying to extend it
          const finalParams = {
            ...params,
            model: params.model || 'gpt-image-1',
            size: params.size || '1024x1024'
          };
          
          // Make the API call
          const response = await standardClient.images.generate(finalParams as any);
          
          // Return our simplified format
          return {
            data: response.data || []
          };
        } catch (error) {
          console.error('[OpenAI Client] Error in images.generate:', error);
          throw error;
        }
      }
    },
    
    // Custom implementation for responses API (using fetch)
    responses: {
      create: async (params: ResponseCreateParams): Promise<ResponseOutput> => {
        try {
          // Use fetch directly for the responses API
          const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'OpenAI-Beta': 'assistants=v2',
              'api-version': '2024-02-15-preview'
            },
            body: JSON.stringify(params)
          });
          
          if (!response.ok) {
            const error = await response.json();
            console.error('[OpenAI Client] Error response from responses API:', error);
            throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
          }
          
          const data = await response.json();
          return data;
        } catch (error) {
          console.error('[OpenAI Client] Error in responses.create:', error);
          throw error;
        }
      }
    }
  };
  
  // Store the client for future use
  openaiClient = customClient as CustomOpenAI;
  return openaiClient;
} 