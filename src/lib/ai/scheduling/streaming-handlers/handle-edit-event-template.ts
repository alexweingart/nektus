import { processEditEventTemplateResult } from '@/lib/ai/functions/edit-event-template';
import { searchPlaces } from '@/lib/ai/helpers/search-places';
import { applyDefaultTravelBuffer } from '@/lib/events/event-utils';
import { timeToMinutes, minutesToTime } from '@/lib/events/time-utils';
import { processingStateManager } from '@/lib/services/server/aiProcessingService';
import type { OpenAIToolCall, AISchedulingRequest } from '@/types/ai-scheduling';
import type { Event, TimeSlot } from '@/types';
import type { Place } from '@/types/places';
import type { TemplateHandlerResult } from './types';

export async function handleEditEventTemplate(
  toolCall: OpenAIToolCall,
  body: AISchedulingRequest
): Promise<TemplateHandlerResult> {
  console.log('✏️ Handling event edit template...');

  const editResult = processEditEventTemplateResult(toolCall.function.arguments);
  console.log('📝 Edit request:', editResult);

  // Try to get cached places and event template
  const cacheKey = `places:${body.user1Id}:${body.user2Id}`;
  const cached = await processingStateManager.getCached<{
    places?: Place[];
    eventTemplate?: Partial<Event>;
    eventResult?: {
      startTime: string;
      endTime: string;
      place?: Place;
    };
  }>(cacheKey);

  let places: Place[] = [];
  let eventTemplate: Partial<Event> | null = null;
  let previousEvent = cached?.eventResult;

  if (cached && cached.eventTemplate) {
    places = cached.places || [];
    eventTemplate = cached.eventTemplate;
    console.log(`✅ Using cached event template and ${places.length} places`);
  } else {
    console.log('⚠️ No cached data found - this edit might be slow');
    throw new Error(
      `Cannot edit event: No cached event template found for users ${body.user1Id} and ${body.user2Id}. ` +
      `Please create a new event instead of editing.`
    );
  }

  // Apply edits to the event template
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

  // Track whether we need to search for new places
  let needsPlaceSearch = false;
  let placeSearchParams;

  // If user wants a different TYPE of place, search for new venues
  if (editResult.newPlaceType) {
    console.log(`🔍 User requested different venue type: "${editResult.newPlaceType}" - will search in Stage 4`);
    needsPlaceSearch = true;
    placeSearchParams = {
      intentSpecificity: 'activity_type' as const,
      activitySearchQuery: editResult.newPlaceType,
      suggestedPlaceTypes: [editResult.newPlaceType],
    };
    // Clear cached places since we'll be searching for new ones
    places = [];
  }

  // Apply default travel buffer
  const updatedEventTemplate = applyDefaultTravelBuffer(eventTemplate);

  return {
    template: updatedEventTemplate,
    mode: 'edit',
    isConditional: editResult.isConditional,
    timePreference: editResult.timePreference,
    previousEvent: previousEvent ? {
      startTime: previousEvent.startTime,
      endTime: previousEvent.endTime,
      place: previousEvent.place,
    } : undefined,
    cachedPlaces: places.length > 0 ? places : undefined,
    needsPlaceSearch,
    placeSearchParams,
  };
}
