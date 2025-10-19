import { createCompletion, AI_MODELS, getModelForTask, getReasoningEffortForTask } from '@/lib/ai/scheduling/openai-client';
import { SCHEDULING_SYSTEM_PROMPT } from '@/lib/ai/system-prompts';
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
            { role: 'system', content: `You help people schedule time with ${targetName}. Output JSON with "message" and "intent".

Intent classification rules (DECIDE INTENT FIRST):
1. "show_more_events" = User wants to see MORE events from a previous search (CHECK THIS FIRST!)
   - Explicit requests: "show me more", "what else is there?", "show more events", "more options", "show the rest"
   - Questions: "what else?", "anything else?", "what else is happening?", "more?"
   - With numbers: "show me the other 7 events", "can you show the other 5", "show remaining events"
   - CRITICAL: If the previous message said "I found X more events - would you like to see them?", ANY affirmative response = show_more_events
   - Affirmative responses after being asked about more events: "yes", "yes please", "sure", "yeah", "yea", "ok", "show them", "send them"
   - Look for keywords: "other", "more", "rest", "remaining" combined with "events"

2. "handle_event" = User explicitly requests scheduling with SPECIFIC activity/time OR confirms/edits previous suggestion
   - Direct requests: "schedule dinner", "book tennis", "find time for coffee"
   - Action phrases: "can you schedule [activity]", "let's [activity]", "I want to [activity]"
   - **Looking/wanting to do specific activity: "looking to play pickleball", "want to play tennis", "hoping to grab coffee"**
   - Confirmation for event scheduling: "yes", "sure", "sounds good", "perfect", "that works", "ok" (UNLESS asking about more events)
   - Edit requests: Mentions specific day/time ("friday instead", "saturday", "different time", "another place")
   - **Alternative time requests: "are there any earlier times?", "do we have later options?", "any other times?"**
   - **Alternative day requests: "what about other days?", "can we do a different day?", "other day options?"**

3. "suggest_activities" = User wants to schedule but is ASKING FOR IDEAS about WHAT ACTIVITY to do (vague about the activity itself)
   - Questions: "what should we do?", "any ideas?", "what can we do together?"
   - Timeframe questions: "what should we do this weekend?", "ideas for tomorrow?" (WITHOUT specific activity)
   - Activity exploration: "what's fun to do?", "suggestions for activities?"
   - **NOT for time/day alternatives when event already exists**
   - **NOT when user already mentions a specific activity like "pickleball", "tennis", "dinner", etc.**

4. "confirm_scheduling" = Unrelated statement or tangential topic
   - Unrelated topics: "what printer is best?", "how's the weather?"
   - Vague statements: "I'm tired", "I like tennis" (without asking to schedule)
   - NOT asking about scheduling or activities

CRITICAL: Questions about ALTERNATIVE TIMES/DAYS for an existing event = handle_event. Questions about WHAT ACTIVITY to do = suggest_activities. "Show me more events" = show_more_events.

Message writing rules:
- For "show_more_events": Confirm and indicate loading more events (e.g., "Sure — let me show you more options!")
- For "handle_event": Enthusiastic confirmation. CRITICAL: NEVER include a question mark or ask for more information. Just confirm you're working on it. (e.g., "Sure — let me find time!" or "Got it — I'll schedule that now!")
- For "suggest_activities": Acknowledge and indicate you'll provide ideas (e.g., "Great question — let me find some ideas for you!")
- For "confirm_scheduling": Reference their statement, then redirect to scheduling with a question
- Keep to 1-2 sentences, warm and natural

CRITICAL FOR handle_event: Your message must NOT contain any question marks (?). Do not ask about preferences, dates, times, or locations. Just confirm you're scheduling it.

CRITICAL CONTEXT CHECK:
- Look at the LAST assistant message (the one immediately before the user's current message)
- If the LAST assistant message contains phrases like:
  * "I found X more events - would you like to see them?"
  * "Would you like to see them?"
  * "would you like to see more?"
  AND the user responds with ANY affirmative ("yes", "yes!", "sure", "ok", "yeah", "send them", etc.)
  THEN classify as show_more_events (NOT handle_event!)

This takes priority over other classifications.` },
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
            { role: 'system', content: SCHEDULING_SYSTEM_PROMPT },
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
          return slotDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: body.timezone }) +
                 ' at ' +
                 slotDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: body.timezone });
        };

        const formatPlaceLink = (place: Place) => {
          return place.googleMapsUrl ? `[${place.name}](${place.googleMapsUrl})` : place.name;
        };

        // Build selection prompts with options
        const slotOptions = slots.slice(0, 10).map((slot, idx) => {
          return `${idx}. ${formatSlotTime(slot)}`;
        }).join('\n');

        const placeOptions = places.slice(0, 10).map((place, idx) => {
          return `${idx}. ${place.name}${place.address ? ' - ' + place.address : ''}`;
        }).join('\n');

        // Build exact pre-formatted strings for the LLM to use
        const selectedSlotIdx = 0; // Will be determined by LLM
        const selectedPlaceIdx = 0;

        // Pre-build time strings for all slots
        const timeStrings = slots.slice(0, 10).map(formatSlotTime);
        // Pre-build place link strings for all places
        const placeLinkStrings = places.slice(0, 10).map(formatPlaceLink);

        // Build the user message with exact strings to use
        let userMessage = `Select the best time and place for: ${templateResult.template.title || templateResult.template.intent}.

Then write a warm message using these EXACT details:

TIME (use the time string for your selected slot index):
${timeStrings.map((t, i) => `Slot ${i}: "${t}"`).join('\n')}

${places.length > 0 ? `PLACE (use the exact markdown link for your selected place index):
${placeLinkStrings.map((p, i) => `Place ${i}: ${p}`).join('\n')}
` : ''}
MESSAGE FORMAT:
- Start with: "I've scheduled **${templateResult.template.title}** for **[your selected time string]**${places.length > 0 ? ' at [your selected place link]' : ''}."
${templateResult.template.travelBuffer ? `- Add: "*I've included ${templateResult.template.travelBuffer.beforeMinutes || 30}-minute travel buffers before and after.*"` : ''}
${showAlternativePlaces || showAlternativeTimes ? `
- Add: "I also considered these options:"` : ''}
${showAlternativePlaces ? `  - List exactly 3 alternative place links from indices [1], [2], [3] of your ranked places` : ''}
${showAlternativeTimes ? `  - List exactly 3 alternative time strings from indices [1], [2], [3] of your ranked slots` : ''}
${includeConflictWarning ? `- Add: "⚠️ **IMPORTANT**: This time conflicts with an existing event in your calendar, but I've scheduled it as requested."` : ''}
- End with: "When you create the event, ${body.user2Name || 'they'}'ll get an invite from your **${body.calendarType}** calendar. Let me know if you'd like to make any changes!"

IMPORTANT: Copy the time strings and place links EXACTLY as shown above. Do not rewrite them.`;

        // Call LLM to select best time and place AND generate message
        const eventCompletion = await createCompletion({
          model: getModelForTask('event'),
          reasoning_effort: getReasoningEffortForTask('event'),
          verbosity: 'low',
          messages: [
            { role: 'system', content: SCHEDULING_SYSTEM_PROMPT },
            { role: 'system', content: contextMessage },
            { role: 'system', content: selectionPrompt },
            { role: 'user', content: userMessage }
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
