import { createCompletion, AI_MODELS, getModelForTask, getReasoningEffortForTask } from '@/lib/ai/scheduling/openai-client';
import { TEMPLATE_GENERATION_SYSTEM_PROMPT, getIntentClassificationPrompt, EVENT_SELECTION_SYSTEM_PROMPT } from '@/lib/ai/system-prompts';
import { generateEventTemplateFunction } from '@/lib/ai/functions/generate-event-template';
import { generateEventFunction, processGenerateEventResult } from '@/lib/ai/functions/generate-event';
import { navigateToBookingLinkFunction } from '@/lib/ai/functions/navigate-to-booking';
import { editEventTemplateFunction } from '@/lib/ai/functions/edit-event-template';
import { searchPlaces } from '@/lib/ai/helpers/search-places';
import { getCandidateSlotsWithFallback } from '@/lib/events/scheduling-utils';
import { processingStateManager } from '@/lib/services/server/aiProcessingService';
import { enqueueAcknowledgment, enqueueProgress, enqueueError, enqueueContent } from './streaming-utils';
import { handleGenerateEventTemplate } from './handle-generate-event-template';
import { handleEditEventTemplate } from './handle-edit-event-template';
import { handleProvideAlternatives } from './handle-provide-alternatives';
import { handleFinalizeEvent } from './handle-finalize-event-new';
import { buildTimeSelectionPrompt } from './handler-utils';
import type { AISchedulingRequest, Message, OpenAIToolCall } from '@/types/ai-scheduling';
import type { TimeSlot, Event } from '@/types';
import type { Place } from '@/types/places';
import type { TemplateHandlerResult } from './types';

/**
 * Build formatting instructions for Stage 5 LLM - Event Generation (Path B)
 * Contains exact pre-formatted strings and message format rules
 */
function buildFormattingInstructions(
  timeStrings: string[],
  primaryPlaceStrings: string[],
  alternativePlaceStrings: string[],
  template: Partial<Event>,
  showAlternativePlaces: boolean,
  showAlternativeTimes: boolean,
  includeConflictWarning: boolean,
  user2Name: string,
  calendarType: string
): string {
  // Build example for primary place
  const primaryPlaceExample = primaryPlaceStrings.length > 0 && primaryPlaceStrings[0]
    ? ` at ${primaryPlaceStrings[0]}`
    : '';

  return `You must write a message using ONLY these pre-built strings. Do NOT generate your own text for times or places.

TIME OPTIONS:
${timeStrings.map((t, i) => `Slot ${i} → "${t}"`).join('\n')}

${primaryPlaceStrings.length > 0 ? `PRIMARY PLACE OPTIONS (for main event, use the one you selected):
${primaryPlaceStrings.map((p, i) => `Place ${i} → ${p}`).join('\n')}

ALTERNATIVE PLACE OPTIONS (for alternatives list, use indices 1, 2, 3):
${alternativePlaceStrings.map((p, i) => `Place ${i} → ${p}`).join('\n')}
` : ''}

YOUR MESSAGE FORMAT:

Line 1: I've scheduled **${template.title}** for **[Slot X from above]**${primaryPlaceExample ? ` at [Place X from PRIMARY OPTIONS]` : ''}.

${template.travelBuffer ? `Line 2: (blank line)

Line 3: *I've included ${template.travelBuffer.beforeMinutes || 30}-minute travel buffers before and after.*

Line 4: (blank line)

` : ''}${showAlternativePlaces || showAlternativeTimes ? `Line ${template.travelBuffer ? '5' : '2'}: I also considered these options:

${showAlternativePlaces ? `Line ${template.travelBuffer ? '6-8' : '3-5'}: List EXACTLY:
- [Place 1 from ALTERNATIVE OPTIONS]
- [Place 2 from ALTERNATIVE OPTIONS]
- [Place 3 from ALTERNATIVE OPTIONS]
` : ''}${showAlternativeTimes ? `Line ${template.travelBuffer ? '6-8' : '3-5'}: List EXACTLY:
- [Slot 1 from TIME OPTIONS]
- [Slot 2 from TIME OPTIONS]
- [Slot 3 from TIME OPTIONS]

(blank line)

` : ''}` : ''}${includeConflictWarning ? `Line X: ⚠️ **IMPORTANT**: This time conflicts with an existing event in your calendar, but I've scheduled it as requested.

` : ''}Final line: When you create the event, ${user2Name || 'they'}'ll get an invite from your **${calendarType}** calendar. Let me know if you'd like to make any changes!

CRITICAL:
- Copy the EXACT strings from the options above (including markdown brackets and links)
- Do NOT rewrite times or places
- Do NOT generate your own ratings, distances, or descriptions
- ONLY use the pre-built strings I provided`;
}

