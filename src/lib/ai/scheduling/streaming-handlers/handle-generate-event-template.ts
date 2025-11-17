import { processGenerateEventTemplateResult } from '@/lib/ai/functions/generate-event-template';
import { processingStateManager } from '@/lib/services/server/aiProcessingService';
import type { OpenAIToolCall } from '@/types/ai-scheduling';
import type { EventSearchResult } from '@/lib/ai/helpers/search-events';
import type { TemplateHandlerResult } from './types';

export async function handleGenerateEventTemplate(
  toolCall: OpenAIToolCall
): Promise<TemplateHandlerResult> {
  console.log('\n🔍 [DEBUG] RAW AI function arguments:');
  console.log(toolCall.function.arguments);

  const eventTemplate = processGenerateEventTemplateResult(toolCall.function.arguments);
  console.log('\n🔍 [DEBUG] Parsed event template intent:', eventTemplate.intent);
  console.log('🔍 [DEBUG] Parsed preferredSchedulableHours:', JSON.stringify(eventTemplate.preferredSchedulableHours, null, 2));

  // Apply title case to multi-word titles
  if (eventTemplate.title) {
    eventTemplate.title = eventTemplate.title
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  console.log('✅ Event template generated:', eventTemplate.title);

  // Check if user is booking a suggested event from search results
  const cacheKeys = await processingStateManager.getKeys('events:*');
  let suggestedEventDetails: EventSearchResult | null = null;

  if (cacheKeys && cacheKeys.length > 0) {
    // Sort by timestamp to get most recent
    const sortedKeys = cacheKeys.sort((a, b) => {
      const aTime = parseInt(a.split(':').pop() || '0');
      const bTime = parseInt(b.split(':').pop() || '0');
      return bTime - aTime;
    });

    const mostRecentKey = sortedKeys[0];
    const cached = await processingStateManager.getCached<{ events: EventSearchResult[] }>(mostRecentKey);

    if (cached && cached.events && eventTemplate.title) {
      // Try to find matching event by title (case-insensitive partial match)
      const titleLower = eventTemplate.title.toLowerCase();
      suggestedEventDetails = cached.events.find((event) =>
        event.title.toLowerCase().includes(titleLower) ||
        titleLower.includes(event.title.toLowerCase())
      ) || null;

      if (suggestedEventDetails) {
        console.log('📋 Found matching suggested event:', suggestedEventDetails.title);

        // Override template with suggested event details
        eventTemplate.specificPlaceName = suggestedEventDetails.title;
        eventTemplate.placeSearchQuery = suggestedEventDetails.address;
        eventTemplate.intentSpecificity = 'specific_place';

        // Extract time from suggested event if available
        if (suggestedEventDetails.startTime && suggestedEventDetails.date) {
          console.log(`📅 Using suggested event time: ${suggestedEventDetails.startTime} on ${suggestedEventDetails.date}`);
        }
      }
    }
  }

  return {
    template: eventTemplate,
    mode: 'new',
    needsPlaceSearch: eventTemplate.eventType === 'in-person',
    placeSearchParams: eventTemplate.eventType === 'in-person' ? {
      suggestedPlaceTypes: eventTemplate.suggestedPlaceTypes,
      intentSpecificity: eventTemplate.intentSpecificity as 'specific_place' | 'activity_type' | 'generic',
      activitySearchQuery: eventTemplate.activitySearchQuery || eventTemplate.placeSearchQuery
    } : undefined
  };
}
