import { createCompletion, AI_MODELS, getModelForTask, getReasoningEffortForTask } from '@/lib/ai/scheduling/openai-client';
import { TEMPLATE_GENERATION_SYSTEM_PROMPT, getIntentClassificationPrompt, EVENT_SELECTION_SYSTEM_PROMPT } from '@/lib/ai/system-prompts';
import { generateEventTemplateFunction } from '@/lib/ai/functions/generate-event-template';
import { generateEventFunction, processGenerateEventResult } from '@/lib/ai/functions/generate-event';
import { navigateToBookingLinkFunction } from '@/lib/ai/functions/navigate-to-booking';
import { editEventTemplateFunction } from '@/lib/ai/functions/edit-event-template';
import { searchPlaces } from '@/lib/ai/helpers/search-places';
import { getCandidateSlotsWithFallback } from '@/lib/events/scheduling-utils';
import { enqueueAcknowledgment, enqueueProgress, enqueueError } from './streaming-utils';
import { handleGenerateEventTemplate } from './handle-generate-event-template';
import { handleEditEventTemplate } from './handle-edit-event-template';
import { handleProvideAlternatives } from './handle-provide-alternatives';
import { handleFinalizeEvent } from './handle-finalize-event-new';
import { buildTimeSelectionPrompt } from './handler-utils';
import type { AISchedulingRequest, Message, OpenAIToolCall, DetermineIntentResult } from '@/types/ai-scheduling';
import type { TimeSlot, Event } from '@/types';
import type { Place } from '@/types/places';
import type { TemplateHandlerResult } from './types';

/**
 * Build formatting instructions for Stage 5 LLM - Event Generation (Path B)
 * Contains decomposed time/place data for selective formatting and rationale generation
 */
