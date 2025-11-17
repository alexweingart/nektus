import { createCompletion, getModelForTask, getReasoningEffortForTask } from '@/lib/ai/scheduling/openai-client';
import { EVENT_ENHANCEMENT_SYSTEM_PROMPT, buildEventEnhancementContext } from '@/lib/ai/system-prompts';
import { processingStateManager } from '@/lib/services/server/aiProcessingService';
import type { AISchedulingRequest } from '@/types/ai-scheduling';
import type { Event, TimeSlot } from '@/types';
import type { EventSearchResult } from '@/lib/ai/helpers/search-events';

// Extract street address from full address (e.g., "1326 Scott Street, San Francisco, CA 94115" -> "1326 Scott Street")
// Disabled: not currently used but kept for potential future use
// function getStreetAddress(fullAddress: string): string {
//   if (!fullAddress) return fullAddress;
//   // Split by comma and take the first part (street address)
//   const parts = fullAddress.split(',');
//   return parts[0]?.trim() || fullAddress;
// }

export async function handleSearchEvents(
  processingId: string,
  location: string,
  timeframe: string,
  targetName: string
): Promise<void> {
  try {
    // Use the streaming web search with progress updates
    const { createWebSearchResponse } = await import('@/lib/ai/scheduling/openai-client');

    // Calculate specific dates
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    switch (timeframe) {
      case 'today':
        startDate = new Date(now);
        endDate = new Date(now);
        break;
      case 'tomorrow':
        startDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'this weekend':
        const dayOfWeek = now.getDay();

        if (dayOfWeek === 0) {
          // Sunday - "this weekend" means today
          startDate = new Date(now);
          endDate = new Date(now);
        } else if (dayOfWeek === 6) {
          // Saturday - "this weekend" means today and tomorrow
          startDate = new Date(now);
          endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        } else {
          // Monday-Friday - "this weekend" means upcoming Saturday-Sunday
          const daysUntilSaturday = 6 - dayOfWeek;
          startDate = new Date(now.getTime() + daysUntilSaturday * 24 * 60 * 60 * 1000);
          endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
        }
        break;
      case 'next week':
        startDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        endDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        break;
    }

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    // First, get structured JSON with ALL events found
    const searchInput = `Find real events in ${location} between ${formatDate(startDate)} and ${formatDate(endDate)}.

REQUIRED: Use web search to find actual upcoming events. Include:
- Local festivals and special events
- Museum exhibitions and gallery openings
- Concerts and performances
- Food/wine events and farmers markets
- Outdoor activities and tours
- Community events

IMPORTANT SELECTION CRITERIA:
- Pick the most INTERESTING and UNIQUE events
- NO DUPLICATES: If multiple entries are about the same event, only include ONE comprehensive entry
- VARIETY: Include diverse event types
- Find as many quality events as you can (aim for 10-15)

URL REQUIREMENT:
- Provide a link where users can learn more about the event
- Use the most specific URL you can find (event page > venue page > listing page)
- Any URL is acceptable as long as it helps users find information about that specific event

Return ONLY valid JSON in this exact format:
{
  "events": [
    {
      "title": "Event Title",
      "url": "https://...",
      "time": "8:00 AM - 2:00 PM",
      "date": "Saturday, October 4, 2025",
      "address": "Full street address",
      "description": "One sentence description"
    }
  ]
}

Return ONLY the JSON object, nothing else.`;


    // Update state to show we're actively searching
    await processingStateManager.update(processingId, {
      progressMessage: `Searching for events near you and ${targetName}...`,
      progressType: 'searching',
    });

    // Track delta updates for throttling
    let deltaCount = 0;

    const response = await createWebSearchResponse({
      input: searchInput,
      location: {
        type: 'approximate',
        country: 'US',
        city: location
      },
      onSearchProgress: async () => {
        // Update progress message (OpenAI doesn't provide actual query text)
        await processingStateManager.update(processingId, {
          progressMessage: `Finding events near you and ${targetName}...`,
          progressType: 'searching',
        });
      },
      onDelta: async (_partialText: string) => {
        deltaCount++;
        // Track delta but DON'T stream raw JSON to user - we'll format it after completion
        if (deltaCount % 50 === 0) {
          // Just update progress message to show we're still working
          await processingStateManager.update(processingId, {
            progressMessage: 'Analyzing events...',
            progressType: 'processing',
          });
        }
      }
    });

    if (response.output_text && response.output_text.trim().length > 0) {
      // Parse JSON response
      try {
        const jsonMatch = response.output_text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        let allEvents = parsed.events || [];

        console.log(`✅ Found ${allEvents.length} events from web search (before deduplication)`);

        // Deduplicate events by title (case-insensitive)
        const seen = new Set<string>();
        allEvents = allEvents.filter((event: EventSearchResult) => {
          const normalizedTitle = event.title.toLowerCase().trim();
          if (seen.has(normalizedTitle)) {
            console.log(`🗑️ Removing duplicate: ${event.title}`);
            return false;
          }
          seen.add(normalizedTitle);
          return true;
        });

        console.log(`✅ After deduplication: ${allEvents.length} unique events`);

        // Handle case when no events found
        if (allEvents.length === 0) {
          console.log('ℹ️ No events found from web search');
          await processingStateManager.complete(processingId, {
            type: 'final',
            intent: 'special_events',
            message: `I searched for events happening ${timeframe}, but couldn't find any special events listed online. There might still be great things happening - would you like me to suggest some activities instead?`,
            showCreateButton: false,
            askForConfirmation: false,
          });
          return;
        }

        // Cache ALL events for "show more" functionality
        const cacheKey = `events:${location}:${timeframe}:${Date.now()}`;
        await processingStateManager.set(cacheKey, {
          events: allEvents,
          location,
          timeframe,
          shownCount: 5,
        }, 3600); // Cache for 1 hour

        // Format top 5 events for display
        const eventsToShow = allEvents.slice(0, 5);
        const formattedMessage = `Lots of awesome things happening ${timeframe}!\n\n` +
          eventsToShow.map((event: EventSearchResult) =>
            `- **[${event.title}](${event.url})**\n` +
            `  - 📅 ${event.time} on ${event.date}\n` +
            `  - 📍 ${event.address}\n` +
            `  - ${event.description}`
          ).join('\n\n') +
          (allEvents.length > 5 ? `\n\nI found ${allEvents.length - 5} more events - would you like to see them?` : '');

        // Store formatted message with cache key reference
        await processingStateManager.complete(processingId, {
          type: 'final',
          intent: 'special_events',
          message: formattedMessage,
          showCreateButton: false,
          askForConfirmation: false,
          eventsCacheKey: cacheKey, // Store cache key for "show more"
        });

        console.log(`✅ Web search results stored in Redis: ${processingId}`, {
          totalEvents: allEvents.length,
          shown: 5,
          cacheKey
        });
      } catch (parseError) {
        console.error('Error parsing event JSON:', parseError);
        // Fallback to raw text if JSON parsing fails
        await processingStateManager.complete(processingId, {
          type: 'final',
          intent: 'special_events',
          message: response.output_text,
          showCreateButton: false,
          askForConfirmation: false,
        });
      }
    } else {
      console.log('ℹ️ No web search results found');
      // Don't store anything - just let the processing ID expire
      await processingStateManager.update(processingId, {
        progressMessage: 'No results found',
        progressType: 'completed',
      });
    }

  } catch (error) {
    console.error(`❌ Web search failed for ${processingId}:`, error);
    await processingStateManager.error(processingId, error instanceof Error ? error.message : String(error));
  }
}

