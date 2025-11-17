import OpenAI from 'openai';
import type { ReasoningEffort, Verbosity } from '@/types/ai-scheduling';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const AI_MODELS = {
  GPT5: 'gpt-5',
  GPT5_MINI: 'gpt-5-mini',
  GPT5_NANO: 'gpt-5-nano',
} as const;

export type AIModel = typeof AI_MODELS[keyof typeof AI_MODELS];

export const DEFAULT_MODEL = process.env.OPENAI_MODEL as AIModel || AI_MODELS.GPT5_MINI;
export const FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL as AIModel || AI_MODELS.GPT5_NANO;

export const DEFAULT_REASONING_EFFORT: ReasoningEffort =
  (process.env.OPENAI_REASONING_EFFORT as ReasoningEffort) || 'medium';

export const DEFAULT_VERBOSITY: Verbosity = 'low';

export interface CreateCompletionOptions {
  model?: AIModel;
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  tools?: OpenAI.Chat.ChatCompletionTool[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  reasoning_effort?: ReasoningEffort;
  verbosity?: Verbosity;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
}

export async function createCompletion(options: CreateCompletionOptions) {
  const {
    model = DEFAULT_MODEL,
    messages,
    tools,
    tool_choice,
    reasoning_effort = DEFAULT_REASONING_EFFORT,
    verbosity = DEFAULT_VERBOSITY,
    temperature = 0.7,
    max_tokens,
    response_format,
  } = options;

  try {
    const completionParams: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages,
      max_tokens,
      response_format,
    };

    // Only include tools and tool_choice if tools are provided
    if (tools && tools.length > 0) {
      completionParams.tools = tools;
      if (tool_choice) {
        completionParams.tool_choice = tool_choice;
      } else {
        completionParams.tool_choice = 'auto';
      }
    }

    // Only add temperature for non-GPT-5 models
    if (!model.startsWith('gpt-5')) {
      completionParams.temperature = temperature;
    }

    // GPT-5 specific parameters
    if (model.startsWith('gpt-5')) {
      (completionParams as unknown as Record<string, unknown>).reasoning_effort = reasoning_effort;
      (completionParams as unknown as Record<string, unknown>).verbosity = verbosity;
    }

    const completion = await openai.chat.completions.create(completionParams);

    return completion;
  } catch (error) {
    console.error('OpenAI API error:', error);

    // Fallback to smaller model if the primary fails
    if (model !== FALLBACK_MODEL) {
      console.log(`Retrying with fallback model: ${FALLBACK_MODEL}`);
      return createCompletion({ ...options, model: FALLBACK_MODEL });
    }

    throw error;
  }
}

export function getModelForTask(task: 'intent' | 'event_template' | 'event' | 'navigation'): AIModel {
  switch (task) {
    case 'intent':
      // Use smallest model for simple intent determination
      return AI_MODELS.GPT5_NANO;
    case 'event_template':
    case 'event':
      // Use mini model for event generation
      return AI_MODELS.GPT5_MINI;
    case 'navigation':
      // Use nano for simple navigation
      return AI_MODELS.GPT5_NANO;
    default:
      return DEFAULT_MODEL;
  }
}

export function getReasoningEffortForTask(task: 'intent' | 'event_template' | 'event' | 'navigation'): ReasoningEffort {
  switch (task) {
    case 'intent':
    case 'navigation':
      // Fast response for simple tasks
      return 'minimal';
    case 'event_template':
    case 'event':
      // Low reasoning for both template and event generation (we provide all the data)
      return 'low';
    default:
      return DEFAULT_REASONING_EFFORT;
  }
}

export interface WebSearchOptions {
  input: string;
  model?: AIModel;
  location?: {
    type: 'approximate';
    country: string;
    city: string;
  };
  onDelta?: (partialText: string) => void | Promise<void>;
  onSearchProgress?: (searchQuery: string) => void | Promise<void>;
}

