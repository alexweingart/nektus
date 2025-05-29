import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
let openai: any = null;

try {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }
  
  const client = new OpenAI({
    apiKey: openaiApiKey,
    baseURL: 'https://api.openai.com/v1',
    defaultQuery: { 'api-version': '2024-02-15-preview' },
    defaultHeaders: { 
      'OpenAI-Beta': 'assistants=v2',
      'Content-Type': 'application/json'
    }
  });
  
  // Add the responses API to our custom client
  openai = {
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
  
} catch (error) {
  console.error('Failed to initialize OpenAI client:', error);
}

export async function GET(request: NextRequest) {
  console.log("DEBUG ROUTE CALLED");
  console.error("DEBUG ERROR LOG TEST");
  
  try {
    if (!openai) {
      return NextResponse.json({ error: 'OpenAI client not initialized' }, { status: 500 });
    }
    
    // Demo profile for testing
    const profile = {
      name: "Test User",
      bio: "Software developer who loves hiking and photography",
      profileImage: "https://example.com/image.jpg" // Test image URL
    };
    
    // Prepare the input for the responses API to generate a personalized prompt
    const input = [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: 'You are an expert at creating prompts for AI image generation. Your task is to create a highly personalized prompt for a background image that matches the user\'s profile.'
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Generate a prompt for creating a background image for a user with the following bio: ${profile.bio || 'No bio available'}.
            The background should be simple and abstract, but still relate to the personal details of the person.
            ${profile.profileImage ? 'The user has a profile picture, so suggest colors that would be complementary to it.' : 'Use a professional color palette.'}
            The style should be minimal, modern, and suitable for a profile background.
            No text or people should be in the image.
            Return only the prompt text, nothing else.`
          }
        ]
      }
    ];

    // Prepare the request for the responses API
    const promptRequestParams = {
      model: 'gpt-4.1',
      input,
      temperature: 0.7,
      max_output_tokens: 1024,
      top_p: 1,
      store: true
    };

    console.log('Sending debug prompt generation request to OpenAI');
    console.log('Request params:', JSON.stringify(promptRequestParams, null, 2));
    
    // Call GPT-4.1 to generate a personalized prompt
    const promptResponse = await openai.responses.create(promptRequestParams);
    
    console.log('Raw GPT-4.1 response received:', JSON.stringify(promptResponse, null, 2));
    
    // Extract the generated prompt from the response
    let customPrompt = '';
    
    // Try to find the assistant's response with the generated prompt
    const assistantResponse = promptResponse.output?.find((item: any) => item.role === 'assistant');
    if (assistantResponse?.content) {
      const textContent = assistantResponse.content.find((c: any) => c.type === 'output_text');
      if (textContent?.text) {
        customPrompt = textContent.text.trim();
      }
    }
    
    // Fallback to the first text content if no assistant response found
    if (!customPrompt && promptResponse.output) {
      for (const item of promptResponse.output) {
        if (item.content) {
          const textContent = item.content.find((c: any) => c.type === 'output_text' || c.type === 'text');
          if (textContent?.text) {
            customPrompt = textContent.text.trim();
            break;
          }
        }
      }
    }
    
    console.error('======== DEBUG GENERATED PROMPT FROM GPT-4.1 ========');
    console.error(customPrompt);
    console.error('==============================================');
    
    return NextResponse.json({ 
      success: true,
      prompt: customPrompt,
      rawResponse: promptResponse
    });
    
  } catch (error) {
    console.error('Debug route error:', error);
    return NextResponse.json({ error: 'An error occurred in the debug route' }, { status: 500 });
  }
}
