import { createCompletion, getModelForTask, getReasoningEffortForTask } from '@/lib/ai/scheduling/openai-client';
import { getAllValidSlots } from '@/lib/events/scheduling-utils';
import { DAYS_TO_MS, formatEventTimeComponents } from '@/lib/events/time-utils';
import { enqueueContent } from '@/lib/ai/scheduling/streaming-handlers/streaming-utils';
import type { AISchedulingRequest } from '@/types/ai-scheduling';
import type { TimeSlot, Event } from '@/types';

interface ConditionalEditParams {
  noCommonTimeWarning: boolean;
  candidateSlots: TimeSlot[];
  availableTimeSlots: TimeSlot[];
  updatedEventTemplate: Partial<Event>;
  cached: { places?: unknown[]; eventTemplate?: Partial<Event>; eventResult?: { startTime: string; endTime: string } } | null;
  timePreference: string | undefined;
  body: AISchedulingRequest;
  controller: ReadableStreamDefaultController;
  encoder: TextEncoder;
  getTargetName: (name: string | undefined) => string;
  timezone: string;
}

interface ConditionalEditResult {
  shouldReturnEarly: boolean;
  hasMatchingSlots?: boolean;
}

export async function handleConditionalEdit({
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
}: ConditionalEditParams): Promise<ConditionalEditResult> {
  console.log(`🔍 Conditional modification detected: checking if requested time is available (timePreference: ${timePreference || 'none'})`);

  // If we had to use fallback slots (no actual common time), offer alternatives
  if (noCommonTimeWarning) {
    console.log(`❌ No actual free slots for requested time - offering alternatives`);

    const _targetName = getTargetName(body.user2Name);

    // Get ONLY truly available slots (use getAllValidSlots directly, not fallback)
    // First try with the user's date constraint
    let trueAvailableSlots = getAllValidSlots(
      availableTimeSlots,
      {
        duration: updatedEventTemplate.duration || 60,
        preferredSchedulableDates: updatedEventTemplate.preferredSchedulableDates,
        travelBuffer: updatedEventTemplate.travelBuffer,
        // NO schedulable hours constraint - get ALL times in date range
      }
    );

    // If no slots found with their constraint, widen to show alternatives from broader date range
    const needsWiderSearch = trueAvailableSlots.length === 0 && updatedEventTemplate.preferredSchedulableDates;
    if (needsWiderSearch && updatedEventTemplate.preferredSchedulableDates) {
      console.log(`📅 No slots in ${updatedEventTemplate.preferredSchedulableDates.description}, widening search to full week`);

      // Expand date range to include more context (e.g., if they asked for Monday, show Tues-Sun too)
      const originalStart = new Date(updatedEventTemplate.preferredSchedulableDates.startDate);
      const originalEnd = new Date(updatedEventTemplate.preferredSchedulableDates.endDate);

      // Extend to cover at least 7 days from the original start
      const widerEnd = new Date(Math.max(originalEnd.getTime(), originalStart.getTime() + DAYS_TO_MS(7)));

      trueAvailableSlots = getAllValidSlots(
        availableTimeSlots,
        {
          duration: updatedEventTemplate.duration || 60,
          preferredSchedulableDates: {
            startDate: updatedEventTemplate.preferredSchedulableDates.startDate,
            endDate: widerEnd.toISOString().split('T')[0],
            description: 'that week'
          },
          travelBuffer: updatedEventTemplate.travelBuffer,
        }
      );
    }

    // Get current event details for comparison
    const currentEventStart = cached?.eventResult?.startTime
      ? new Date(cached.eventResult.startTime)
      : availableTimeSlots[0] ? new Date(availableTimeSlots[0].start) : new Date();

    // Format times for display
    const formatTimeOption = (slot: TimeSlot) => {
      const slotStart = new Date(slot.start);
      return formatEventTimeComponents(slotStart, timezone).formatted;
    };

    const currentTimeFormatted = formatTimeOption({ start: currentEventStart.toISOString(), end: '' });

    // Build a descriptive message about what was requested
    const dateDesc = updatedEventTemplate.preferredSchedulableDates?.description || 'that time range';
    const hasTimeConstraint = updatedEventTemplate.preferredSchedulableHours &&
      Object.keys(updatedEventTemplate.preferredSchedulableHours).length > 0;

    let requestedDesc = dateDesc;
    if (hasTimeConstraint) {
      // Describe the time constraint (e.g., "weeknight evenings")
      const days = Object.keys(updatedEventTemplate.preferredSchedulableHours!);
      if (days.length === 5 && days.includes('monday') && days.includes('friday')) {
        requestedDesc = `weeknight evenings ${dateDesc}`;
      } else if (days.length >= 1) {
        requestedDesc = `${dateDesc} during the requested hours`;
      }
    }

    const fallbackTimeFormatted = candidateSlots.length > 0 ? formatTimeOption(candidateSlots[0]) : null;

    // Use LLM to intelligently select the best 3 alternative times
    let selectedAlternatives: string[] = [];
    if (trueAvailableSlots.length > 0) {
      // Format all slots with metadata for LLM selection
      const slotOptions = trueAvailableSlots.slice(0, 30).map((slot, index) => {
        const slotStart = new Date(slot.start);
        const dayOfWeek = slotStart.getDay();
        const hour = slotStart.getHours();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isEvening = hour >= 17;
        const timeCategory = isWeekend ? 'weekend' : isEvening ? 'weeknight-evening' : 'weekday-midday';

        return {
          index,
          formatted: formatTimeOption(slot),
          dayOfWeek: slotStart.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone }),
          hour,
          timeCategory
        };
      });

      const selectionCompletion = await createCompletion({
        model: getModelForTask('event'),
        reasoning_effort: getReasoningEffortForTask('event'),
        verbosity: 'low',
        messages: [
          { role: 'system', content: `You are selecting the best 3 alternative times for a ${body.calendarType} calendar event.

IMPORTANT GUIDELINES:
- For personal/social events (like tennis): Strongly prefer weekend times and weeknight evenings over weekday midday
- For work events: Weekday midday times are fine
- Provide variety: Pick times on different days if possible
- Consider the activity type: "${updatedEventTemplate.title || updatedEventTemplate.intent}"
- Return ONLY a JSON array of 3 index numbers, e.g., [0, 5, 12]` },
          { role: 'user', content: `Select the best 3 alternative times from these ${slotOptions.length} options:

${slotOptions.map(opt => `${opt.index}: ${opt.formatted} (${opt.timeCategory})`).join('\n')}

Calendar type: ${body.calendarType}
Activity: ${updatedEventTemplate.title || updatedEventTemplate.intent}

Return only a JSON array of 3 index numbers for the best alternatives.` }
        ],
        response_format: { type: 'json_object' }
      });

      const selectionText = selectionCompletion.choices[0].message.content || '{"indices": [0, 1, 2]}';
      const selection = JSON.parse(selectionText);
      const selectedIndices = selection.indices || selection.indexes || [0, 1, 2];

      selectedAlternatives = selectedIndices
        .slice(0, 3)
        .filter((idx: number) => idx >= 0 && idx < slotOptions.length)
        .map((idx: number) => slotOptions[idx].formatted);

      console.log(`🤖 LLM selected alternative times: indices ${selectedIndices.join(', ')}`);
    }

    const alternativesContext = needsWiderSearch && selectedAlternatives.length > 0
      ? 'that week' // We widened the search
      : dateDesc; // Still showing within their requested range

    let message = `I checked, but ${requestedDesc} ${!needsWiderSearch && trueAvailableSlots.length === 0 ? 'has no availability' : 'conflicts with existing events'}. Here are your options:\n\n`;
    message += `**Keep original time:** ${currentTimeFormatted}\n\n`;

    if (fallbackTimeFormatted) {
      message += `**Override with conflict:** ${fallbackTimeFormatted} (⚠️ conflicts with existing events)\n\n`;
    }

    if (selectedAlternatives.length > 0) {
      message += `**Available alternatives${needsWiderSearch ? ` in ${alternativesContext}` : ` in ${dateDesc}`}:**\n`;
      selectedAlternatives.forEach((alt, i) => {
        message += `${i + 1}. ${alt}\n`;
      });
      message += `\nLet me know which option works best!`;
    } else {
      message += `Unfortunately, I couldn't find any other available times${needsWiderSearch ? ' in the next week' : ` in ${dateDesc}`}.`;
    }

    enqueueContent(controller, encoder, message);

    // DON'T close controller - let orchestrator handle it
    return { shouldReturnEarly: true };
  }

  // Get the current event time from cached result
  let currentEventTime: Date | null = null;
  if (cached?.eventResult?.startTime) {
    currentEventTime = new Date(cached.eventResult.startTime);
  }

  // Check if we found any slots that match the time preference
  let hasMatchingSlots = false;
  if (timePreference && candidateSlots.length > 0 && currentEventTime) {
    if (timePreference === 'earlier') {
      // Check if any candidate slots are earlier than current time
      hasMatchingSlots = candidateSlots.some(slot =>
        new Date(slot.start) < currentEventTime!
      );
    } else if (timePreference === 'later') {
      // Check if any candidate slots are later than current time
      hasMatchingSlots = candidateSlots.some(slot =>
        new Date(slot.start) > currentEventTime!
      );
    } else {
      // For specific times, we already have the slots filtered
      hasMatchingSlots = candidateSlots.length > 0;
    }
  } else if (candidateSlots.length > 0) {
    // No timePreference (e.g., "can we do next week on a weeknight?") - check if ANY slots exist
    hasMatchingSlots = true;
  }

  // If no matching slots found, return early with explanation
  if (!hasMatchingSlots) {
    console.log(`❌ No ${timePreference || 'available'} times found - returning early`);

    const _targetName = getTargetName(body.user2Name);
    const noChangeMessage = timePreference === 'earlier'
      ? `I checked, but there aren't any earlier times available that day. The current time works best for both of your schedules!`
      : timePreference === 'later'
      ? `I checked, but there aren't any later times available that day. The current time is the best option!`
      : timePreference === 'specific'
      ? `I checked, but that specific time isn't available. The current time works best for both schedules!`
      : `I checked, but there aren't any available times for that request. The current time works best for both of your schedules!`;

    enqueueContent(controller, encoder, noChangeMessage);

    // DON'T close controller - let orchestrator handle it
    return { shouldReturnEarly: true };
  }

  console.log(`✅ Found ${timePreference || 'available'} times - proceeding with modification`);
  return { shouldReturnEarly: false, hasMatchingSlots };
}