function buildFormattingInstructions(
  timeData: Array<{
    dayLabel: string;
    dateContext: string;
    time: string;
    isTomorrowOrToday: boolean;
  }>,
  placeData: Array<{
    name: string;
    url: string;
    rating?: number;
    distance_miles?: number;
    price_level?: number;
    open_now?: boolean;
    description?: string;
    tips?: string[];
    explanations: string[];
  }>,
  template: Partial<Event>,
  showAlternativePlaces: boolean,
  showAlternativeTimes: boolean,
  includeConflictWarning: boolean,
  user2Name: string,
  calendarType: string,
  locationContext: 'your_location' | 'other_person_location' | 'midpoint',
  otherPersonName?: string,
  conflictContext?: { requestedTime: string; requestedTimeIndex: number },
  explicitPlaceRequest?: string
): string {
  // Build time data display
  const timeDataDisplay = timeData.map((t, i) =>
    `Slot ${i}:\n  dayLabel: "${t.dayLabel}"\n  dateContext: "${t.dateContext}"\n  time: "${t.time}"\n  isTomorrowOrToday: ${t.isTomorrowOrToday}`
  ).join('\n\n');

  // Build place data display
  const placeDataDisplay = placeData.map((p, i) =>
    `Place ${i}:\n  name: "${p.name}"\n  url: "${p.url}"\n  rating: ${p.rating || 'N/A'}\n  distance_miles: ${p.distance_miles?.toFixed(1) || 'N/A'}${p.description ? `\n  description: "${p.description}"` : ''}${p.tips && p.tips.length > 0 ? `\n  reviews: ${p.tips.slice(0, 3).map(t => `"${t}"`).join(', ')}` : ''}\n  explanations: ${p.explanations.join(', ') || 'none'}`
  ).join('\n\n');

  return `## AVAILABLE DATA

TIME DATA:
${timeDataDisplay}

${placeData.length > 0 ? `PLACE DATA:
${placeDataDisplay}
` : ''}

${explicitPlaceRequest ? `## CRITICAL: USER'S EXPLICIT PLACE REQUEST

The user EXPLICITLY requested this specific venue: "${explicitPlaceRequest}"

PLACE SELECTION REQUIREMENT:
- You MUST select the place from PLACE DATA that BEST MATCHES "${explicitPlaceRequest}"
- Match by name similarity - look for places containing "${explicitPlaceRequest}" or variations
- DO NOT substitute with a different venue, even if you think another option is better
- DO NOT prioritize distance, rating, or other factors over matching the requested name
- If multiple places match, choose the best match based on name relevance

` : ''}

## MESSAGE FORMAT

**FIRST PARAGRAPH** (main event announcement with rationale):

CRITICAL URL INSTRUCTIONS:
- URLs are provided in the PLACE DATA section above
- Each place has a "url" field - this is the COMPLETE Google Maps URL
- Copy the ENTIRE URL exactly as shown - it starts with "https://www.google.com/maps/search/?api=1&query="
- DO NOT shorten URLs
- DO NOT create goo.gl short links
- DO NOT make up URLs
- Example: If the url is "https://www.google.com/maps/search/?api=1&query=Tennis+Court+37.7749%2C-122.4194", use that EXACT string

If isTomorrowOrToday is true:
"I've scheduled **${template.title}** at [place-name-from-data](exact-complete-url-from-place-data) for **{dayLabel}** ({dateContext}) at **{time}**. {rationale}."

If isTomorrowOrToday is false:
"I've scheduled **${template.title}** at [place-name-from-data](exact-complete-url-from-place-data) for **{dayLabel}**, {dateContext} at **{time}**. {rationale}."

FORMATTING RULES:
- Bold ONLY: event name ("${template.title}"), day label, and time
- Hyperlink ONLY: place name - use markdown format [name](COMPLETE_URL_FROM_PLACE_DATA)
- Everything else: plain text

RATIONALE (one sentence explaining your choice):

${conflictContext ? `
CONFLICT-SPECIFIC INSTRUCTIONS:
- You MUST select Slot ${conflictContext.requestedTimeIndex} (the user's explicitly requested time)
- Time selection: You selected this time per the user's explicit request. Mention that it either conflicts with an existing event OR is outside the schedulable hours for at least one person.
- Place factors: REQUIRED - Focus your rationale on WHY you picked this specific venue using your real-world knowledge about this venue's features, reputation, or characteristics.
- Alternative times: REQUIRED - Show the other available time slots as alternatives (Slot 1, Slot 2, Slot 3, etc.) in the ALTERNATIVES SECTION. These are times that don't conflict.
- Distance display: Use miles as provided in distance_miles field (already converted, rounded to 1 decimal place). ${
    locationContext === 'your_location' ? 'Say "X miles from your location"' :
    locationContext === 'other_person_location' ? `Say "X miles from ${otherPersonName}'s location"` :
    'Say "X miles from the midpoint"'
  }
- Example: "I picked this time per your request, though it does conflict with an existing event or is outside the schedulable hours for at least one of you. I chose [venue] because [specific venue knowledge and why it's good for this activity]."
` : `
NORMAL INSTRUCTIONS:
- Day/Time factors: Explain WHY you chose this specific day and time based on the activity type (e.g., afternoon vs morning, weekday vs weekend, avoiding rush hours). Only use "soonest available" if it's truly the first possible slot across all days.
- Place factors: REQUIRED - Use your real-world knowledge about this specific venue to explain what makes it good for this activity. Think about the venue's actual features, reputation, or characteristics. Do NOT fall back to generic location descriptions.
- Distance display: Use miles as provided in distance_miles field (already converted, rounded to 1 decimal place). ${
    locationContext === 'your_location' ? 'Say "X miles from your location"' :
    locationContext === 'other_person_location' ? `Say "X miles from ${otherPersonName}'s location"` :
    'Say "X miles from the midpoint"'
  }
`}

${template.travelBuffer ? `
**SECOND PARAGRAPH** (blank line, then travel buffer):

I've included ${template.travelBuffer.beforeMinutes || 30}-minute travel buffers before and after.

(blank line)
` : ''}
${showAlternativePlaces || showAlternativeTimes ? `
**ALTERNATIVES SECTION**:

"I also considered these options:"

${showAlternativePlaces ? `List Place 1, Place 2, Place 3 as BULLETED items:
- [place-name](COMPLETE_URL_FROM_PLACE_DATA). {description of venue} ({distance in miles})
- [place-name](COMPLETE_URL_FROM_PLACE_DATA). {description of venue} ({distance in miles})
- [place-name](COMPLETE_URL_FROM_PLACE_DATA). {description of venue} ({distance in miles})

Instructions for alternative venues:
- Use your real-world knowledge about each venue to write a brief (5-10 word) description/rationale
- Focus on what makes each venue unique or notable for this activity
- Distance is already in miles in the distance_miles field - display as "0.5 miles" format in parentheses
- Start description with capital letter (it follows a dash)
- Do NOT use generic phrases like "convenient location"
- CRITICAL: Use the COMPLETE url value from PLACE DATA for each alternative place. The URLs are long - that's correct. Do NOT shorten them.` : ''}
${showAlternativeTimes ? `List Slot 1, Slot 2, Slot 3 as BULLETED items using this format:
- **{dayLabel}**, {dateContext} at **{time}**. Brief context about why this time could work

Example: "- **Saturday**, Nov 16 at **6:30 PM**. Ideal dinner time on a weekend night, where both of you are available."
` : ''}

(blank line)
` : ''}
${includeConflictWarning ? `
**CONFLICT WARNING**:

⚠️ **IMPORTANT**: This time conflicts with an existing event in your calendar, but I've scheduled it as requested.

` : ''}
**FINAL PARAGRAPH**:

"When you create the event, ${user2Name || 'they'}'ll get an invite from your **${calendarType}** calendar. Let me know if you'd like to make any changes!"`;
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
        const result = getCandidateSlotsWithFallback(
          availableTimeSlots,
          {
            duration: templateResult.template.duration || 60,
            intent: templateResult.template.intent,
            preferredSchedulableHours: templateResult.template.preferredSchedulableHours,
            preferredSchedulableDates: templateResult.template.preferredSchedulableDates,
            travelBuffer: templateResult.template.travelBuffer,
            hasExplicitTimeRequest: templateResult.template.hasExplicitTimeRequest,
          },
          body.calendarType
        );
        let slots = result.slots;
        const hasNoCommonTime = result.hasNoCommonTime;
        const hasExplicitTimeConflict = result.hasExplicitTimeConflict;

        console.log(`✅ Found ${slots.length} candidate slots (hasNoCommonTime: ${hasNoCommonTime}, hasExplicitTimeConflict: ${hasExplicitTimeConflict})`);

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
            userIp: body.userIp, // Pass IP for location fallback
          });
          console.log(`✅ Found ${places.length} places`);
        }

        // ===================================================================
        // STAGE 5: LLM Selection - Conditional Routing
        // ===================================================================
        console.log('🤖 Stage 5: LLM selection');

        // Helper to construct requested time from template
        const getRequestedTimeFromTemplate = (template: Partial<Event> & { explicitTime?: string }): string | null => {
          const { preferredSchedulableDates, explicitTime } = template;

          if (!preferredSchedulableDates?.startDate || !explicitTime) {
            return null;
          }

          // Parse the explicit time (format: "12:00")
          const [hours, minutes] = explicitTime.split(':').map(Number);

          // Combine date and time
          const requestedDate = new Date(preferredSchedulableDates.startDate + 'T00:00:00');
          requestedDate.setHours(hours, minutes, 0, 0);

          return requestedDate.toISOString();
        };

        // Check if this is an explicit time request
        const hasExplicitTimeRequest = templateResult.template.explicitUserTimes;

        // Path A1: NEW event with explicit time request that has no availability
        // Use same logic as Path B, but include requested time and show conflict message
        let conflictContext: { requestedTime: string; requestedTimeIndex: number } | undefined;

        if (hasExplicitTimeRequest && hasNoCommonTime && !templateResult.isConditional) {
          console.log('📋 Path A1: Explicit time request with no availability → using Path B with conflict');

          const requestedTime = getRequestedTimeFromTemplate(templateResult.template);
          if (!requestedTime) {
            console.warn('⚠️ Could not construct requested time from template, falling through to normal flow');
          } else {
            // Modify template: widen date range, adjust time constraints from intent
            const today = new Date();
            const twoWeeksFromNow = new Date(today);
            twoWeeksFromNow.setDate(today.getDate() + 14);

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
                intent: modifiedTemplate.intent,
                preferredSchedulableHours: modifiedTemplate.preferredSchedulableHours,
                preferredSchedulableDates: modifiedTemplate.preferredSchedulableDates,
                travelBuffer: modifiedTemplate.travelBuffer,
              },
              body.calendarType
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

            console.log(`✅ Added requested time as primary slot with ${slots.length - 1} alternatives`);
          }
        }

        // Path A2: Conditional edit with no matching times → Provide alternatives
        if (templateResult.isConditional && hasNoCommonTime) {
          console.log('📋 Path A2: Conditional edit with no matches → provideAlternatives');

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

        // If we have a conflict context, show only time alternatives (not place alternatives)
        const finalShowAlternativePlaces = conflictContext ? false : showAlternativePlaces;
        const finalShowAlternativeTimes = conflictContext ? true : showAlternativeTimes;

        console.log(`📋 Alternatives to show: places=${finalShowAlternativePlaces} (original: ${showAlternativePlaces}), times=${finalShowAlternativeTimes} (original: ${showAlternativeTimes}), conflict=${includeConflictWarning}`);
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

        // Format helpers - return structured data for selective bolding
        const formatSlotTime = (slot: TimeSlot) => {
          const slotDate = new Date(slot.start);
          const now = new Date();
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);

          // Check if slot is today or tomorrow
          const slotDay = slotDate.toLocaleDateString('en-US', { timeZone: body.timezone });
          const todayDay = now.toLocaleDateString('en-US', { timeZone: body.timezone });
          const tomorrowDay = tomorrow.toLocaleDateString('en-US', { timeZone: body.timezone });

          const dayOfWeek = slotDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: body.timezone });
          const monthDay = slotDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: body.timezone });
          const time = slotDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: body.timezone });

          if (slotDay === todayDay) {
            return {
              dayLabel: 'Today',
              dateContext: `${dayOfWeek}, ${monthDay}`,
              time: time,
              isTomorrowOrToday: true
            };
          } else if (slotDay === tomorrowDay) {
            return {
              dayLabel: 'Tomorrow',
              dateContext: `${dayOfWeek}, ${monthDay}`,
              time: time,
              isTomorrowOrToday: true
            };
          } else {
            return {
              dayLabel: dayOfWeek,
              dateContext: monthDay,
              time: time,
              isTomorrowOrToday: false
            };
          }
        };

        // Format place data with decomposed attributes for rationale building
        const formatPlaceData = (place: Place) => {
          const explanations: string[] = [];

          // Build natural language explanations based on place attributes
          if (place.rating && place.rating >= 4.5) {
            explanations.push('highly rated');
          } else if (place.rating && place.rating >= 4.0) {
            explanations.push('well-reviewed');
          }

          // Distance is already shown as a number - let the AI decide if proximity is worth mentioning
          // Removed automatic distance explanations to avoid biasing toward closer venues

          if (place.price_level === 1) {
            explanations.push('budget-friendly');
          } else if (place.price_level && place.price_level >= 3) {
            explanations.push('upscale option');
          }

          if (place.opening_hours?.open_now === false) {
            explanations.push('currently closed');
          }

          // Convert km to miles for display
          const distance_miles = place.distance_from_midpoint_km !== undefined
            ? place.distance_from_midpoint_km / 1.609
            : undefined;

          return {
            name: place.name,
            url: place.google_maps_url,
            rating: place.rating,
            distance_miles: distance_miles,
            price_level: place.price_level,
            open_now: place.opening_hours?.open_now,
            description: place.description,
            tips: place.tips,
            explanations: explanations
          };
        };

        // Pre-build structured time data - ensure distinct days for alternatives
        const allTimeData = slots.map(formatSlotTime);

        // Filter to one slot per day to ensure alternatives are on different days
        const seenDays = new Set<string>();
        const timeData = allTimeData.filter(td => {
          const dayKey = `${td.dayLabel}-${td.dateContext}`; // Unique key per day
          if (seenDays.has(dayKey)) {
            return false;
          }
          seenDays.add(dayKey);
          return true;
        }).slice(0, 10); // Take up to 10 distinct days

        // Pre-build structured place data for all places
        const placeData = places.slice(0, 10).map(formatPlaceData);

        // LOG: Check if descriptions/reviews are present
        console.log('📝 Place descriptions & reviews:');
        placeData.forEach((p, i) => {
          const desc = p.description ? `DESC: "${p.description.substring(0, 60)}..."` : 'NO DESC';
          const tips = p.tips && p.tips.length > 0 ? `REVIEWS: ${p.tips.length} tips` : 'NO REVIEWS';
          console.log(`   Place ${i} (${p.name}): ${desc}, ${tips}`);
        });

        // LOG: Verify URLs are real Google Maps URLs, not example.com
        console.log('🔗 Place URLs being sent to LLM:');
        placeData.forEach((p, i) => {
          console.log(`   Place ${i}: ${p.name} -> ${p.url.substring(0, 80)}...`);
        });

        // Determine location context for distance display
        const userLocations = [body.user1Location, body.user2Location].filter(Boolean);
        const locationContext: 'your_location' | 'other_person_location' | 'midpoint' =
          userLocations.length === 1
            ? (body.user1Location ? 'your_location' : 'other_person_location')
            : 'midpoint';

        // Extract specific place name if user explicitly requested one
        const explicitPlaceRequest = (templateResult.template as any).specificPlaceName;
        if (explicitPlaceRequest) {
          console.log(`🎯 User explicitly requested place: "${explicitPlaceRequest}"`);
        }

        // Build formatting instructions with decomposed data
        const formattingInstructions = buildFormattingInstructions(
          timeData,
          placeData,
          templateResult.template,
          finalShowAlternativePlaces,
          finalShowAlternativeTimes,
          includeConflictWarning,
          body.user2Name || 'them',
          body.calendarType,
          locationContext,
          body.user2Name,
          conflictContext,
          explicitPlaceRequest
        );

        // LOG: Show full formatting instructions to debug URL issues
        console.log('📋 Formatting instructions preview (first 1500 chars):');
        console.log(formattingInstructions.substring(0, 1500));

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

        // Process the event result
        const eventResult = processGenerateEventResult(
          eventToolCall.function.arguments,
          slots,
          places,
          templateResult.template
        );

        console.log(`✅ Event selected: ${eventResult.startTime} - ${eventResult.endTime}`);

        // Post-process: Enrich place URLs in the LLM-generated message
        if (eventResult.message && places && places.length > 0) {
          console.log('🔄 Post-processing message to enrich place URLs...');
          const { getGooglePlaceIds } = await import('@/lib/places/google-places-client');
          const { generateGoogleMapsUrl } = await import('@/lib/location/location-utils');

          let message = eventResult.message;

          // Extract place names from markdown links in the message
          // Format: [Place Name](URL)
          const placeLinksRegex = /\[([^\]]+)\]\(https:\/\/www\.google\.com\/maps\/search\/[^\)]+\)/g;
          const mentionedPlaceNames = new Set<string>();
          let match;
          while ((match = placeLinksRegex.exec(message)) !== null) {
            mentionedPlaceNames.add(match[1]); // Extract place name from [Place Name](URL)
          }

          console.log(`📍 Found ${mentionedPlaceNames.size} places mentioned in message:`, Array.from(mentionedPlaceNames));

          // Find Place objects for mentioned places
          const placesToEnrich = places.filter(p =>
            Array.from(mentionedPlaceNames).some(name =>
              p.name.includes(name) || name.includes(p.name)
            )
          );

          console.log(`🚀 Enriching ${placesToEnrich.length} places mentioned in message...`);

          if (placesToEnrich.length > 0) {
            const placeIdMap = await getGooglePlaceIds(
              placesToEnrich.map(p => ({ name: p.name, coordinates: p.coordinates }))
            );

            // Update places with Google Place IDs and regenerate URLs
            placesToEnrich.forEach(place => {
              const googlePlaceId = placeIdMap.get(place.name);
              if (googlePlaceId) {
                place.google_place_id = googlePlaceId;
                const enrichedUrl = generateGoogleMapsUrl(
                  place.coordinates,
                  place.name,
                  googlePlaceId
                );
                place.google_maps_url = enrichedUrl;

                // Replace the old URL in the message
                // Find the markdown link with this place name and replace its URL
                const linkRegex = new RegExp(`(\\[${place.name}\\])\\(https:\\/\\/www\\.google\\.com\\/maps\\/search\\/[^\\)]+\\)`, 'g');
                message = message.replace(linkRegex, `$1(${enrichedUrl})`);

                console.log(`✅ Replaced URL for ${place.name}`);
              }
            });

            // Update the message in eventResult
            eventResult.message = message;
            console.log('✅ Message URLs enriched with Google Place IDs');
          }
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
