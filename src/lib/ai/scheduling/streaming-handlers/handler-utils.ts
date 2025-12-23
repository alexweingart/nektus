import type { AISchedulingRequest } from '@/types/ai-scheduling';
import type { Event, CalendarUrls, TimeSlot, SchedulableHours } from '@/types';
import type { Place } from '@/types/places';

/**
 * Get target name for messaging
 */
export function getTargetName(user2Name: string | undefined): string {
  return user2Name || 'them';
}

/**
 * Build final event object with all required fields
 * Used by AI scheduling to construct the complete Event object
 */
export function buildFinalEvent(
  body: AISchedulingRequest,
  eventResult: { title: string; startTime: string; endTime: string; place?: Place },
  template: Partial<Event>,
  description: string,
  location: string,
  urls: CalendarUrls
): Event {
  const finalEvent: Event = {
    id: `temp-${Date.now()}`,
    organizerId: body.user1Id,
    attendeeId: body.user2Id,
    title: eventResult.title,
    description: description,
    duration: template.duration || 60,
    eventType: template.eventType || 'video',
    intent: template.intent || 'custom',
    startTime: new Date(eventResult.startTime),
    endTime: new Date(eventResult.endTime),
    location: location,
    travelBuffer: template.travelBuffer,
    calendar_urls: {
      google: urls.google,
      outlook: urls.outlook,
      apple: urls.apple,
    },
    status: 'template',
    createdAt: new Date(),
    updatedAt: new Date(),
    preferredPlaces: eventResult.place ? [eventResult.place] : undefined,
  };

  return finalEvent;
}

/**
 * Build time selection prompt to help AI choose best time
 */
export function buildTimeSelectionPrompt(
  slots: TimeSlot[],
  places: Place[],
  template: Partial<Event>,
  calendarType: string,
  timezone: string,
  noCommonTime: boolean
): string {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  let prompt = `\n\n## Available Time Slots (${calendarType} calendar, timezone: ${timezone})\n\n`;

  if (noCommonTime || slots.length === 0) {
    prompt += '\n⚠️ No available time slots found. Both users may need to add calendars or expand their schedulable hours.\n';
    return prompt;
  }

  // Group slots by day for better readability
  const slotsByDay: Record<string, TimeSlot[]> = {};

  slots.forEach(slot => {
    const slotDate = new Date(slot.start);
    const dayKey = slotDate.toISOString().split('T')[0]; // YYYY-MM-DD
    if (!slotsByDay[dayKey]) {
      slotsByDay[dayKey] = [];
    }
    slotsByDay[dayKey].push(slot);
  });

  // Display first 14 days with slots
  const sortedDays = Object.keys(slotsByDay).sort().slice(0, 14);

  sortedDays.forEach(dayKey => {
    const slotsForDay = slotsByDay[dayKey];
    const firstSlot = new Date(slotsForDay[0].start);
    const dayName = dayNames[firstSlot.getDay()];
    const dateStr = firstSlot.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: timezone });

    prompt += `\n**${dayName}, ${dateStr}:**\n`;

    slotsForDay.slice(0, 48).forEach(slot => {
      const start = new Date(slot.start);
      const end = new Date(slot.end);
      const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone });
      const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone });
      prompt += `- ${startTime} - ${endTime}\n`;
    });
  });

  // Add places information if available
  if (places && places.length > 0) {
    prompt += `\n\n## Suggested Places\n\n`;
    places.slice(0, 5).forEach((place, idx) => {
      prompt += `${idx + 1}. ${place.name}${place.address ? ` - ${place.address}` : ''}\n`;
    });
  }

  return prompt;
}

/**
 * Determine which alternatives to show based on user constraints and validity
 *
 * Logic:
 * - If time is invalid (conflict): ALWAYS show time alternatives + warning
 * - If both date/time AND place constrained + valid: show nothing
 * - If date/time constrained + valid: show place alternatives
 * - If place constrained + valid: show time alternatives
 * - If neither constrained: show place alternatives (default)
 */
export function determineAlternativesToShow(
  template: Partial<Event> & {
    preferredSchedulableDates?: { startDate: string; endDate: string; description?: string };
    preferredSchedulableHours?: Partial<SchedulableHours>;
    hasExplicitTimeRequest?: boolean;
    intentSpecificity?: string;
    intent?: string;
  },
  hasValidTime: boolean,
  editResult?: {
    timePreference?: 'earlier' | 'later' | 'specific';
    newPlaceType?: string;
    newPlaceIndex?: number;
  }
): {
  showAlternativePlaces: boolean;
  showAlternativeTimes: boolean;
  includeConflictWarning: boolean;
  reason: string;
} {
  // Detect date/time constraints (EXPLICIT ONLY - user actually specified a time)
  // Don't count preferredSchedulableHours (implicit from activity type like "dinner")
  const hasDateTimeConstraint = !!(
    template.preferredSchedulableDates ||
    template.hasExplicitTimeRequest ||
    editResult?.timePreference
  );

  // Detect place constraints (NARROW - only explicit venue requests)
  const hasPlaceConstraint = !!(
    template.intentSpecificity === 'specific_place' ||
    editResult?.newPlaceType ||
    editResult?.newPlaceIndex ||
    (template.intent && /at .+? (park|cafe|restaurant|gym|court)/i.test(template.intent) && !/at a /i.test(template.intent))
  );

  // Rule 1: If time is invalid (conflict), ALWAYS show time alternatives + warning
  if (!hasValidTime) {
    return {
      showAlternativePlaces: false,
      showAlternativeTimes: true,
      includeConflictWarning: true,
      reason: 'conflict-show-time-alternatives'
    };
  }

  // Rule 2: Both date/time AND place specified + valid → show nothing
  if (hasDateTimeConstraint && hasPlaceConstraint) {
    return {
      showAlternativePlaces: false,
      showAlternativeTimes: false,
      includeConflictWarning: false,
      reason: 'both-specified-valid'
    };
  }

  // Rule 3: Date/time specified + valid → show place alternatives
  if (hasDateTimeConstraint) {
    return {
      showAlternativePlaces: true,
      showAlternativeTimes: false,
      includeConflictWarning: false,
      reason: 'time-fixed-show-places'
    };
  }

  // Rule 4: Place specified + valid → show time alternatives
  if (hasPlaceConstraint) {
    return {
      showAlternativePlaces: false,
      showAlternativeTimes: true,
      includeConflictWarning: false,
      reason: 'place-fixed-show-times'
    };
  }

  // Rule 5: Default (neither specified) → show place alternatives
  return {
    showAlternativePlaces: true,
    showAlternativeTimes: false,
    includeConflictWarning: false,
    reason: 'default-show-places'
  };
}
