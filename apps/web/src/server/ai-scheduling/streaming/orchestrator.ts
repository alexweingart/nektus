import { createCompletion, AI_MODELS, getModelForTask, getReasoningEffortForTask } from '@/server/ai-scheduling/openai-client';
import { getTemplateGenerationSystemPrompt, getIntentClassificationPrompt, EVENT_SELECTION_SYSTEM_PROMPT } from '@/server/ai-scheduling/system-prompts';
import { getGenerateEventTemplateFunction } from '@/server/ai-scheduling/functions/generate-event-template';
import { generateEventFunction, processGenerateEventResult } from '@/server/ai-scheduling/functions/generate-event';
import { navigateToBookingLinkFunction } from '@/server/ai-scheduling/functions/navigate-to-booking';
import { getEditEventTemplateFunction } from '@/server/ai-scheduling/functions/edit-event-template';
import { searchPlaces } from '@/server/ai-scheduling/helpers/search-places';
import { processingStateManager } from '@/server/ai-scheduling/processing';
import { getCandidateSlotsWithFallback } from '@/server/calendar/scheduling';
import { enqueueAcknowledgment, enqueueProgress, enqueueError } from './streaming-utils';
import { handleGenerateEventTemplate } from './handle-generate-event-template';
import { handleEditEventTemplate } from './handle-edit-event-template';
import { handleProvideAlternatives } from './handle-provide-alternatives';
import { handleFinalizeEvent } from './handle-finalize-event-new';
import {
  buildTimeSelectionPrompt,
  determineAlternativesToShow,
  getRequestedTimeFromTemplate,
  formatSlotTime,
  formatPlaceData,
  enrichPlaceUrls
} from './handler-utils';
import { buildFormattingInstructions } from './formatting-utils';
import type { AISchedulingRequest, Message, OpenAIToolCall, DetermineIntentResult, TemplateHandlerResult } from '@/types/ai-scheduling';
import type { TimeSlot } from '@/types';
import type { Place } from '@/types/places';

/**
 * Constants for orchestrator configuration
 */
const CONFLICT_SEARCH_WINDOW_DAYS = 14; // Days to search when explicit time conflicts
const MAX_DISTINCT_TIME_SLOTS = 10;     // Maximum distinct days to show as alternatives
const MAX_PLACE_OPTIONS = 10;            // Maximum places to show as alternatives

/**
 * NEW 5-Stage Pipeline Orchestrator
 *
 * Stage 1: Intent Classification (NANO)
 * Stage 2: Route by Intent
 * Stage 3: Template Generation (MINI) - via template handlers
 * Stage 4: Business Logic - slots + places coordination (orchestrator)
 * Stage 5: LLM Selection (MINI) - generateEvent or provideAlternatives
 */