export async function handleSearchEventsEnhancement(
  processingId: string,
  webSearchPromise: Promise<EventSearchResult[]>,
  eventTemplate: Partial<Event>,
  timeSlots: TimeSlot[],
  request: AISchedulingRequest,
  targetName: string
): Promise<void> {
  try {
    console.log(`🎯 Waiting for web search to complete for ${processingId}...`);

    // Wait for web search to finish
    const webEvents = await webSearchPromise;

    if (webEvents.length === 0) {
      console.log('ℹ️ No special events found, skipping enhancement');
      return;
    }

    console.log(`✅ Found ${webEvents.length} special events, generating enhancement...`);

    // Generate enhanced message with special events
    const enhancementCompletion = await createCompletion({
      model: getModelForTask('navigation'),
      reasoning_effort: getReasoningEffortForTask('navigation'),
      verbosity: 'low',
      messages: [
        { role: 'system', content: EVENT_ENHANCEMENT_SYSTEM_PROMPT },
        { role: 'system', content: buildEventEnhancementContext(eventTemplate, targetName, webEvents) },
        { role: 'user', content: 'Suggest 5 alternative activities based on these special events.' }
      ],
      temperature: 0.8,
    });

    const enhancementMessage = enhancementCompletion.choices[0].message.content || '';

    if (!enhancementMessage) {
      console.log('⚠️ No enhancement message generated');
      return;
    }

    // Store in Redis - cast to expected type
    await processingStateManager.complete(processingId, {
      type: 'final',
      intent: 'create_event',
      message: `✨ **Special Events Nearby!**\n\n${enhancementMessage}`,
      showCreateButton: false,
      askForConfirmation: false,
    });

    console.log(`✅ Enhancement stored in Redis: ${processingId}`);

  } catch (_error) {
    console.error(`❌ Background web search enhancement failed for ${processingId}:`, _error);
    await processingStateManager.error(processingId, _error instanceof Error ? _error.message : String(_error));
  }
}
