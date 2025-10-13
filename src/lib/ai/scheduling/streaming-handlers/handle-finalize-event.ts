import { createCompletion, getModelForTask, getReasoningEffortForTask } from '@/lib/ai/scheduling/openai-client';
import { SCHEDULING_SYSTEM_PROMPT } from '@/lib/ai/system-prompts';
import { generateEventFunction, processGenerateEventResult } from '@/lib/ai/functions/generate-event';
import { createCompleteCalendarEvent, createTravelBufferDescription, calculateCalendarBlockTimes, determineAlternativesToShow } from '@/lib/events/event-utils';
import { isPlaceOpenAt } from '@/lib/places/place-utils';
import { enqueueProgress, enqueueContent, enqueueEvent } from './streaming-utils';
import type { AISchedulingRequest, Message, GenerateEventResult } from '@/types/ai-scheduling';
import type { TimeSlot, Event, CalendarUrls } from '@/types';
import type { Place } from '@/types/places';

/**
 * Unified handler for finalizing event time and place selection.
 * Used by both generate and edit paths after they've prepared the event template.
 */
export async function handleFinalizeEvent({
  eventTemplate,
  candidateSlots,
  places,
  hasExplicitTimeConflict,
  body,
  conversationHistory,
  contextMessage,
  controller,
  encoder,
  getTargetName,
  buildFinalEvent,
  buildTimeSelectionPrompt,
  timezone,
  isEdit = false,
}: {
  eventTemplate: Partial<Event>;
  candidateSlots: TimeSlot[];
  places: Place[];
  hasExplicitTimeConflict: boolean;
  body: AISchedulingRequest;
  conversationHistory: Message[];
  contextMessage: string;
  controller: ReadableStreamDefaultController;
  encoder: TextEncoder;
  getTargetName: (name: string | undefined) => string;
  buildFinalEvent: (body: AISchedulingRequest, eventResult: GenerateEventResult, template: Partial<Event>, description: string, location: string, urls: CalendarUrls) => Event;
  buildTimeSelectionPrompt: (slots: TimeSlot[], places: Place[], template: Partial<Event>, calendarType: string, timezone: string, noCommonTime: boolean) => string;
  timezone: string;
  isEdit?: boolean;
}): Promise<Event> {
  const targetName = getTargetName(body.user2Name);
  const noCommonTimeWarning = candidateSlots.length === 0;

  // Update progress
  enqueueProgress(controller, encoder, isEdit ? 'Updating event...' : 'Selecting time and place...');

  // Build time selection prompt with candidate slots
  const timeSelectionPrompt = buildTimeSelectionPrompt(
    candidateSlots,
    places,
    eventTemplate,
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
    throw new Error(isEdit ? 'Failed to generate edited event' : 'Failed to generate event');
  }

  const eventToolArgs = eventToolCall.function.arguments;

  // Generate final event from tool call
  const eventResult = processGenerateEventResult(
    eventToolArgs,
    candidateSlots,
    places,
    eventTemplate
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
    const intent = eventTemplate.intent || '';
    const isLeisure = intent === 'custom'; // "custom" intent means leisure/recreation activity

    if (isLeisure && isWeekdayMidday) {
      console.warn(`⚠️ LLM selected weekday-midday (${selectedTime.toISOString()}) for leisure event (intent: ${intent}, title: "${eventTemplate.title}") - overriding to first weekend/evening slot`);

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
            eventTemplate
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

  // Step 2: Generate rationale based on ACTUAL selected time and place
  console.log('💬 Generating rationale with actual selected time and place...');
  const rationaleStartTime = Date.now();

  const selectedTime = new Date(eventResult.startTime);
  const formattedTime = selectedTime.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone }) + ' at ' +
    selectedTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone });

  // Determine which alternatives to show based on user constraints
  const { showAlternativePlaces, showAlternativeTimes, includeConflictWarning } =
    determineAlternativesToShow(eventTemplate, !hasExplicitTimeConflict);

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
- Activity: ${eventTemplate.title}
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
    `I've scheduled **${eventTemplate.title}** for **${formattedTime}** at **${eventResult.place?.name}**.`;

  console.log(`⏱️ Rationale generation took ${Date.now() - rationaleStartTime}ms`);
  console.log('📝 Generated rationale:', rationale);

  const finalDescription = createTravelBufferDescription(
    eventResult.description,
    eventResult,
    eventTemplate,
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
    eventTemplate.travelBuffer
  );

  const { calendar_urls } = createCompleteCalendarEvent({
    title: eventResult.title,
    description: finalDescription,
    startTime: calendarBlockStart,
    endTime: calendarBlockEnd,
    location: locationString,
    eventType: eventTemplate.eventType as 'video' | 'in-person',
    travelBuffer: eventTemplate.travelBuffer,
    preferredPlaces: eventResult.place ? [eventResult.place] : undefined
  }, { email: user2Email }, undefined, timezone);

  // eventResult.startTime and endTime are ALREADY CORRECT (actual event times)
  const finalEvent = buildFinalEvent(
    body,
    eventResult,
    eventTemplate,
    finalDescription,
    locationString,
    calendar_urls
  );

  // Send the rationale/explanation message from message content
  if (rationale) {
    enqueueContent(controller, encoder, rationale);
  }

  // Send final event
  enqueueEvent(controller, encoder, finalEvent);

  return finalEvent;
}
