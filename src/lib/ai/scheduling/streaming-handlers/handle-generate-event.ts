import { createCompletion, getModelForTask, getReasoningEffortForTask } from '@/lib/ai/scheduling/openai-client';
import { SCHEDULING_SYSTEM_PROMPT } from '@/lib/ai/system-prompts';
import { processGenerateEventTemplateResult } from '@/lib/ai/functions/generate-event-template';
import { generateEventFunction, processGenerateEventResult } from '@/lib/ai/functions/generate-event';
import { searchPlaces } from '@/lib/ai/helpers/search-places';
import { searchLocalEvents } from '@/lib/ai/helpers/search-events';
import { createCompleteCalendarEvent, applyDefaultTravelBuffer, createTravelBufferDescription, calculateCalendarBlockTimes } from '@/lib/events/event-utils';
import { getCandidateSlotsWithFallback } from '@/lib/events/scheduling-utils';
import { processingStateManager } from '@/lib/services/server/aiProcessingService';
import { isPlaceOpenAt } from '@/lib/places/place-utils';
import { enqueueProgress, enqueueEvent } from './streaming-utils';
import type { AISchedulingRequest, DetermineIntentResult, Message, OpenAIToolCall, GenerateEventResult } from '@/types/ai-scheduling';
import type { TimeSlot, Event, CalendarUrls } from '@/types';
import type { Place } from '@/types/places';
import type { EventSearchResult } from '@/lib/ai/helpers/search-events';

