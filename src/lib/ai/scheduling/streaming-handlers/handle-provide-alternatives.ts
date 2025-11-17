import { createCompletion, getModelForTask, getReasoningEffortForTask } from '@/lib/ai/scheduling/openai-client';
import { ALTERNATIVE_SELECTION_SYSTEM_PROMPT, buildContextMessage } from '@/lib/ai/system-prompts';
import { buildAlternativesFormattingInstructions } from './orchestrator';
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
 * Stage 5 handler for when requested time is unavailable.
 * Provides alternatives instead of creating an event.
 *
 * Called when:
 * - Explicit time request with no availability (hasExplicitTimeRequest=true AND hasNoCommonTime=true)
 * - Conditional edit with no matching times (isConditional=true AND hasNoCommonTime=true)
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
  console.log('🔄 Providing alternatives (requested time unavailable)');

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
  const selectedAlternatives: string[] = [];
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

    // Build context message (standard pattern)
    const contextMessage = buildContextMessage({
      calendarType: body.calendarType,
      availableTimeSlots: trueAvailableSlots,
      user1Location: body.user1Location,
      user2Location: body.user2Location,
    });

    // Build selection prompt with formatted options (standard pattern)
    const selectionPrompt = `## Available Time Slot Options (timezone: ${timezone})

${slotOptions.map(opt => `${opt.index}: ${opt.formatted} (${opt.dayOfWeek}, ${opt.timeCategory})`).join('\n')}

Total options: ${slotOptions.length}`;

    // Build formatting instructions with exact strings
    const alternativesContext = needsWiderSearch ? 'that week' : dateDesc;
    const reason: 'conflicts' | 'no_availability' =
      !needsWiderSearch && trueAvailableSlots.length === 0 ? 'no_availability' : 'conflicts';

    const allFormattedStrings = slotOptions.map(opt => opt.formatted);

    const formattingInstructions = buildAlternativesFormattingInstructions(
      currentTimeFormatted,
      allFormattedStrings,
      requestedDesc,
      reason,
      !!needsWiderSearch,
      alternativesContext
    );

    // LLM call following standard Stage 5 pattern
    const selectionCompletion = await createCompletion({
      model: getModelForTask('event'),
      reasoning_effort: getReasoningEffortForTask('event'),
      verbosity: 'low',
      messages: [
        { role: 'system', content: ALTERNATIVE_SELECTION_SYSTEM_PROMPT },
        { role: 'system', content: contextMessage },
        { role: 'system', content: selectionPrompt },
        { role: 'system', content: formattingInstructions },
        { role: 'user', content: `Select the best 3 alternative times for: ${template.title || template.intent}` }
      ],
      response_format: { type: 'json_object' }
    });

    const selectionText = selectionCompletion.choices[0].message.content || '{"indices": [0, 1, 2], "message": ""}';
    const selection = JSON.parse(selectionText);
    const selectedIndices = selection.indices || selection.indexes || [0, 1, 2];
    const llmMessage = selection.message || '';

    console.log(`🤖 LLM selected alternative times: indices ${selectedIndices.join(', ')}`);

    // Stream LLM-generated message
    enqueueContent(controller, encoder, llmMessage);
    console.log('✅ Alternatives provided successfully');
    return;
  }

  // Fallback: If no alternatives found at all, send simple message
  const fallbackMessage = `I checked, but ${requestedDesc} ${!needsWiderSearch && trueAvailableSlots.length === 0 ? 'has no availability' : 'conflicts with existing events'}. Unfortunately, I couldn't find any alternative times${needsWiderSearch ? ' in the next week' : ` in ${dateDesc}`}.

Would you like to try a different time range or keep the original time?`;

  enqueueContent(controller, encoder, fallbackMessage);
  console.log('✅ No alternatives available - fallback message sent');
}