export async function createWebSearchResponse(options: WebSearchOptions) {
  const {
    input,
    model = AI_MODELS.GPT5_MINI, // Use GPT-5 Mini for consistency with event generation tasks
    location,
    onDelta,
    onSearchProgress
  } = options;

  try {
    console.log('🔍 Creating web search with GPT-5 via Responses API');

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    // Enhance the prompt with location context and directive instructions
    const enhancedInput = location
      ? `SYSTEM: You are a web search assistant. Your ONLY job is to search the web and return factual results. DO NOT ask questions. DO NOT be conversational. EXECUTE the search immediately.

USER LOCATION: ${location.city}, ${location.country}

USER REQUEST: ${input}

ACTION REQUIRED: Perform web search NOW and return results.`
      : `SYSTEM: You are a web search assistant. Your ONLY job is to search the web and return factual results. DO NOT ask questions. DO NOT be conversational. EXECUTE the search immediately.

USER REQUEST: ${input}

ACTION REQUIRED: Perform web search NOW and return results.`;

    // Use OpenAI Responses API with web_search tool with STREAMING for better performance
    console.log('📡 Making STREAMING request to OpenAI Responses API...');
    console.log('📡 Request details:', {
      model,
      location: location ? `${location.city}, ${location.country}` : 'none',
      inputPreview: input.substring(0, 100) + '...'
    });

    const startTime = Date.now();
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        model, // Use the provided model (GPT-5 variants)
        input: enhancedInput,
        tools: [
          {
            type: 'web_search'
          }
        ],
        max_output_tokens: 16000, // Increased to allow model to fully synthesize web search results
        max_tool_calls: 1, // ONLY 1 web search to keep it fast
        stream: true // Enable streaming for faster time-to-first-token
        // Note: temperature is NOT supported in Responses API
      })
    });
    console.log(`📡 Stream connection established in ${Date.now() - startTime}ms, status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI Responses API HTTP error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });

      throw new Error(`OpenAI API error (${response.status}): ${errorText.substring(0, 500)}`);
    }

    // Handle streaming response
    console.log('📦 Processing streaming response...');
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let output_text = '';
    let buffer = '';

    if (!reader) {
      throw new Error('No response body reader available');
    }

    try {
      let chunkCount = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
          if (line.startsWith('data: ')) {
            try {
              chunkCount++;
              const data = JSON.parse(line.slice(6));

              // Log chunk types to understand structure
              console.log(`🔍 Chunk ${chunkCount} type: ${data.type}`, data.type === 'response.output_item.added' ? `item type: ${data.item?.type}` : '');

              // Handle Responses API streaming format
              // Event types: response.output_item.added, response.output_item.done, response.done

              if (data.type === 'response.web_search_call.searching') {
                // OpenAI doesn't provide the query text in the searching event
                // Just notify that a search is happening
                if (onSearchProgress) {
                  await onSearchProgress('Searching the web...');
                }
              }

              if (data.type === 'response.web_search_call.completed') {
                // Web search completed - log the results
                console.log('🔍 Web search completed:', JSON.stringify(data).substring(0, 500));
              }

              if (data.type === 'response.incomplete') {
                // Response was cut off
                console.log('⚠️ Response incomplete:', JSON.stringify(data.incomplete_details));
              }

              if (data.type === 'response.output_item.added' && data.item?.type === 'message') {
                // New message item added
                console.log('📝 Message item added:', JSON.stringify(data.item).substring(0, 300));
              }

              // Handle text delta events (the actual streaming content!)
              if (data.type === 'response.output_text.delta') {
                // Log first delta to understand structure
                if (output_text.length === 0) {
                  console.log('🔍 First delta chunk structure:', JSON.stringify(data));
                }

                // Extract delta text - could be in data.delta, data.text, or data.delta.text
                const deltaText = data.delta || data.text || data.delta?.text || '';
                if (deltaText) {
                  output_text += deltaText;

                  // Call onDelta callback with accumulated text
                  if (onDelta) {
                    await onDelta(output_text);
                  }

                  if (chunkCount % 50 === 0) { // Log every 50 chunks to avoid spam
                    console.log(`📝 Delta received (chunk ${chunkCount}), total length: ${output_text.length}`);
                  }
                }
              }

              if (data.type === 'response.output_item.done' && data.item?.type === 'message') {
                // Message complete - get full content
                if (data.item.content && Array.isArray(data.item.content)) {
                  const textContent = data.item.content.find((c: { type: string; text?: string }) => c.type === 'text');
                  if (textContent?.text) {
                    output_text = textContent.text;
                    console.log(`📝 Message complete, length: ${output_text.length}`);
                  }
                }
              }

              if (data.type === 'response.done' && data.response?.output) {
                // Final response with full output
                const messageOutput = data.response.output.find((item: { type: string; content?: Array<{ text?: string }> }) => item.type === 'message');
                if (messageOutput?.content?.[0]?.text) {
                  output_text = messageOutput.content[0].text;
                  console.log(`📝 Final response received, length: ${output_text.length}`);
                }
              }
            } catch (error: unknown) {
              console.log('⚠️ Failed to parse chunk:', line.substring(0, 200), error);
              continue;
            }
          }
        }
      }

      console.log(`✅ Streaming completed in ${Date.now() - startTime}ms`);
      console.log(`📊 Processed ${chunkCount} chunks`);
      console.log('🔍 Final output length:', output_text.length);
      console.log('🔍 Final output preview:', output_text.substring(0, 500));

      return {
        output_text
      };
    } finally {
      reader.releaseLock();
    }

  } catch (error) {
    console.error('GPT-5 web search error:', error);
    throw error;
  }
}

export { openai };