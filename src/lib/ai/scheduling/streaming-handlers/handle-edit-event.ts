import { createCompletion, getModelForTask, getReasoningEffortForTask } from '@/lib/ai/scheduling/openai-client';
import { SCHEDULING_SYSTEM_PROMPT } from '@/lib/ai/system-prompts';
import { processEditEventResult } from '@/lib/ai/functions/edit-event';
import { generateEventFunction, processGenerateEventResult } from '@/lib/ai/functions/generate-event';
import { searchPlaces } from '@/lib/ai/helpers/search-places';
import { handleConditionalEdit } from '@/lib/ai/helpers/conditional-edit';
import { createCompleteCalendarEvent, applyDefaultTravelBuffer, createTravelBufferDescription, calculateCalendarBlockTimes } from '@/lib/events/event-utils';
import { getCandidateSlotsWithFallback } from '@/lib/events/scheduling-utils';
import { timeToMinutes, minutesToTime, formatEventTimeComponents } from '@/lib/events/time-utils';
import { processingStateManager } from '@/lib/services/server/aiProcessingService';
import { enqueueProgress, enqueueContent, enqueueEvent, enqueueShowCalendarButton } from './streaming-utils';
import type { AISchedulingRequest, Message, OpenAIToolCall, GenerateEventResult } from '@/types/ai-scheduling';
import type { TimeSlot, Event, CalendarUrls } from '@/types';
import type { Place } from '@/types/places';

