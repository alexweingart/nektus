import { createCompletion, getModelForTask, getReasoningEffortForTask } from '@/lib/ai/scheduling/openai-client';
import { getAllValidSlots } from '@/lib/events/scheduling-utils';
import { DAYS_TO_MS, formatEventTimeComponents } from '@/lib/events/time-utils';
import { enqueueContent } from './streaming-utils';
import type { AISchedulingRequest } from '@/types/ai-scheduling';
import type { TimeSlot, Event } from '@/types';

interface ProvideAlternativesParams {
  availableTimeSlots: TimeSlot[];
  template: Partial<Event>;
  currentEventTime: string; // ISO string of current event start time
  body: AISchedulingRequest;
  controller: ReadableStreamDefaultController;
  encoder: TextEncoder;
  timezone: string;
}

/**
 * Stage 5 handler for conditional edits when no matching times found.
 * Provides alternatives instead of creating an event.
 *
 * Called when: isConditional=true AND hasNoCommonTime=true
 */
export async function handleProvideAlternatives({
  availableTimeSlots,
  template,
  currentEventTime,
  body,
  controller,
  encoder,
  timezone,
}: ProvideAlternativesParams): Promise<void> {
  console.log('🔄 Providing alternatives for conditional edit (no matching times found)');

  // Get ONLY truly available slots (no fallback)
  let trueAvailableSlots = getAllValidSlots(
    availableTimeSlots,
    {
      duration: template.duration || 60,
      preferredSchedulableDates: template.preferredSchedulableDates,
      travelBuffer: template.travelBuffer,
      // NO schedulable hours constraint - get ALL times in date range
    }
  );

  // If no slots found with their date constraint, widen to show alternatives from broader date range
  const needsWiderSearch = trueAvailableSlots.length === 0 && template.preferredSchedulableDates;
  if (needsWiderSearch && template.preferredSchedulableDates) {
    console.log(`📅 No slots in ${template.preferredSchedulableDates.description}, widening search to full week`);

    const originalStart = new Date(template.preferredSchedulableDates.startDate);
    const originalEnd = new Date(template.preferredSchedulableDates.endDate);

    // Extend to cover at least 7 days from the original start
    const widerEnd = new Date(Math.max(originalEnd.getTime(), originalStart.getTime() + DAYS_TO_MS(7)));

    trueAvailableSlots = getAllValidSlots(
      availableTimeSlots,
      {
        duration: template.duration || 60,
        preferredSchedulableDates: {
          startDate: template.preferredSchedulableDates.startDate,
          endDate: widerEnd.toISOString().split('T')[0],
          description: 'that week'
        },
        travelBuffer: template.travelBuffer,
      }
    );
  }

  // Format times for display
  const formatTimeOption = (slot: TimeSlot) => {
    const slotStart = new Date(slot.start);
    return formatEventTimeComponents(slotStart, timezone).formatted;
  };

  const currentEventStart = new Date(currentEventTime);
  const currentTimeFormatted = formatTimeOption({ start: currentEventStart.toISOString(), end: '' });

  // Build descriptive message about what was requested
  const dateDesc = template.preferredSchedulableDates?.description || 'that time range';
  const hasTimeConstraint = template.preferredSchedulableHours &&
    Object.keys(template.preferredSchedulableHours).length > 0;

  let requestedDesc = dateDesc;
  if (hasTimeConstraint) {
    const days = Object.keys(template.preferredSchedulableHours!);
    if (days.length === 5 && days.includes('monday') && days.includes('friday')) {
      requestedDesc = `weeknight evenings ${dateDesc}`;
    } else if (days.length >= 1) {
      requestedDesc = `${dateDesc} during the requested hours`;
    }
  }

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
- Consider the activity type: "${template.title || template.intent}"
- Return ONLY a JSON array of 3 index numbers, e.g., [0, 5, 12]` },
        { role: 'user', content: `Select the best 3 alternative times from these ${slotOptions.length} options:

${slotOptions.map(opt => `${opt.index}: ${opt.formatted} (${opt.timeCategory})`).join('\n')}

Calendar type: ${body.calendarType}
Activity: ${template.title || template.intent}

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
    ? 'that week'
    : dateDesc;

  // Build message with current time, and alternatives
  let message = `I checked, but ${requestedDesc} ${!needsWiderSearch && trueAvailableSlots.length === 0 ? 'has no availability' : 'conflicts with existing events'}. Here are your options:\n\n`;
  message += `**Keep original time:** ${currentTimeFormatted}\n\n`;

  if (selectedAlternatives.length > 0) {
    message += `**Available alternatives${needsWiderSearch ? ` in ${alternativesContext}` : ` in ${dateDesc}`}:**\n`;
    selectedAlternatives.forEach((alt, i) => {
      message += `${i + 1}. ${alt}\n`;
    });
    message += `\nLet me know which option works best!`;
  } else {
    message += `Unfortunately, I couldn't find any other available times${needsWiderSearch ? ' in the next week' : ` in ${dateDesc}`}.`;
  }

  // Stream message only (no event creation)
  enqueueContent(controller, encoder, message);
  console.log('✅ Alternatives provided successfully');
}
