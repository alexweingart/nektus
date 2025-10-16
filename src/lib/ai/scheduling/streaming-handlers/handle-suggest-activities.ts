import { createCompletion, AI_MODELS } from '@/lib/ai/scheduling/openai-client';
import { processingStateManager } from '@/lib/services/server/aiProcessingService';
import { enqueueProgress, enqueueContent, enqueueClearLoading, enqueueEnhancementPending } from './streaming-utils';
import type { AISchedulingRequest, Message } from '@/types/ai-scheduling';

// Extract city from full address (e.g., "1326 Scott Street, San Francisco, CA 94115" -> "San Francisco")
function getCityName(fullAddress: string): string {
  if (!fullAddress) return 'San Francisco';
  // Split by comma and take the second part (city)
  const parts = fullAddress.split(',');
  return parts[1]?.trim() || parts[0]?.trim() || fullAddress;
}

export async function handleSuggestActivities(
  body: AISchedulingRequest,
  conversationHistory: Message[],
  contextMessage: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  getTargetName: (name: string | undefined) => string,
  handleSearchEvents: (processingId: string, location: string, timeframe: string, targetName: string) => Promise<void>
): Promise<void> {
  // Generate activity suggestions using MINI
  console.log('💡 Generating activity suggestions...');
  enqueueProgress(controller, encoder, 'Finding activity ideas...');

  const targetName = getTargetName(body.user2Name);

  // Determine timeframe
  const userMessage = body.userMessage.toLowerCase();
  let timeframe: 'today' | 'tomorrow' | 'this weekend' | 'next week' = 'this weekend';
  if (userMessage.includes('today')) timeframe = 'today';
  else if (userMessage.includes('tomorrow')) timeframe = 'tomorrow';
  else if (userMessage.includes('next week')) timeframe = 'next week';

  const eventLocation = body.user1Location || body.user2Location || 'San Francisco';
  const cityName = getCityName(eventLocation);

  // Generate suggestions with MINI IMMEDIATELY (don't wait for web search)
  const suggestionCompletion = await createCompletion({
    model: AI_MODELS.GPT5_MINI,
    reasoning_effort: 'low',
    verbosity: 'low',
    messages: [
      { role: 'system', content: `You help suggest activities for people to do together. Generate 3-5 specific, actionable activity suggestions.

Format your response as a friendly message followed by a bulleted list:
- Start with a short intro sentence using "near you and ${targetName} in ${cityName}"
- List 3-5 activities as bullet points with the MAIN ACTIVITY/PLACE in bold using **
- Each activity should be specific and mention why it's good
- Consider the user's location: ${cityName}
- Timeframe: ${timeframe}
- Keep it conversational and enthusiastic
- End with a question asking if any sound good (NOT "Which one sounds good?")

Example format:
"Here are some fun options for you and ${targetName} ${timeframe} near you in ${cityName}:

- **Coffee at a local café** - perfect for catching up in a relaxed setting
- **Hike at [local trail]** - enjoy nature and get some exercise together
- **Visit [museum/gallery]** - explore art or culture
- **Try a new restaurant** - discover new cuisine together
- **Outdoor activity** - take advantage of the weather

Any of these sound good to you?"` },
      { role: 'system', content: contextMessage },
      ...conversationHistory.map(msg => ({ role: msg.role as 'system' | 'user' | 'assistant', content: msg.content })),
      { role: 'user', content: body.userMessage },
    ],
  });

  const suggestions = suggestionCompletion.choices[0].message.content ||
    `Here are some ideas for you and ${targetName}:\n\n- Coffee or lunch\n- A walk or hike\n- Video call\n\nAny of these sound good to you?`;

  // Parse the suggestion to insert the search mention AFTER the question
  // The question is typically at the end, like "Any of these sound good to you?"
  const lines = suggestions.split('\n');

  // Find the last non-empty line (usually the question)
  let lastNonEmptyIndex = lines.length - 1;
  while (lastNonEmptyIndex >= 0 && lines[lastNonEmptyIndex].trim() === '') {
    lastNonEmptyIndex--;
  }

  // Insert the search mention AFTER the question
  const bulletPoints = lines.slice(0, lastNonEmptyIndex).join('\n');
  const question = lines[lastNonEmptyIndex] || '';

  const messageWithSearchMention = `${bulletPoints}\n\n${question}\n\nI'm also searching for special events happening ${timeframe}!`;

  // Send suggestions immediately
  enqueueContent(controller, encoder, messageWithSearchMention);

  // Clear loading for the main message
  enqueueClearLoading(controller, encoder);

  // Create processing state with proper key formatting
  const processingId = await processingStateManager.create(
    body as AISchedulingRequest,
    { intent: 'create_event' }
  );

  // Send enhancement_pending event to trigger frontend polling
  enqueueEnhancementPending(controller, encoder, processingId);

  console.log(`🌐 Starting background web search for ${eventLocation} ${timeframe} with processingId: ${processingId}...`);

  // Start background web search with streaming updates
  handleSearchEvents(
    processingId,
    eventLocation,
    timeframe,
    targetName
  ).catch(error => {
    console.error('Background web search error:', error);
  });
}
