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

/**
 * Construct requested time from event template
 * Used when user explicitly requests a specific time
 */
export function getRequestedTimeFromTemplate(
  template: Partial<Event> & { explicitTime?: string }
): string | null {
  const { preferredSchedulableDates, explicitTime } = template;

  if (!preferredSchedulableDates?.startDate || !explicitTime) {
    return null;
  }

  // Parse the explicit time (format: "12:00")
  const [hours, minutes] = explicitTime.split(':').map(Number);

  // Combine date and time
  const requestedDate = new Date(preferredSchedulableDates.startDate + 'T00:00:00');
  requestedDate.setHours(hours, minutes, 0, 0);

  return requestedDate.toISOString();
}

/**
 * Format time slot for display with smart day labels
 * Returns structured data for selective formatting in LLM prompts
 */
export function formatSlotTime(
  slot: TimeSlot,
  timezone: string
): {
  dayLabel: string;
  dateContext: string;
  time: string;
  isTomorrowOrToday: boolean;
} {
  const slotDate = new Date(slot.start);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Check if slot is today or tomorrow
  const slotDay = slotDate.toLocaleDateString('en-US', { timeZone: timezone });
  const todayDay = now.toLocaleDateString('en-US', { timeZone: timezone });
  const tomorrowDay = tomorrow.toLocaleDateString('en-US', { timeZone: timezone });

  const dayOfWeek = slotDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone });
  const monthDay = slotDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: timezone });
  const time = slotDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone });

  if (slotDay === todayDay) {
    return {
      dayLabel: 'Today',
      dateContext: `${dayOfWeek}, ${monthDay}`,
      time: time,
      isTomorrowOrToday: true
    };
  } else if (slotDay === tomorrowDay) {
    return {
      dayLabel: 'Tomorrow',
      dateContext: `${dayOfWeek}, ${monthDay}`,
      time: time,
      isTomorrowOrToday: true
    };
  } else {
    return {
      dayLabel: dayOfWeek,
      dateContext: monthDay,
      time: time,
      isTomorrowOrToday: false
    };
  }
}

/**
 * Format place data with explanations for LLM prompts
 * Converts km to miles and builds natural language explanations
 */
export function formatPlaceData(place: Place): {
  name: string;
  url: string;
  rating?: number;
  distance_miles?: number;
  price_level?: number;
  open_now?: boolean;
  description?: string;
  tips?: string[];
  explanations: string[];
} {
  const explanations: string[] = [];

  // Build natural language explanations based on place attributes
  if (place.rating && place.rating >= 4.5) {
    explanations.push('highly rated');
  } else if (place.rating && place.rating >= 4.0) {
    explanations.push('well-reviewed');
  }

  // Distance is already shown as a number - let the AI decide if proximity is worth mentioning
  // Removed automatic distance explanations to avoid biasing toward closer venues

  if (place.price_level === 1) {
    explanations.push('budget-friendly');
  } else if (place.price_level && place.price_level >= 3) {
    explanations.push('upscale option');
  }

  if (place.opening_hours?.open_now === false) {
    explanations.push('currently closed');
  }

  // Convert km to miles for display
  const distance_miles = place.distance_from_midpoint_km !== undefined
    ? place.distance_from_midpoint_km / 1.609
    : undefined;

  return {
    name: place.name,
    url: place.google_maps_url,
    rating: place.rating,
    distance_miles: distance_miles,
    price_level: place.price_level,
    open_now: place.opening_hours?.open_now,
    description: place.description,
    tips: place.tips,
    explanations: explanations
  };
}

/**
 * Enrich place URLs in LLM-generated message with actual Google Place IDs
 * Replaces search URLs with direct place URLs for better user experience
 */
export async function enrichPlaceUrls(
  message: string,
  places: Place[]
): Promise<string> {
  if (!message || !places || places.length === 0) {
    return message;
  }

  const { getGooglePlaceIds } = await import('@/lib/server/places/google');
  const { generateGoogleMapsUrl } = await import('@/lib/server/location/location');

  // Extract place names from markdown links in the message
  // Format: [Place Name](URL)
  const placeLinksRegex = /\[([^\]]+)\]\(https:\/\/www\.google\.com\/maps\/search\/[^\)]+\)/g;
  const mentionedPlaceNames = new Set<string>();
  let match;
  while ((match = placeLinksRegex.exec(message)) !== null) {
    mentionedPlaceNames.add(match[1]); // Extract place name from [Place Name](URL)
  }

  // Find Place objects for mentioned places
  const placesToEnrich = places.filter(p =>
    Array.from(mentionedPlaceNames).some(name =>
      p.name.includes(name) || name.includes(p.name)
    )
  );

  if (placesToEnrich.length === 0) {
    return message;
  }

  // Get Google Place IDs for mentioned places
  const placeIdMap = await getGooglePlaceIds(
    placesToEnrich.map(p => ({ name: p.name, coordinates: p.coordinates }))
  );

  // Update places with Google Place IDs and regenerate URLs
  let updatedMessage = message;
  placesToEnrich.forEach(place => {
    const googlePlaceId = placeIdMap.get(place.name);
    if (googlePlaceId) {
      place.google_place_id = googlePlaceId;
      const enrichedUrl = generateGoogleMapsUrl(
        place.coordinates,
        place.name,
        googlePlaceId
      );
      place.google_maps_url = enrichedUrl;

      // Replace the old URL in the message
      // Find the markdown link with this place name and replace its URL
      const linkRegex = new RegExp(`(\\[${place.name}\\])\\(https:\\/\\/www\\.google\\.com\\/maps\\/search\\/[^\\)]+\\)`, 'g');
      updatedMessage = updatedMessage.replace(linkRegex, `$1(${enrichedUrl})`);
    }
  });

  return updatedMessage;
}
