import type { OpenAIFunction, GenerateEventResult } from '@/types/ai-scheduling';
import type { TimeSlot, Event } from '@/types';
import type { Place } from '@/types/places';

export const generateEventFunction: OpenAIFunction = {
  name: 'generateEvent',
  description: 'Select optimal time/place and rank alternatives for this event.',
  parameters: {
    type: 'object',
    properties: {
      rankedSlotIndices: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of 4 time slot indices [best, alt1, alt2, alt3] from candidate slots (0-based). All indices must be distinct.',
      },
      rankedPlaceIndices: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of 4 place indices [best, alt1, alt2, alt3] (0-based, for in-person events only). All indices must be distinct. Alternative places should prefer those open at selected time when possible.',
      },
      calendarProvider: {
        type: 'string',
        enum: ['google', 'microsoft', 'apple'],
        description: 'Preferred calendar provider',
      },
    },
    required: ['rankedSlotIndices', 'calendarProvider'],
  },
};

export function processGenerateEventResult(
  args: string,
  candidateSlots: TimeSlot[],
  places: Place[],
  eventTemplate: Partial<Event>
): GenerateEventResult & { rankedSlotIndices: number[], rankedPlaceIndices: number[] } {
  try {
    const parsed = JSON.parse(args);

    // Extract best choices from ranked arrays (index 0 is the best)
    const rankedSlotIndices = parsed.rankedSlotIndices || [0, 1, 2, 3];
    const rankedPlaceIndices = parsed.rankedPlaceIndices || [0, 1, 2, 3];

    const selectedSlotIndex = rankedSlotIndices[0];
    const selectedPlaceIndex = rankedPlaceIndices[0];

    console.log('🎯 LLM ranked slot indices:', rankedSlotIndices);
    console.log('🎯 LLM ranked place indices:', rankedPlaceIndices);
    console.log('🏆 Selected slot index (best):', selectedSlotIndex);
    console.log('🏆 Selected place index (best):', selectedPlaceIndex);

    // LLM picks from candidate slots
    const selectedSlot = candidateSlots[selectedSlotIndex];

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
      ? places[selectedPlaceIndex]
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
      rankedSlotIndices,
      rankedPlaceIndices,
    };
  } catch (_error) {
    console.error('Error parsing generateEvent result:', _error);
    throw new Error('Failed to parse event generation');
  }
}