/**
 * Build formatting instructions for Stage 5 LLM - Alternatives (Path A)
 * Contains exact pre-formatted strings for alternatives message
 */
export function buildAlternativesFormattingInstructions(
  currentTimeString: string,
  alternativeTimeStrings: string[],
  requestDescription: string,
  reason: 'conflicts' | 'no_availability',
  hasWiderSearch: boolean,
  searchContext: string
): string {
  return `EXACT STRINGS TO USE:

CURRENT TIME (the time user wanted):
"${currentTimeString}"

ALTERNATIVE TIME OPTIONS (copy exactly for selected indices):
${alternativeTimeStrings.map((t, i) => `Option ${i}: "${t}"`).join('\n')}

REQUIRED MESSAGE FORMAT:
1. Explain the situation: "I checked, but ${requestDescription} ${reason === 'no_availability' ? 'has no availability' : 'conflicts with existing events'}. Here are your options:"

2. Present current time option: "**Keep original time:** [copy CURRENT TIME string from above]"

3. ${alternativeTimeStrings.length > 0 ? `Present alternatives: "**Available alternatives${hasWiderSearch ? ` in ${searchContext}` : ''}:**"
   - List your 3 selected options using their exact strings
   - Number them 1, 2, 3
   - Use the exact Option X strings from above` : 'If no alternatives: "Unfortunately, I couldn\'t find any other available times."'}

4. ${alternativeTimeStrings.length > 0 ? 'Close with: "Let me know which option works best!"' : 'Close with a helpful suggestion or question'}

CRITICAL RULES:
- Copy time strings EXACTLY character-for-character
- Do NOT modify or reformat the time strings
- Be warm and conversational in your message
- Keep formatting clean with proper line breaks and bold text`;
}

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
  handleSuggestActivities: (body: AISchedulingRequest, conversationHistory: Message[], contextMessage: string, controller: ReadableStreamDefaultController, encoder: TextEncoder) => Promise<void>,
  handleShowMoreEvents: (controller: ReadableStreamDefaultController, encoder: TextEncoder) => Promise<void>
): Promise<Response> {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        // ===================================================================
        // STAGE 1: Intent Classification (NANO)
        // ===================================================================
        console.log('⚡ Stage 1: Intent classification...');

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

        console.log('📝 NANO response:', { acknowledgment, intent: nanoIntent });
        enqueueAcknowledgment(controller, encoder, acknowledgment);

        // ===================================================================
        // STAGE 2: Route by Intent
        // ===================================================================
        if (nanoIntent === 'show_more_events') {
          console.log('✅ Stage 2: Routing to show_more_events');
          await handleShowMoreEvents(controller, encoder);
          controller.close();
          return;
        }

        if (nanoIntent === 'suggest_activities') {
          console.log('✅ Stage 2: Routing to suggest_activities');
          await handleSuggestActivities(body, conversationHistory, contextMessage, controller, encoder);
          controller.close();
          return;
        }

        if (nanoIntent === 'confirm_scheduling') {
          console.log('✅ Stage 2: Routing to confirm_scheduling (already responded)');
          controller.close();
          return;
        }

        // ===================================================================
        // STAGE 3: Template Generation (MINI)
        // ===================================================================
        console.log('🎯 Stage 3: Template generation for handle_event');

        const slotsProvided = availableTimeSlots.length > 0;
        if (!slotsProvided) {
          enqueueProgress(controller, encoder, 'Getting schedules...');
        } else {
          enqueueProgress(controller, encoder, 'Thinking...');
        }

        const isNewEvent = conversationHistory.length === 0;

        const extraction = await createCompletion({
          model: AI_MODELS.GPT5_MINI,
          reasoning_effort: 'low',
          verbosity: 'low',
          messages: [
            { role: 'system', content: TEMPLATE_GENERATION_SYSTEM_PROMPT },
            { role: 'system', content: contextMessage },
            ...conversationHistory,
            { role: 'user', content: body.userMessage },
          ],
          tools: [
            { type: 'function', function: generateEventTemplateFunction },
            { type: 'function', function: navigateToBookingLinkFunction },
            { type: 'function', function: editEventTemplateFunction },
          ],
          tool_choice: isNewEvent
            ? { type: 'function', function: { name: 'generateEventTemplate' } }
            : 'auto',
        });

        const toolCall = extraction.choices[0].message.tool_calls?.[0];
        if (!toolCall || toolCall.type !== 'function') {
          console.error('❌ No tool call found. Full response:', JSON.stringify(extraction.choices[0].message));
          throw new Error('No function called by LLM');
        }

        console.log(`✅ LLM called function: ${toolCall.function.name}`);

        // Handle navigate to booking link (bypass template system)
        if (toolCall.function.name === 'navigateToBookingLink') {
          if (conversationHistory.length === 0) {
            console.warn('⚠️ navigateToBookingLink called with no history - falling through to generateEventTemplate');
          } else {
            await handleNavigateBooking(toolCall, body, controller, encoder);
            controller.close();
            return;
          }
        }

        // Get template from appropriate handler
        let templateResult: TemplateHandlerResult;

        if (toolCall.function.name === 'editEventTemplate' && conversationHistory.length > 0) {
          templateResult = await handleEditEventTemplate(toolCall, body);
        } else {
          // Default to generateEventTemplate (handles both new events and fallback cases)
          templateResult = await handleGenerateEventTemplate(toolCall);
        }

        console.log(`✅ Template generated (mode: ${templateResult.mode})`);

        // ===================================================================
        // STAGE 4: Business Logic - Slots + Places
        // ===================================================================
        console.log('🔧 Stage 4: Business logic coordination');
        enqueueProgress(controller, encoder, 'Finding time and place...');

        // Get candidate slots with fallback
        const { slots, hasNoCommonTime, hasExplicitTimeConflict } = getCandidateSlotsWithFallback(
          availableTimeSlots,
          {
            duration: templateResult.template.duration || 60,
            intent: templateResult.template.intent,
            preferredSchedulableHours: templateResult.template.preferredSchedulableHours,
            preferredSchedulableDates: templateResult.template.preferredSchedulableDates,
            travelBuffer: templateResult.template.travelBuffer,
            hasExplicitTimeRequest: (templateResult.template as any).hasExplicitTimeRequest,
          },
          body.calendarType
        );

        console.log(`✅ Found ${slots.length} candidate slots (hasNoCommonTime: ${hasNoCommonTime}, hasExplicitTimeConflict: ${hasExplicitTimeConflict})`);

        // Search places if needed
        let places: Place[] = templateResult.cachedPlaces || [];
        if (templateResult.needsPlaceSearch && !templateResult.cachedPlaces) {
          enqueueProgress(controller, encoder, 'Researching places...');
          places = await searchPlaces({
            intentResult: {
              intent: 'create_event',
              ...templateResult.placeSearchParams,
            } as any,
            userLocations: [body.user1Location, body.user2Location].filter(Boolean) as string[],
          });
          console.log(`✅ Found ${places.length} places`);
        }

        // ===================================================================
        // STAGE 5: LLM Selection - Conditional Routing
        // ===================================================================
        console.log('🤖 Stage 5: LLM selection');

        // Path A: Conditional edit with no matching times → Provide alternatives
        if (templateResult.isConditional && hasNoCommonTime) {
          console.log('📋 Path A: Conditional edit with no matches → provideAlternatives');

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
        console.log('✅ Path B: Normal flow → generateEvent');
        enqueueProgress(controller, encoder, 'Selecting time and place...');

        // Determine which alternatives to show
        const { determineAlternativesToShow } = await import('@/lib/events/event-utils');
        const { showAlternativePlaces, showAlternativeTimes, includeConflictWarning } =
          determineAlternativesToShow(templateResult.template, !hasExplicitTimeConflict);

        console.log(`📋 Alternatives to show: places=${showAlternativePlaces}, times=${showAlternativeTimes}, conflict=${includeConflictWarning}`);
        console.log(`📋 Calendar type for message: ${body.calendarType}`);

        // Build prompt for LLM time/place selection
        const selectionPrompt = buildTimeSelectionPrompt(
          slots,
          places,
          templateResult.template,
          body.calendarType,
          body.timezone,
          hasNoCommonTime
        );

        // Format helpers
        const formatSlotTime = (slot: TimeSlot) => {
          const slotDate = new Date(slot.start);
          const now = new Date();
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);

          // Check if slot is today or tomorrow
          const slotDay = slotDate.toLocaleDateString('en-US', { timeZone: body.timezone });
          const todayDay = now.toLocaleDateString('en-US', { timeZone: body.timezone });
          const tomorrowDay = tomorrow.toLocaleDateString('en-US', { timeZone: body.timezone });

          const fullDate = slotDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: body.timezone });
          const time = slotDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: body.timezone });

          if (slotDay === todayDay) {
            return `Today (${fullDate}) at ${time}`;
          } else if (slotDay === tomorrowDay) {
            return `Tomorrow (${fullDate}) at ${time}`;
          } else {
            return `${fullDate} at ${time}`;
          }
        };

        const formatPlaceLink = (place: Place) => {
          return place.google_maps_url ? `[${place.name}](${place.google_maps_url})` : place.name;
        };

        const formatPlaceWithExplanation = (place: Place) => {
          const link = formatPlaceLink(place);
          const explanations: string[] = [];

          // Build natural language explanations based on place attributes
          if (place.rating && place.rating >= 4.5) {
            explanations.push('highly rated');
          } else if (place.rating && place.rating >= 4.0) {
            explanations.push('well-reviewed');
          }

          if (place.distance_from_midpoint_km !== undefined) {
            if (place.distance_from_midpoint_km < 1.5) {
              explanations.push('very close to midpoint');
            } else if (place.distance_from_midpoint_km < 3.0) {
              explanations.push('convenient location');
            }
          }

          if (place.price_level === 1) {
            explanations.push('budget-friendly');
          } else if (place.price_level && place.price_level >= 3) {
            explanations.push('upscale option');
          }

          if (place.opening_hours?.open_now === false) {
            explanations.push('currently closed');
          }

          return explanations.length > 0 ? `${link} - ${explanations.join(', ')}` : link;
        };

        // Pre-build time strings for all slots
        const timeStrings = slots.slice(0, 10).map(formatSlotTime);
        // Pre-build place strings:
        // - Primary selection (index 0): Clean link only
        // - Alternatives (index 1-3): Link with helpful details
        const primaryPlaceStrings = places.slice(0, 10).map(formatPlaceLink);
        const alternativePlaceStrings = places.slice(0, 10).map(formatPlaceWithExplanation);

        // Build formatting instructions with exact strings and format rules
        const formattingInstructions = buildFormattingInstructions(
          timeStrings,
          primaryPlaceStrings,
          alternativePlaceStrings,
          templateResult.template,
          showAlternativePlaces,
          showAlternativeTimes,
          includeConflictWarning,
          body.user2Name || 'them',
          body.calendarType
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
            { role: 'user', content: `Select the best time and place for: ${templateResult.template.title || templateResult.template.intent}\n\n${formattingInstructions}` }
          ],
          tools: [{ type: 'function', function: generateEventFunction }],
          tool_choice: { type: 'function', function: { name: 'generateEvent' } },
        });

        const eventToolCall = eventCompletion.choices[0].message.tool_calls?.[0];
        if (!eventToolCall) {
          throw new Error('No generateEvent tool call returned');
        }

        // Process the event result
        const eventResult = processGenerateEventResult(
          eventToolCall.function.arguments,
          slots,
          places,
          templateResult.template
        );

        console.log(`✅ Event selected: ${eventResult.startTime} - ${eventResult.endTime}`);

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