export async function handleEditEvent(
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
  slotsProvided: boolean,
  timezone: string
): Promise<void> {
  console.log('✏️ Handling event edit...');

  const editResult = processEditEventResult(toolCall.function.arguments);
  console.log('📝 Edit request:', editResult);

  // Handle conditional modifications (e.g., "do I have any earlier times?")
  const isConditional = editResult.isConditional ?? false;
  const timePreference = editResult.timePreference;

  // Try to get cached places and event template
  const cacheKey = `places:${body.user1Id}:${body.user2Id}`;
  const cached = await processingStateManager.getCached(cacheKey);

  let places: Place[] = [];
  let eventTemplate: Partial<Event> | null = null;

  if (cached && cached.eventTemplate) {
    places = cached.places || [];
    eventTemplate = cached.eventTemplate;
    console.log(`✅ Using cached event template and ${places.length} places`);
  } else {
    console.log('⚠️ No cached data found - this edit might be slow');
  }

  // Apply edits to the event template
  if (eventTemplate) {
    if (editResult.newPreferredSchedulableDates) {
      eventTemplate.preferredSchedulableDates = editResult.newPreferredSchedulableDates;
    }

    // FIX: When timePreference is 'earlier' or 'later' WITHOUT explicit hours,
    // clear the schedulable hours constraint so we search ALL times in the date range
    if (editResult.timePreference &&
        (editResult.timePreference === 'earlier' || editResult.timePreference === 'later') &&
        !editResult.newPreferredSchedulableHours) {
      console.log(`🔧 Clearing schedulable hours for relative time search: ${editResult.timePreference}`);
      eventTemplate.preferredSchedulableHours = undefined;
    }

    let hasExplicitTimeRequest = false;
    if (editResult.newPreferredSchedulableHours) {
      // IMPORTANT: The LLM provides the ACTUAL event start time the user wants (e.g., "11 AM")
      // But preferredSchedulableHours needs to filter for SLOT start times (which include buffer)
      // So if user says "11 AM" and we have 30-min before buffer, we need slot at 10:30 AM
      // Adjust the hours by subtracting the before buffer
      const adjustedHours = {} as Record<string, TimeSlot[]>;
      const beforeBuffer = eventTemplate.travelBuffer?.beforeMinutes || 0;

      for (const [day, windows] of Object.entries(editResult.newPreferredSchedulableHours)) {
        adjustedHours[day] = (windows as TimeSlot[]).map((window: TimeSlot) => {
          const startMinutes = timeToMinutes(window.start) - beforeBuffer;
          let endMinutes = timeToMinutes(window.end) - beforeBuffer;

          // If start and end are the same (user specified exact time like "12:00"),
          // this is an EXPLICIT time request - honor it by creating exact slot needed
          if (startMinutes === endMinutes) {
            hasExplicitTimeRequest = true;
            const explicitSlotStart = startMinutes;
            const eventDuration = eventTemplate.duration || 60;
            const afterBuffer = eventTemplate.travelBuffer?.afterMinutes || 0;
            const totalDuration = beforeBuffer + eventDuration + afterBuffer;

            // Create exact slot for this explicit time (slot start to slot end)
            endMinutes = explicitSlotStart + totalDuration;

            console.log(`🎯 Explicit time request detected: Event at ${minutesToTime(startMinutes + beforeBuffer)}, creating slot ${minutesToTime(explicitSlotStart)} to ${minutesToTime(endMinutes)} (${totalDuration}min total)`);
          }

          return {
            start: minutesToTime(Math.max(0, startMinutes)),
            end: minutesToTime(endMinutes)
          };
        });
      }

      console.log(`🔧 Adjusted schedulable hours for ${beforeBuffer}min before buffer:`, {
        original: JSON.stringify(editResult.newPreferredSchedulableHours),
        adjusted: JSON.stringify(adjustedHours)
      });

      eventTemplate.preferredSchedulableHours = adjustedHours as unknown as typeof eventTemplate.preferredSchedulableHours;
      (eventTemplate as Record<string, unknown>).hasExplicitTimeRequest = hasExplicitTimeRequest;
    }
    if (editResult.newDuration) {
      eventTemplate.duration = editResult.newDuration;
    }

    // If user wants a different TYPE of place, search for new venues
    if (editResult.newPlaceType) {
      console.log(`🔍 User requested different venue type: "${editResult.newPlaceType}" - searching for new places`);
      enqueueProgress(controller, encoder, `Finding ${editResult.newPlaceType} options...`);

      try {
        const userLocations = [body.user1Location, body.user2Location].filter((loc): loc is string => Boolean(loc));
        const newPlaces = await searchPlaces({
          intentResult: {
            intent: 'create_event',
            intentSpecificity: 'activity_type',
            activitySearchQuery: editResult.newPlaceType,
            suggestedPlaceTypes: [editResult.newPlaceType],
          },
          userLocations,
        });

        if (newPlaces.length > 0) {
          console.log(`✅ Found ${newPlaces.length} new ${editResult.newPlaceType} options`);
          places = newPlaces;
          // Update cache with new places
          await processingStateManager.set(cacheKey, {
            eventTemplate,
            places: newPlaces,
          }, 1800); // 30 min TTL
        } else {
          console.warn(`⚠️ No ${editResult.newPlaceType} venues found, keeping original places`);
        }
      } catch (error) {
        console.error(`❌ Error searching for ${editResult.newPlaceType}:`, error);
      }
    }
  } else {
    // Fallback: extract from conversation history if no cache
    throw new Error(
      `Cannot edit event: No cached event template found for users ${body.user1Id} and ${body.user2Id}. ` +
      `Please create a new event instead of editing.`
    );
  }

  const updatedEventTemplate = applyDefaultTravelBuffer(eventTemplate);

  // Optimize slots with updated constraints
  enqueueProgress(controller, encoder, 'Finding new time...');

  // Get candidate slots with automatic fallback
  const { slots: candidateSlots, hasNoCommonTime: noCommonTimeWarning, hasExplicitTimeConflict: explicitTimeConflict } = getCandidateSlotsWithFallback(
    availableTimeSlots,
    {
      duration: updatedEventTemplate.duration || 60,
      intent: updatedEventTemplate.intent,
      preferredSchedulableHours: updatedEventTemplate.preferredSchedulableHours,
      preferredSchedulableDates: updatedEventTemplate.preferredSchedulableDates,
      travelBuffer: updatedEventTemplate.travelBuffer,
      hasExplicitTimeRequest: (updatedEventTemplate as Record<string, unknown>).hasExplicitTimeRequest as boolean | undefined,
    },
    body.calendarType
  );
  console.log(`✅ Found ${candidateSlots.length} candidate slots for edit`);

  // Handle conditional modifications - check if the requested change is possible
  if (isConditional) {
    const conditionalResult = await handleConditionalEdit({
      noCommonTimeWarning,
      candidateSlots,
      availableTimeSlots,
      updatedEventTemplate,
      cached,
      timePreference,
      body,
      controller,
      encoder,
      getTargetName,
      timezone,
    });

    if (conditionalResult.shouldReturnEarly) {
      return;
    }
  }

  // Update progress: finalizing
  enqueueProgress(controller, encoder, 'Updating event...');

  const targetName = getTargetName(body.user2Name);

  // Build time selection prompt with ALL candidate slots
  const timeSelectionPrompt = buildTimeSelectionPrompt(
    candidateSlots,
    places,
    updatedEventTemplate,
    body.calendarType,
    timezone,
    noCommonTimeWarning
  );

  // Step 1: LLM selects optimal time slot and place
  const eventGenStartTime = Date.now();
  const eventCompletion = await createCompletion({
    model: getModelForTask('event'),
    reasoning_effort: getReasoningEffortForTask('event'),
    verbosity: 'low',
    messages: [
      { role: 'system', content: SCHEDULING_SYSTEM_PROMPT },
      { role: 'system', content: `IMPORTANT: You are helping schedule with **${targetName}**.` },
      { role: 'system', content: contextMessage },
      ...conversationHistory.map(msg => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: body.userMessage },
      { role: 'assistant' as const, content: `Event template updated: ${JSON.stringify(updatedEventTemplate)}` },
      { role: 'assistant' as const, content: timeSelectionPrompt },
      ...(places.length > 0 ? [
        { role: 'assistant' as const, content: `Available places:\n${places.map((p, i) => `  ${i}: ${p.name} - ${p.address} (Rating: ${p.rating || 'N/A'})`).join('\n')}` }
      ] : []),
    ],
    tools: [{ type: 'function', function: generateEventFunction }],
    tool_choice: { type: 'function', function: { name: 'generateEvent' } },
  });

  console.log(`⏱️ Edit event generation took ${Date.now() - eventGenStartTime}ms`);

  const eventToolCall = eventCompletion.choices[0].message.tool_calls?.[0];
  if (!eventToolCall || eventToolCall.type !== 'function') {
    throw new Error('Failed to generate edited event');
  }

  // Process the edited event - use candidateSlots instead of finalAvailableSlots
  const eventResult = processGenerateEventResult(
    eventToolCall.function.arguments,
    candidateSlots,
    places,
    updatedEventTemplate
  );

  // Step 2: Generate rationale based on ACTUAL selected time
  const rationaleStart = Date.now();
  const actualEventStart = new Date(eventResult.startTime);
  const { dayName: formattedDay, date: formattedDate, time: formattedTime } = formatEventTimeComponents(actualEventStart, timezone);

  const conflictWarning = explicitTimeConflict
    ? `\n\n⚠️ **IMPORTANT**: This time conflicts with an existing event in your calendar, but I've scheduled it as you explicitly requested.`
    : '';

  // Build place change message if applicable
  const placeChangeMessage = editResult.newPlaceType && eventResult.place
    ? ` Changed location to **${eventResult.place.name}** (${eventResult.place.address}).`
    : '';

  const rationaleCompletion = await createCompletion({
    model: getModelForTask('event'),
    reasoning_effort: 'minimal',
    verbosity: 'low',
    messages: [
      { role: 'system', content: SCHEDULING_SYSTEM_PROMPT },
      { role: 'system', content: `You are helping schedule with **${targetName}**. IMPORTANT: You are NOT attending the event - don't say "works for me" or similar phrases.` },
      { role: 'system', content: contextMessage },
      ...conversationHistory.map(msg => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: body.userMessage },
      { role: 'assistant' as const, content: `Updated event scheduled for: ${formattedDay}, ${formattedDate} at ${formattedTime}${placeChangeMessage}${conflictWarning}` },
      { role: 'user' as const, content: `Provide a brief (1-2 sentence) confirmation message. Use the EXACT time: "${formattedDay}, ${formattedDate} at ${formattedTime}".${placeChangeMessage ? ` MUST mention the location change to ${eventResult.place?.name}.` : ''}${conflictWarning ? ' MUST mention the calendar conflict warning.' : ''} Do NOT say "works for me" - you are not attending.` }
    ],
  });

  console.log(`⏱️ Rationale generation took ${Date.now() - rationaleStart}ms`);

  const rationale = rationaleCompletion.choices[0].message.content || 'Event updated successfully.';

  const finalDescription = createTravelBufferDescription(
    eventResult.description,
    eventResult,
    updatedEventTemplate,
    timezone
  );

  const locationString = eventResult.place
    ? `${eventResult.place.name}, ${eventResult.place.address}`
    : '';

  // Calculate calendar block times (includes travel buffers)
  const { calendarBlockStart, calendarBlockEnd } = calculateCalendarBlockTimes(
    new Date(eventResult.startTime),
    new Date(eventResult.endTime),
    updatedEventTemplate.travelBuffer
  );

  const user2Email = body.user2Email || `user-${body.user2Id}@placeholder.com`;
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

  const finalEvent = buildFinalEvent(
    body,
    eventResult,
    updatedEventTemplate,
    finalDescription,
    locationString,
    calendar_urls
  );

  // Send the rationale
  enqueueContent(controller, encoder, rationale);

  enqueueEvent(controller, encoder, finalEvent);

  enqueueShowCalendarButton(controller, encoder, true);
}
