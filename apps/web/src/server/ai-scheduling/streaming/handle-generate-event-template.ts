import { processGenerateEventTemplateResult } from '@/server/ai-scheduling/functions/generate-event-template';
import { processingStateManager } from '@/server/ai-scheduling/processing';
import type { OpenAIToolCall, TemplateHandlerResult } from '@/types/ai-scheduling';
import type { EventSearchResult } from '@/server/ai-scheduling/helpers/search-events';
import type { SchedulableHours } from '@/types/profile';

/** Parse event date string to YYYY-MM-DD. Handles both "2026-02-07" and "Saturday, February 7, 2026". */
function parseEventDate(dateStr: string): string | null {
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // Try parsing human-readable format
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return null;
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Parse event time string to 24h "HH:MM". Handles "11:00 AM", "6:00 PM", or passthrough "18:00". */
function parseEventTime(timeStr: string): string | null {
  // Already 24h HH:MM
  if (/^\d{1,2}:\d{2}$/.test(timeStr) && !timeStr.includes(' ')) return timeStr.padStart(5, '0');
  // Parse 12h format like "11:00 AM" or "6:00 PM"
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1]);
  const minutes = match[2];
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

/** Get lowercase day name from a YYYY-MM-DD date string. */
function getDayName(dateStr: string): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const d = new Date(dateStr + 'T12:00:00');
  return days[d.getDay()];
}

const STOP_WORDS = new Set(['the', 'a', 'an', 'at', 'in', 'on', 'of', 'and', 'or', 'to', 'for', 'with', 'do', 'lets', "let's", 'go']);

/** Extract significant words from a string (lowercase, no punctuation, no stop words). */
function significantWords(str: string): string[] {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

/** Find the best matching cached event by word overlap. Returns the event if ≥50% of template words match. */
function findMatchingEvent(templateTitle: string, events: EventSearchResult[]): EventSearchResult | null {
  const templateWords = significantWords(templateTitle);
  if (templateWords.length === 0) return null;

  let bestMatch: EventSearchResult | null = null;
  let bestScore = 0;

  for (const event of events) {
    const eventWords = new Set(significantWords(event.title));
    const matchCount = templateWords.filter(w => eventWords.has(w)).length;
    const score = matchCount / templateWords.length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = event;
    }
  }

  // Require at least 50% of the template's significant words to appear in the event title
  return bestScore >= 0.5 ? bestMatch : null;
}

export async function handleGenerateEventTemplate(
  toolCall: OpenAIToolCall,
  userMessage?: string
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

    if (cached && cached.events) {
      // Try to find matching event by word overlap (handles typos, abbreviations, LLM rewording)
      // Check both LLM-generated title and user's raw message (LLM may ignore user's event reference)
      if (eventTemplate.title) {
        suggestedEventDetails = findMatchingEvent(eventTemplate.title, cached.events);
      }
      if (!suggestedEventDetails && userMessage) {
        suggestedEventDetails = findMatchingEvent(userMessage, cached.events);
      }

      if (suggestedEventDetails) {
        console.log('📋 Found matching suggested event:', suggestedEventDetails.title);

        // Override template with exact event details (corrects typos, skips alternatives)
        eventTemplate.title = suggestedEventDetails.title;
        // Use venue name if available, otherwise extract from address (before the dash/comma)
        const venueName = suggestedEventDetails.venue
          || suggestedEventDetails.address?.split(/[,—–-]/)[0]?.trim()
          || suggestedEventDetails.title;
        eventTemplate.specificPlaceName = venueName;
        eventTemplate.placeSearchQuery = suggestedEventDetails.address;
        eventTemplate.intentSpecificity = 'specific_place';
        eventTemplate.explicitUserTimes = true;

        // Apply event date constraints
        if (suggestedEventDetails.date) {
          const eventDate = parseEventDate(suggestedEventDetails.date);
          if (eventDate) {
            eventTemplate.preferredSchedulableDates = {
              startDate: eventDate,
              endDate: eventDate,
              description: `on ${suggestedEventDetails.date}`,
            };
            console.log(`📅 Set event date: ${eventDate}`);

            // Apply event time constraints
            const startTimeStr = suggestedEventDetails.startTime || suggestedEventDetails.time?.split(/[-–]/)[0]?.trim();
            const endTimeStr = suggestedEventDetails.endTime || suggestedEventDetails.time?.split(/[-–]/)[1]?.trim();

            if (startTimeStr && endTimeStr) {
              const start = parseEventTime(startTimeStr);
              const end = parseEventTime(endTimeStr);
              if (start && end) {
                const dayName = getDayName(eventDate);
                const hours = {} as SchedulableHours;
                hours[dayName as keyof SchedulableHours] = [{ start, end }];
                eventTemplate.preferredSchedulableHours = hours;
                (eventTemplate as Record<string, unknown>).explicitTime = start;
                console.log(`🕐 Set event hours: ${dayName} ${start}-${end}`);
              }
            }
          }
        }
      }
    }
  }

  const isSuggestedEvent = !!suggestedEventDetails;

  // For suggested events, still search Foursquare for the specific venue to get real coordinates/details
  const venueName = suggestedEventDetails?.venue
    || suggestedEventDetails?.address?.split(/[,—–-]/)[0]?.trim()
    || suggestedEventDetails?.title;

  return {
    template: eventTemplate,
    mode: 'new',
    isSuggestedEvent,
    needsPlaceSearch: eventTemplate.eventType === 'in-person' && eventTemplate.searchForPlaces !== false,
    placeSearchParams: eventTemplate.eventType === 'in-person' ? {
      suggestedPlaceTypes: eventTemplate.suggestedPlaceTypes,
      intentSpecificity: (isSuggestedEvent ? 'specific_place' : eventTemplate.intentSpecificity) as 'specific_place' | 'activity_type' | 'generic',
      activitySearchQuery: eventTemplate.activitySearchQuery || eventTemplate.placeSearchQuery,
      specificPlace: isSuggestedEvent ? venueName : eventTemplate.specificPlaceName,
    } : undefined
  };
}