export async function streamSchedulingResponse(
  body: AISchedulingRequest,
  conversationHistory: Message[],
  contextMessage: string,
  availableTimeSlots: TimeSlot[],
  handleNavigateBooking: (toolCall: OpenAIToolCall, body: AISchedulingRequest, controller: ReadableStreamDefaultController, encoder: TextEncoder) => Promise<void>,
  handleSuggestActivities: (body: AISchedulingRequest, conversationHistory: Message[], contextMessage: string, controller: ReadableStreamDefaultController, encoder: TextEncoder, activitySearchQuery: string | null) => Promise<void>,
  handleShowMoreEvents: (controller: ReadableStreamDefaultController, encoder: TextEncoder) => Promise<void>
): Promise<Response> {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        // ===================================================================
        // STAGE 1: Intent Classification (NANO)
        // ===================================================================
        const targetName = body.user2Name || 'them';

        const acknowledgmentCompletion = await createCompletion({
          model: AI_MODELS.GPT5_NANO,
          reasoning_effort: 'minimal',
          verbosity: 'low',
          messages: [
            { role: 'system', content: getIntentClassificationPrompt(targetName) },
            ...conversationHistory,
            { role: 'user', content: body.userMessage },
          ],
          response_format: { type: 'json_object' },
        });

        const nanoResponse = JSON.parse(acknowledgmentCompletion.choices[0].message.content || '{"message": "Let me help you!", "intent": "confirm_scheduling"}');
        const acknowledgment = nanoResponse.message;
        const nanoIntent = nanoResponse.intent;

        enqueueAcknowledgment(controller, encoder, acknowledgment);

        // ===================================================================
        // STAGE 2: Route by Intent
        // ===================================================================
        if (nanoIntent === 'show_more_events') {
          await handleShowMoreEvents(controller, encoder);
          controller.close();
          return;
        }

        if (nanoIntent === 'suggest_activities') {
          const activitySearchQuery = nanoResponse.activitySearchQuery || null;
          await handleSuggestActivities(body, conversationHistory, contextMessage, controller, encoder, activitySearchQuery);
          controller.close();
          return;
        }

        if (nanoIntent === 'confirm_scheduling') {
          controller.close();
          return;
        }

        // ===================================================================
        // STAGE 3: Template Generation (MINI)
        // ===================================================================
        const slotsProvided = availableTimeSlots.length > 0;
        if (!slotsProvided) {
          enqueueProgress(controller, encoder, 'Getting schedules...');
        } else {
          enqueueProgress(controller, encoder, 'Thinking...');
        }

        const isNewEvent = conversationHistory.length === 0;

        // Only offer navigateToBookingLink if there's a cached event to confirm
        const cacheKey = `places:${body.user1Id}:${body.user2Id}`;
        const cachedEvent = await processingStateManager.getCached<{ finalEvent?: unknown }>(cacheKey);
        const hasExistingEvent = !!cachedEvent?.finalEvent;

        const tools = [
          { type: 'function' as const, function: getGenerateEventTemplateFunction() },
          ...(hasExistingEvent ? [{ type: 'function' as const, function: navigateToBookingLinkFunction }] : []),
          { type: 'function' as const, function: getEditEventTemplateFunction() },
        ];

        const extraction = await createCompletion({
          model: AI_MODELS.GPT5_MINI,
          reasoning_effort: 'low',
          verbosity: 'low',
          messages: [
            { role: 'system', content: getTemplateGenerationSystemPrompt() },
            { role: 'system', content: contextMessage },
            ...conversationHistory,
            { role: 'user', content: body.userMessage },
          ],
          tools,
          tool_choice: isNewEvent
            ? { type: 'function', function: { name: 'generateEventTemplate' } }
            : 'auto',
        });

        const toolCall = extraction.choices[0].message.tool_calls?.[0];
        if (!toolCall || toolCall.type !== 'function') {
          console.error('❌ No tool call found. Full response:', JSON.stringify(extraction.choices[0].message));
          throw new Error('No function called by LLM');
        }

        // Handle navigate to booking link (bypass template system)
        if (toolCall.function.name === 'navigateToBookingLink') {
          await handleNavigateBooking(toolCall, body, controller, encoder);
          controller.close();
          return;
        }

        // Get template from appropriate handler
        let templateResult: TemplateHandlerResult;

        if (toolCall.function.name === 'editEventTemplate' && conversationHistory.length > 0) {
          templateResult = await handleEditEventTemplate(toolCall, body);
        } else {
          // Default to generateEventTemplate (handles both new events and fallback cases)
          templateResult = await handleGenerateEventTemplate(toolCall, body.userMessage);
        }

        // ===================================================================
        // STAGE 4: Business Logic - Slots + Places
        // ===================================================================
        enqueueProgress(controller, encoder, 'Finding time and place...');

        // Get candidate slots with fallback
        const result = getCandidateSlotsWithFallback(
          availableTimeSlots,
          {
            duration: templateResult.template.duration || 60,
            preferredSchedulableHours: templateResult.template.preferredSchedulableHours,
            preferredSchedulableDates: templateResult.template.preferredSchedulableDates,
            travelBuffer: templateResult.template.travelBuffer,
          },
          body.calendarType,
          body.timezone
        );
        let slots = result.slots;
        const hasNoCommonTime = result.hasNoCommonTime;

        // Search places if needed
        let places: Place[] = templateResult.cachedPlaces || [];
        if (templateResult.needsPlaceSearch && !templateResult.cachedPlaces) {
          enqueueProgress(controller, encoder, 'Researching places...');
          places = await searchPlaces({
            intentResult: {
              intent: 'create_event',
              ...templateResult.placeSearchParams,
            } as DetermineIntentResult,
            userLocations: [body.user1Location, body.user2Location].filter(Boolean) as string[],
            userCoordinates: [body.user1Coordinates, body.user2Coordinates], // Pass coordinates from profiles
            userIp: body.userIp, // Pass IP for location fallback
          });
        }

        // Create fallback place for personal locations (no Foursquare search)
        if (places.length === 0 && !templateResult.needsPlaceSearch) {
          const templateAny = templateResult.template as Record<string, unknown>;
          const placeName = templateAny.specificPlaceName as string;
          if (placeName) {
            places = [{
              place_id: `personal-${Date.now()}`,
              name: placeName,
              address: '',
              coordinates: { lat: 0, lng: 0 },
              google_maps_url: '',
            }];
          }
        }

        // ===================================================================
        // STAGE 5: LLM Selection - Conditional Routing
        // ===================================================================

        // Check if this is an explicit time request
        const hasExplicitTimeRequest = templateResult.template.explicitUserTimes;

        // Path A1: NEW event with explicit time request that has no availability
        // Use same logic as Path B, but include requested time and show conflict message
        let conflictContext: { requestedTime: string; requestedTimeIndex: number } | undefined;

        // For suggested events, inject a synthetic slot at the event's exact time
        if (templateResult.isSuggestedEvent) {
          const requestedTime = getRequestedTimeFromTemplate(templateResult.template);
          if (requestedTime) {
            const requestedDate = new Date(requestedTime);
            const duration = templateResult.template.duration || 60;
            const requestedEndDate = new Date(requestedDate.getTime() + duration * 60 * 1000);
            slots = [{
              start: requestedDate.toISOString(),
              end: requestedEndDate.toISOString(),
            }];
            console.log(`📌 Injected suggested event slot: ${requestedDate.toISOString()}`);
          }

          // If Foursquare didn't find the venue, create a fallback Place from the template's venue/address
          if (places.length === 0) {
            const templateAny = templateResult.template as Record<string, unknown>;
            const placeName = (templateAny.specificPlaceName as string) || templateResult.template.title || 'Venue';
            const placeAddress = (templateAny.placeSearchQuery as string) || '';
            if (placeName) {
              const fallbackPlace: Place = {
                place_id: `suggested-${Date.now()}`,
                name: placeName,
                address: placeAddress,
                coordinates: { lat: 0, lng: 0 },
                google_maps_url: placeAddress
                  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeAddress)}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}`,
              };
              places = [fallbackPlace];
              console.log(`📍 Foursquare found nothing, using fallback place: ${placeName} (${placeAddress})`);
            }
          }
        }

        if (hasExplicitTimeRequest && hasNoCommonTime && !templateResult.isConditional && !templateResult.isSuggestedEvent) {
          const requestedTime = getRequestedTimeFromTemplate(templateResult.template);
          if (!requestedTime) {
            console.warn('⚠️ Could not construct requested time from template, falling through to normal flow');
          } else {
            // Modify template: widen date range, adjust time constraints from intent
            const today = new Date();
            const twoWeeksFromNow = new Date(today);
            twoWeeksFromNow.setDate(today.getDate() + CONFLICT_SEARCH_WINDOW_DAYS);

            const modifiedTemplate = {
              ...templateResult.template,
              preferredSchedulableDates: {
                startDate: today.toISOString().split('T')[0],
                endDate: twoWeeksFromNow.toISOString().split('T')[0],
                description: 'the next two weeks',
              },
              // Keep time constraints from intent (e.g., lunch hours), not explicit single time
              // The preferredSchedulableHours will be used for filtering, but we'll add requested time manually
            };

            // Get slots with modified template
            const { slots: modifiedSlots } = getCandidateSlotsWithFallback(
              availableTimeSlots,
              {
                duration: modifiedTemplate.duration || 60,
                preferredSchedulableHours: modifiedTemplate.preferredSchedulableHours,
                preferredSchedulableDates: modifiedTemplate.preferredSchedulableDates,
                travelBuffer: modifiedTemplate.travelBuffer,
              },
              body.calendarType,
              body.timezone
            );

            // Add requested time as first slot (even though it conflicts/is unavailable)
            const requestedDate = new Date(requestedTime);
            const requestedEndDate = new Date(requestedDate.getTime() + (modifiedTemplate.duration || 60) * 60 * 1000);
            const requestedSlot: TimeSlot = {
              start: requestedDate.toISOString(),
              end: requestedEndDate.toISOString(),
            };

            slots = [requestedSlot, ...modifiedSlots];
            conflictContext = {
              requestedTime: requestedDate.toISOString(),
              requestedTimeIndex: 0, // First slot is the requested time
            };

            // Update template reference for Path B
            templateResult.template = modifiedTemplate;
          }
        }

        // Path A2: Conditional edit with no matching times → Provide alternatives
        if (templateResult.isConditional && hasNoCommonTime) {

          // Get current event time from cached result
          const currentEventTime = templateResult.previousEvent?.startTime || new Date().toISOString();

          await handleProvideAlternatives({
            availableTimeSlots,
            template: templateResult.template,
            currentEventTime,
            body,
            controller,
            encoder,
            timezone: body.timezone,
          });

          controller.close();
          return;
        }

        // Path B: Normal event or conditional with matches → Generate event
        enqueueProgress(controller, encoder, 'Selecting time and place...');

        // Determine which alternatives to show
        const { showAlternativePlaces, showAlternativeTimes, includeConflictWarning } =
          determineAlternativesToShow(templateResult.template, true);

        // Build prompt for LLM time/place selection
        const selectionPrompt = buildTimeSelectionPrompt(
          slots,
          places,
          templateResult.template,
          body.calendarType,
          body.timezone,
          hasNoCommonTime
        );

        // Pre-build structured time data - ensure distinct days for alternatives
        const allTimeData = slots.map(slot => formatSlotTime(slot, body.timezone));

        // Filter to one slot per day to ensure alternatives are on different days
        const seenDays = new Set<string>();
        const timeData = allTimeData.filter(td => {
          const dayKey = `${td.dayLabel}-${td.dateContext}`; // Unique key per day
          if (seenDays.has(dayKey)) {
            return false;
          }
          seenDays.add(dayKey);
          return true;
        }).slice(0, MAX_DISTINCT_TIME_SLOTS);

        // Pre-build structured place data for all places
        const placeData = places.slice(0, MAX_PLACE_OPTIONS).map(formatPlaceData);

        // Determine location context for distance display
        const userLocations = [body.user1Location, body.user2Location].filter(Boolean);
        const locationContext: 'your_location' | 'other_person_location' | 'midpoint' =
          userLocations.length === 1
            ? (body.user1Location ? 'your_location' : 'other_person_location')
            : 'midpoint';

        // Extract specific place name if user explicitly requested one
        const explicitPlaceRequest = templateResult.template.specificPlaceName;

        // Build formatting instructions with decomposed data
        const formattingInstructions = buildFormattingInstructions(
          timeData,
          placeData,
          templateResult.template,
          conflictContext ? false : showAlternativePlaces, // If conflict, show only times
          conflictContext ? true : showAlternativeTimes,   // If conflict, show only times
          includeConflictWarning,
          body.user2Name || 'them',
          body.calendarType,
          locationContext,
          body.user2Name,
          conflictContext,
          explicitPlaceRequest,
          !!templateResult.isSuggestedEvent
        );

        // Call LLM to select best time and place AND generate message
        const eventCompletion = await createCompletion({
          model: getModelForTask('event'),
          reasoning_effort: getReasoningEffortForTask('event'),
          verbosity: 'low',
          messages: [
            { role: 'system', content: EVENT_SELECTION_SYSTEM_PROMPT },
            { role: 'system', content: contextMessage },
            { role: 'system', content: selectionPrompt },
            { role: 'system', content: formattingInstructions },
            { role: 'user', content: `Select the best time and place for: ${templateResult.template.title || templateResult.template.intent}` }
          ],
          tools: [{ type: 'function', function: generateEventFunction }],
          tool_choice: { type: 'function', function: { name: 'generateEvent' } },
        });

        const eventToolCall = eventCompletion.choices[0].message.tool_calls?.[0];
        if (!eventToolCall) {
          throw new Error('No generateEvent tool call returned');
        }

        // Ensure it's a function tool call (not a custom tool call)
        if (eventToolCall.type !== 'function') {
          throw new Error('Expected function tool call');
        }

        // Process the event result
        const eventResult = processGenerateEventResult(
          eventToolCall.function.arguments,
          slots,
          places,
          templateResult.template
        );

        // Post-process: Enrich place URLs in the LLM-generated message
        if (eventResult.message && places && places.length > 0) {
          eventResult.message = await enrichPlaceUrls(eventResult.message, places);
        }

        // Finalize event (create calendar event, stream result, cache)
        await handleFinalizeEvent(eventResult, templateResult.template, body, controller, encoder, places);

        controller.close();

      } catch (_error) {
        console.error('Streaming error:', _error);
        try {
          enqueueError(controller, encoder, 'Failed to process request');
        } catch (_encodeError) {
          console.error('Failed to send error message (controller already closed):', _encodeError);
        }
        try {
          controller.close();
        } catch (_closeError) {
          console.error('Failed to close controller:', _closeError);
        }
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
