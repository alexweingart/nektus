import type { OpenAIFunction, GenerateEventResult } from '@/types/ai-scheduling';
import type { TimeSlot, Event } from '@/types';
import type { Place } from '@/types/places';

export const generateEventFunction: OpenAIFunction = {
  name: 'generateEvent',
  description: 'Select optimal time slot and place for this event.',
  parameters: {
    type: 'object',
    properties: {
      selectedSlotIndex: {
        type: 'number',
        description: 'Index of chosen time slot from the candidate slots list (0-based)',
      },
      selectedPlaceIndex: {
        type: 'number',
        description: 'Index of chosen place from the places list (0-based, required for in-person events)',
      },
      calendarProvider: {
        type: 'string',
        enum: ['google', 'microsoft', 'apple'],
        description: 'Preferred calendar provider',
      },
    },
    required: ['selectedSlotIndex', 'calendarProvider'],
  },
};

export function processGenerateEventResult(
  args: string,
  candidateSlots: TimeSlot[],
  places: Place[],
  eventTemplate: Partial<Event>
): GenerateEventResult {
  try {
    const parsed = JSON.parse(args);

    console.log('🎯 LLM selected slot index:', parsed.selectedSlotIndex);
    console.log('🎯 LLM selected place index:', parsed.selectedPlaceIndex);

    // LLM picks from candidate slots
    const selectedSlot = candidateSlots[parsed.selectedSlotIndex || 0];

    if (!selectedSlot) {
      throw new Error('No selected slot available - this should not happen');
    }

    // Slot start is ALREADY the event start time (buffer is already accounted for in slot generation)
    const actualEventStart = new Date(selectedSlot.start);

    const actualEventEnd = new Date(actualEventStart);
    actualEventEnd.setMinutes(actualEventEnd.getMinutes() + (eventTemplate.duration || 60));

    console.log('⏰ Slot start:', selectedSlot.start);
    console.log('⏰ Actual event start:', actualEventStart.toISOString());
    console.log('⏰ Actual event end:', actualEventEnd.toISOString());

    const selectedPlace = places && places.length > 0
      ? places[parsed.selectedPlaceIndex || 0]
      : undefined;

    console.log('🏆 Selected place:', selectedPlace ? `${selectedPlace.name} - ${selectedPlace.address}` : 'None');

    return {
      title: eventTemplate.title || 'Event',
      description: eventTemplate.description || '',
      startTime: actualEventStart.toISOString(),
      endTime: actualEventEnd.toISOString(),
      duration: eventTemplate.duration || 60,
      place: selectedPlace,
      calendarUrl: '', // Will be generated in the main handler
      calendarProvider: parsed.calendarProvider,
    };
  } catch (_error) {
    console.error('Error parsing generateEvent result:', _error);
    throw new Error('Failed to parse event generation');
  }
}