export async function handleGenerateEvent(
  toolCall: OpenAIToolCall,
  body: AISchedulingRequest,
  conversationHistory: Message[],
  contextMessage: string,
  availableTimeSlots: TimeSlot[],
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  getTargetName: (name: string | undefined) => string,
  buildFinalEvent: (body: AISchedulingRequest, eventResult: GenerateEventResult, template: Partial<Event>, description: string, location: string, urls: CalendarUrls) => Event,
  buildTimeSelectionPrompt: (slots: TimeSlot[], places: Place[], template: Partial<Event>, calendarType: string, timezone: string, noCommonTime: boolean) => string,
  handleSearchEventsEnhancement: (processingId: string, webSearchPromise: Promise<EventSearchResult[]>, template: Partial<Event>, slots: TimeSlot[], request: AISchedulingRequest, targetName: string) => Promise<void>,
  _slotsProvided: boolean
): Promise<void> {
  const eventTemplate = processGenerateEventTemplateResult(toolCall.function.arguments);

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
  let suggestedEventDetails = null;

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
      );

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

  // Create intent result from template
  const intentResult: DetermineIntentResult = {
    intent: 'create_event',
    activityType: eventTemplate.intent,
    intentSpecificity: (eventTemplate.intentSpecificity as 'specific_place' | 'activity_type' | 'generic') || 'activity_type',
    activitySearchQuery: eventTemplate.activitySearchQuery || eventTemplate.placeSearchQuery || '',
    suggestedPlaceTypes: eventTemplate.suggestedPlaceTypes || [],
    specificPlace: eventTemplate.specificPlaceName,
  };

  // Process event creation with template
  const updatedEventTemplate = applyDefaultTravelBuffer(eventTemplate);

  // Calculate timeframe once for reuse
  let timeframe: 'today' | 'tomorrow' | 'this weekend' | 'next week' = 'tomorrow';
  if (availableTimeSlots.length > 0) {
    const firstSlotDate = new Date(availableTimeSlots[0].start);
    const today = new Date();
    const daysDiff = Math.floor((firstSlotDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff <= 0) timeframe = 'today';
    else if (daysDiff <= 1) timeframe = 'tomorrow';
    else if (daysDiff <= 7) timeframe = 'this weekend';
    else timeframe = 'next week';
  }

  // PARALLEL OPERATIONS: Start all at once
  console.log('🚀 Starting parallel operations...');

  // 1. Start web search immediately (don't wait!)
  let webSearchPromise: Promise<EventSearchResult[]> | null = null;
  let webSearchComplete = false;

  if (intentResult.intentSpecificity === 'generic' ||
      (body.userMessage.toLowerCase().includes('special') ||
       body.userMessage.toLowerCase().includes('happening'))) {
    const eventLocation = body.user1Location || body.user2Location || 'San Francisco';
    console.log('🌐 Starting web search in background...');

    webSearchPromise = searchLocalEvents(eventLocation, timeframe)
      .then(events => {
        webSearchComplete = true;
        console.log(`✅ Web search completed with ${events.length} events`);
        return events;
      })
      .catch(_error => {
        console.log('ℹ️ Web search failed or not available:', _error);
        webSearchComplete = true;
        return [];
      });
    // DON'T AWAIT - let it run in background
  }

  // 2. Start slot optimization (fast, synchronous) - get candidate slots with automatic fallback
  const { slots: candidateSlots, hasNoCommonTime: noCommonTimeWarning, hasExplicitTimeConflict } = getCandidateSlotsWithFallback(
    availableTimeSlots,
    {
      duration: updatedEventTemplate.duration || 60,
      intent: updatedEventTemplate.intent,
      preferredSchedulableHours: updatedEventTemplate.preferredSchedulableHours,
      preferredSchedulableDates: updatedEventTemplate.preferredSchedulableDates,
      travelBuffer: updatedEventTemplate.travelBuffer,
    },
    body.calendarType
  );


  // 3. Start place search (only wait for this, not web search)
  let places: Place[] = [];
  if (eventTemplate.eventType === 'in-person') {
    // If we have suggested event details, create a place object from them
    if (suggestedEventDetails) {
      places = [{
        name: suggestedEventDetails.title,
        address: suggestedEventDetails.address,
        url: suggestedEventDetails.url,
        description: suggestedEventDetails.description,
        isOpen: true,
        place_id: '',
        coordinates: { lat: 0, lng: 0 },
        google_maps_url: suggestedEventDetails.url || '',
      } as Place];
      console.log('✅ Using suggested event as place:', places[0].name);
    } else {
      // Update progress: searching for places
      enqueueProgress(controller, encoder, 'Researching places...');

      const placeSearchStartTime = Date.now();
      places = await searchPlaces({
        intentResult,
        userLocations: [body.user1Location || '', body.user2Location || ''],
        dateTime: availableTimeSlots[0]?.start,
        timeframe,
      });
      console.log(`⏱️ Place search took ${Date.now() - placeSearchStartTime}ms (found ${places.length} places)`);
    }
  }

  const targetName = getTargetName(body.user2Name);

  // Update progress: selecting time and place
  enqueueProgress(controller, encoder, 'Selecting time and place...');

  const timezone = body.timezone;

  // Build time selection prompt with candidate slots
  const timeSelectionPrompt = buildTimeSelectionPrompt(
    candidateSlots,
    places,
    updatedEventTemplate,
    body.calendarType,
    timezone,
    noCommonTimeWarning
  );

  // Temporary diagnostic: log candidate slots
  console.log(`📋 Sending ${candidateSlots.length} candidate slots to LLM (showing first 15):`);
  candidateSlots.slice(0, 15).forEach((slot, i) => {
    const start = new Date(slot.start);
    if (updatedEventTemplate.travelBuffer?.beforeMinutes) {
      start.setMinutes(start.getMinutes() + updatedEventTemplate.travelBuffer.beforeMinutes);
    }
    const dayOfWeek = start.getDay();
    const hour = start.getHours();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isEvening = hour >= 17;
    const label = isWeekend ? '[WEEKEND]' : isEvening ? '[EVENING]' : '[WEEKDAY-MIDDAY]';
    console.log(`  ${i}: ${start.toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: timezone })} ${label}`);
  });

  const eventGenStartTime = Date.now();
  const eventCompletion = await createCompletion({
    model: getModelForTask('event'),
    reasoning_effort: getReasoningEffortForTask('event'),
    verbosity: 'low',
    messages: [
      { role: 'system', content: SCHEDULING_SYSTEM_PROMPT },
      { role: 'system', content: `IMPORTANT: You are helping schedule with **${targetName}**.` },
      { role: 'system', content: contextMessage },
      { role: 'system', content: timeSelectionPrompt }, // ALL SLOTS + SELECTION GUIDANCE
      ...conversationHistory.map(msg => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: body.userMessage },
    ],
    tools: [{ type: 'function', function: generateEventFunction }],
    tool_choice: { type: 'function', function: { name: 'generateEvent' } },
  });

  console.log(`⏱️ Final event generation LLM took ${Date.now() - eventGenStartTime}ms`);

  const eventToolCall = eventCompletion.choices[0].message.tool_calls?.[0];

  if (!eventToolCall || eventToolCall.type !== 'function') {
    throw new Error('Failed to generate event');
  }

  const eventToolArgs = eventToolCall.function.arguments;

  // Generate final event from tool call
  const eventResult = processGenerateEventResult(
    eventToolArgs,
    candidateSlots,
    places,
    updatedEventTemplate
  );

  // Validate personal calendar leisure events are scheduled on weekend/evening
  if (body.calendarType === 'personal') {
    const selectedTime = new Date(eventResult.startTime);
    const dayOfWeek = selectedTime.getDay();
    const hour = selectedTime.getHours();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isEvening = hour >= 17;
    const isWeekdayMidday = !isWeekend && !isEvening;

    // Check if this is a leisure/recreation event (NOT quick meetups like coffee/lunch)
    // Use intent classification - "custom" = leisure, specific food/drink intents = casual
    const intent = updatedEventTemplate.intent || '';
    const isLeisure = intent === 'custom'; // "custom" intent means leisure/recreation activity

    if (isLeisure && isWeekdayMidday) {
      console.warn(`⚠️ LLM selected weekday-midday (${selectedTime.toISOString()}) for leisure event (intent: ${intent}, title: "${updatedEventTemplate.title}") - overriding to first weekend/evening slot`);

      // Find first weekend or evening slot
      let foundAlternative = false;
      for (let i = 0; i < candidateSlots.length; i++) {
        const slotTime = new Date(candidateSlots[i].start);
        const slotDay = slotTime.getDay();
        const slotHour = slotTime.getHours();
        const slotIsWeekend = slotDay === 0 || slotDay === 6;
        const slotIsEvening = slotHour >= 17;

        if (slotIsWeekend || slotIsEvening) {
          // Override the event result with this slot
          const parsedArgs = JSON.parse(eventToolArgs);
          parsedArgs.slotIndex = i;
          const correctedResult = processGenerateEventResult(
            JSON.stringify(parsedArgs),
            candidateSlots,
            places,
            updatedEventTemplate
          );
          console.log(`✅ Corrected to slot ${i}: ${new Date(correctedResult.startTime).toISOString()}`);
          Object.assign(eventResult, correctedResult);
          foundAlternative = true;
          break;
        }
      }

      if (!foundAlternative) {
        console.warn(`⚠️ No weekend/evening slots available for leisure event - keeping weekday midday slot`);
      }
    }
  }

  // Update progress: finalizing event details
  enqueueProgress(controller, encoder, 'Finalizing event details...');

  // Now generate rationale in a second LLM call, knowing the actual selected time and place
  console.log('💬 Generating rationale with actual selected time and place...');
  const rationaleStartTime = Date.now();

  const selectedTime = new Date(eventResult.startTime);
  const formattedTime = selectedTime.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone }) + ' at ' +
    selectedTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone });

  // Determine which alternatives to show based on user constraints
  const { determineAlternativesToShow } = await import('@/lib/events/event-utils');
  const { showAlternativePlaces, showAlternativeTimes, includeConflictWarning } =
    determineAlternativesToShow(updatedEventTemplate, !hasExplicitTimeConflict);

  console.log(`📋 Showing alternatives: places=${showAlternativePlaces}, times=${showAlternativeTimes}, conflict=${includeConflictWarning}`);

  // Format alternative times from candidate slots (show up to 3 alternatives)
  const formatTimeOption = (slotStart: Date) => {
    const dayName = slotStart.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone });
    const time = slotStart.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone
    });
    const date = slotStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: timezone });
    return `${dayName}, ${date} at ${time}`;
  };

  const alternativeTimes = candidateSlots
    .map(slot => new Date(slot.start))
    .filter(slotTime => slotTime.getTime() !== selectedTime.getTime()) // Exclude selected time
    .slice(0, 3)
    .map(formatTimeOption);

  const hasAlternativeTimes = showAlternativeTimes && alternativeTimes.length > 0;

  const conflictWarning = includeConflictWarning
    ? `\n\n⚠️ **IMPORTANT**: This time conflicts with an existing event in your calendar, but I've scheduled it as requested.`
    : '';

  const rationaleCompletion = await createCompletion({
    model: getModelForTask('event'),
    reasoning_effort: getReasoningEffortForTask('event'),
    verbosity: 'low',
    messages: [
      { role: 'system', content: `You are helping the user schedule an event with ${targetName}. Write a warm, conversational message explaining what you've scheduled.

CRITICAL: Write the ACTUAL MESSAGE the user will see. Start immediately with what you've scheduled.

IMPORTANT CONTEXT:
- "You" refers to the current user (the person you're talking to)
- ${targetName} is the other person who will receive the invite
- The event is for both of them together

FORMAT:
I've scheduled **[activity]** for **${formattedTime}** at [venue name](https://www.google.com/maps/search/?api=1&query=URL_ENCODED_VENUE_AND_ADDRESS). *I've included 30-minute travel buffers before and after.*${conflictWarning}
${showAlternativePlaces || showAlternativeTimes ? `
I also considered these options:
${showAlternativePlaces ? '- [Alternative place 1](https://www.google.com/maps/search/?api=1&query=URL_ENCODED) - brief context about why this place is good\n- [Alternative place 2](https://www.google.com/maps/search/?api=1&query=URL_ENCODED) - brief context about why this place is good' : ''}
${showAlternativeTimes && hasAlternativeTimes ? alternativeTimes.map((t) => `- **${t}** - brief context about why this time could work`).join('\n') : ''}
` : ''}
When you create the event, ${targetName} will get an invite from your ${body.calendarType} calendar. Let me know if you'd like to make any changes!

IMPORTANT: Use the EXACT alternative places provided below. If specific venue names with addresses are given, use those exact names and addresses. Only use general categories if that's what's provided.${conflictWarning ? ' MUST include the calendar conflict warning.' : ''}

Use the EXACT time provided: ${formattedTime}. Use markdown **bold** for emphasis. Don't mention ${targetName} in the first sentence - they're already mentioned in the acknowledgment.` },
      { role: 'user', content: `Write a message for this event:
- Activity: ${updatedEventTemplate.title}
- Person: ${targetName}
- Time: ${formattedTime}
- Place: [${eventResult.place?.name || 'N/A'}](https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((eventResult.place?.name || '') + ', ' + (eventResult.place?.address || ''))})${showAlternativePlaces ? `
- Alternative places: ${(() => {
  // First try places that are open at the selected time
  let alternatives = places
    .filter(p => p.name !== eventResult.place?.name) // Exclude selected place
    .filter(p => isPlaceOpenAt(p, selectedTime)) // Only include places open at selected time
    .slice(0, 3)
    .map(p => `[${p.name}](https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + ', ' + p.address)})`);

  // If not enough open places, include any places we found (might be open, hours unknown)
  if (alternatives.length < 2 && places.length > 1) {
    alternatives = places
      .filter(p => p.name !== eventResult.place?.name)
      .slice(0, 3)
      .map(p => `[${p.name}](https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + ', ' + p.address)})`);
  }

  // If we have specific alternatives, use them
  if (alternatives.length > 0) {
    return alternatives.join(', ');
  }

  // Only use generic categories as absolute last resort (no places found at all)
  return 'nearby venues with similar amenities';
})()}` : ''}${showAlternativeTimes && hasAlternativeTimes ? `
- Alternative times: ${alternativeTimes.join(', ')}` : ''}` }
    ],
  });

  const rationale = rationaleCompletion.choices[0].message.content ||
    `I've scheduled **${updatedEventTemplate.title}** for **${formattedTime}** at **${eventResult.place?.name}**.`;

  console.log(`⏱️ Rationale generation took ${Date.now() - rationaleStartTime}ms`);
  console.log('📝 Generated rationale:', rationale);

  const finalDescription = createTravelBufferDescription(
    eventResult.description,
    eventResult,
    updatedEventTemplate,
    timezone
  );

  const locationString = eventResult.place
    ? `${eventResult.place.name}, ${eventResult.place.address}`
    : '';

  const user2Email = body.user2Email || `user-${body.user2Id}@placeholder.com`;

  // Calculate calendar block times (includes travel buffers)
  const { calendarBlockStart, calendarBlockEnd } = calculateCalendarBlockTimes(
    new Date(eventResult.startTime),
    new Date(eventResult.endTime),
    updatedEventTemplate.travelBuffer
  );

  const { calendar_urls } = createCompleteCalendarEvent({
    title: eventResult.title,
    description: finalDescription,
    startTime: calendarBlockStart,
    endTime: calendarBlockEnd,
    location: locationString,
    eventType: updatedEventTemplate.eventType as 'video' | 'in-person',
    travelBuffer: updatedEventTemplate.travelBuffer,
    preferredPlaces: eventResult.place ? [eventResult.place] : undefined
  }, { email: user2Email }, undefined, timezone);

  // eventResult.startTime and endTime are ALREADY CORRECT (actual event times)
  const finalEvent = buildFinalEvent(
    body,
    eventResult,
    updatedEventTemplate,
    finalDescription,
    locationString,
    calendar_urls
  );

  // Send the rationale/explanation message from message content
  if (rationale) {
    controller.enqueue(encoder.encode(
      `data: ${JSON.stringify({ type: 'content', text: rationale })}\n\n`
    ));
  }

  // Send final event
  enqueueEvent(controller, encoder, finalEvent);

  // Handle background web search enhancement if still running
  if (webSearchPromise && !webSearchComplete) {
    console.log('🔄 Web search still running, setting up background enhancement...');

    // Create processing ID for Redis polling
    const processingId = processingStateManager.generateId();

    // Send enhancement_pending event to frontend
    controller.enqueue(encoder.encode(
      `data: ${JSON.stringify({ type: 'enhancement_pending', processingId })}\n\n`
    ));

    // Start background handler (don't await - fire and forget)
    handleSearchEventsEnhancement(
      processingId,
      webSearchPromise,
      updatedEventTemplate,
      candidateSlots,
      body,
      targetName
    ).catch(error => {
      console.error('Background enhancement error:', error);
    });
  }

  // Cache template and places (if any) for future edits
  const cacheKey = `places:${body.user1Id}:${body.user2Id}`;
  await processingStateManager.set(cacheKey, {
    places,
    eventTemplate: updatedEventTemplate,
    timestamp: Date.now(),
  }, 1800); // Cache for 30 minutes
  console.log(`💾 Cached template and ${places.length} places for future edits`);
}
