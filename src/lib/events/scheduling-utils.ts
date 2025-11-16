import { TimeSlot, SchedulableHours, Event, SchedulingParams } from '@/types';
import { getEventTemplate } from './event-templates';
import { timeToMinutes, parseTimeString, getDayOfWeek } from './time-utils';

export interface SuggestedTimes {
  [chipId: string]: { start: string; end: string } | null;
}

// Utility functions for middle-time slot selection

/**
 * Calculate the center time of a schedulable window in minutes from midnight
 * @param preferredSchedulableHours - The schedulable hours for a day
 * @param date - The date to check (for day of week)
 * @returns Center time in minutes from midnight, or null if no hours available
 */
function calculateSchedulableWindowCenter(
  preferredSchedulableHours: SchedulableHours,
  date: Date
): number | null {
  const dayOfWeek = getDayOfWeek(date);
  const daySchedule = preferredSchedulableHours[dayOfWeek];

  if (!daySchedule || daySchedule.length === 0) {
    return null;
  }

  const timeWindow = daySchedule[0];
  const startMinutes = timeToMinutes(timeWindow.start);
  const endMinutes = timeToMinutes(timeWindow.end);

  return Math.floor((startMinutes + endMinutes) / 2);
}

/**
 * Calculate how far a time slot's midpoint is from the window center
 * @param slot - The time slot to evaluate (includes travel buffers)
 * @param windowCenterMinutes - Center of schedulable window in minutes from midnight
 * @param eventDuration - Duration of the event in minutes (without buffers)
 * @returns Distance in minutes from center
 */
function calculateSlotDistanceFromCenter(
  slot: TimeSlot,
  windowCenterMinutes: number,
  eventDuration: number
): number {
  const slotStart = new Date(slot.start);
  const slotStartMinutes = slotStart.getHours() * 60 + slotStart.getMinutes();

  // The slot.start is the EVENT start time (not the buffer start time)
  // Calculate the midpoint of the actual event
  const eventMidpointMinutes = slotStartMinutes + (eventDuration / 2);

  return Math.abs(eventMidpointMinutes - windowCenterMinutes);
}

/**
 * Select the optimal time slot closest to the window center
 * @param validSlots - Array of valid time slots
 * @param windowCenterMinutes - Center of schedulable window in minutes from midnight
 * @param eventDuration - Duration of the event in minutes (without buffers)
 * @returns Best time slot (closest to center, earlier if tied)
 */
function selectOptimalTimeSlot(
  validSlots: TimeSlot[],
  windowCenterMinutes: number,
  eventDuration: number
): TimeSlot | null {
  if (validSlots.length === 0) return null;
  if (validSlots.length === 1) return validSlots[0];

  // Calculate distances and sort by distance, then by time for tie-breaking
  const slotsWithDistance = validSlots.map(slot => ({
    slot,
    distance: calculateSlotDistanceFromCenter(slot, windowCenterMinutes, eventDuration),
    startTime: new Date(slot.start).getTime()
  }));

  // Sort by distance first, then by start time (earlier wins ties)
  slotsWithDistance.sort((a, b) => {
    if (a.distance !== b.distance) {
      return a.distance - b.distance; // Closer to center wins
    }
    return a.startTime - b.startTime; // Earlier time wins ties
  });

  return slotsWithDistance[0].slot;
}

// Helper to load event template (static or dynamic)
function getTemplateConfig(templateId: string, dynamicTemplate?: Event): Event | null {
  // Check if this is a dynamic template (runtime-provided event config)
  if (dynamicTemplate && templateId === dynamicTemplate.id) {
    return dynamicTemplate;
  }

  // Load static template from event-templates.ts
  return getEventTemplate(templateId) || null;
}

// Helper to get date range from preferred dates or use default (tomorrow + 14 days)
function getDateRange(preferredSchedulableDates?: {
  startDate: string;
  endDate: string;
}): { startDate: Date; endDate: Date } {
  if (preferredSchedulableDates?.startDate && preferredSchedulableDates?.endDate) {
    const startDate = new Date(preferredSchedulableDates.startDate + 'T00:00:00');
    const endDate = new Date(preferredSchedulableDates.endDate + 'T23:59:59');

    // Validate dates
    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      return { startDate, endDate };
    }
  }

  // Fallback to tomorrow + 14 days
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 14);

  return { startDate, endDate };
}

// Helper to check if slot time is within schedulable hours
function isSlotWithinSchedulableHours(
  slotTime: Date,
  preferredSchedulableHours: SchedulableHours,
  eventDurationOnly: number,
  beforeBuffer: number = 0,
  afterBuffer: number = 0
): boolean {
  const hour = slotTime.getHours();
  const minute = slotTime.getMinutes();
  const dayOfWeek = getDayOfWeek(slotTime);
  const timeInMinutes = hour * 60 + minute;

  const daySchedule = preferredSchedulableHours[dayOfWeek];

  if (!daySchedule || daySchedule.length === 0) {
    return false;
  }

  for (const timeWindow of daySchedule) {
    const startWindow = timeToMinutes(timeWindow.start);
    const endWindow = timeToMinutes(timeWindow.end);

    // If start === end, this is an explicit time request (e.g., "Thursday at 10am")
    // Just check if the slot's start time matches (within a small window for 30-min slots)
    if (startWindow === endWindow) {
      // Allow slots that start within 30 minutes of the explicit time
      if (Math.abs(timeInMinutes - startWindow) < 30) {
        return true;
      }
    } else {
      // Normal time window - entire block (before buffer + event + after buffer) must fit within window
      // slotTime represents when free time starts, so the entire block runs from
      // slotTime to slotTime + beforeBuffer + duration + afterBuffer
      const blockStartMinutes = timeInMinutes;
      const blockEndMinutes = timeInMinutes + beforeBuffer + eventDurationOnly + afterBuffer;

      if (blockStartMinutes >= startWindow && blockEndMinutes <= endWindow) {
        return true;
      }
    }
  }

  return false;
}

// Process common slots into suggested times for specific event templates
export function processCommonSlots(
  commonSlots: TimeSlot[],
  eventTemplateIds: string[],
  dynamicTemplate?: Event
): SuggestedTimes {
  const times: SuggestedTimes = {};

  for (const templateId of eventTemplateIds) {
    const eventTemplate = getTemplateConfig(templateId, dynamicTemplate);

    if (!eventTemplate) {
      times[templateId] = null;
      continue;
    }

    // Get all valid candidate slots using shared logic
    const validSlots = getAllValidSlots(commonSlots, eventTemplate);

    // Select best slot based on preferences
    if (validSlots.length === 0) {
      times[templateId] = null;
    } else if (eventTemplate.preferMiddleTimeSlot && eventTemplate.preferredSchedulableHours) {
      // Middle-time optimization: find earliest date, then select slot closest to center on that day

      // Get the earliest date with valid slots
      const firstSlot = validSlots[0];
      const earliestDate = new Date(firstSlot.start);
      earliestDate.setHours(0, 0, 0, 0); // Normalize to start of day

      // Filter to only slots on the earliest date
      const slotsOnEarliestDate = validSlots.filter(slot => {
        const slotDate = new Date(slot.start);
        slotDate.setHours(0, 0, 0, 0);
        return slotDate.getTime() === earliestDate.getTime();
      });

      const windowCenter = calculateSchedulableWindowCenter(eventTemplate.preferredSchedulableHours, earliestDate);

      if (windowCenter !== null && slotsOnEarliestDate.length > 0) {
        const eventDurationOnly = eventTemplate.duration;
        const selectedSlot = selectOptimalTimeSlot(slotsOnEarliestDate, windowCenter, eventDurationOnly);

        times[templateId] = selectedSlot;
      } else {
        // Fallback to first slot if window center calculation fails
        times[templateId] = validSlots[0];
      }
    } else {
      // First-available logic: use earliest valid slot
      times[templateId] = validSlots[0];
    }
  }

  return times;
}

// Main function to get suggested times with smart pre-fetch handling
export async function getSuggestedTimes(
  params: SchedulingParams,
  firebaseUser: { getIdToken: () => Promise<string> } | null
): Promise<SuggestedTimes> {
  const { user1Id, user2Id, calendarType, eventTemplateIds, preFetchData } = params;


  // 1. Use pre-fetch data if available and valid
  if (preFetchData &&
      preFetchData.user1Id === user1Id &&
      preFetchData.user2Id === user2Id &&
      preFetchData.calendarType === calendarType &&
      preFetchData.commonSlots.length > 0) {

    return processCommonSlots(preFetchData.commonSlots, eventTemplateIds, params.dynamicTemplate);
  }

  // 2. If pre-fetch is in progress, we could wait briefly or proceed with fresh call
  // For now, we'll proceed with fresh call to ensure users don't wait
  // 3. Make fresh call to combined-common-times

  try {
    if (!firebaseUser) throw new Error('No authenticated user');
    const idToken = await firebaseUser.getIdToken();

    const response = await fetch('/api/scheduling/common-times', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        user1Id,
        user2Id,
        duration: 30, // Use minimum duration for maximum flexibility
        calendarType,
      }),
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }

    const data = await response.json();

    return processCommonSlots(data.slots || [], eventTemplateIds, params.dynamicTemplate);

  } catch (error) {
    console.error('❌ Error in getSuggestedTimes:', error);
    // Return empty results on error
    const errorResult: SuggestedTimes = {};
    eventTemplateIds.forEach(id => {
      errorResult[id] = null;
    });
    return errorResult;
  }
}

/**
 * Get ALL valid candidate time slots for an event (not just the first one)
 * This is used by the LLM to pick the best time from multiple options
 */
export function getAllValidSlots(
  commonSlots: TimeSlot[],
  eventTemplate: {
    duration: number;
    preferredSchedulableHours?: SchedulableHours;
    preferredSchedulableDates?: {
      startDate: string; // YYYY-MM-DD format
      endDate: string;   // YYYY-MM-DD format
      description?: string;
    };
    travelBuffer?: { beforeMinutes: number; afterMinutes: number };
  }
): TimeSlot[] {
  // Sort slots by start time
  const sortedSlots = [...commonSlots].sort((a, b) =>
    new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  const eventDurationOnly = eventTemplate.duration;
  const beforeBuffer = eventTemplate.travelBuffer?.beforeMinutes || 0;
  const afterBuffer = eventTemplate.travelBuffer?.afterMinutes || 0;

  let filteredSlots = sortedSlots;
  if (eventTemplate.preferredSchedulableDates) {
    const { startDate, endDate } = getDateRange(eventTemplate.preferredSchedulableDates);

    filteredSlots = sortedSlots.filter(slot => {
      const slotDate = new Date(slot.start);
      return slotDate >= startDate && slotDate <= endDate;
    });
  }

  const validSlots: TimeSlot[] = [];
  let slotsPassedHoursCheck = 0;
  let slotsFailedConsecutiveCheck = 0;

  for (let i = 0; i < filteredSlots.length; i++) {
    const startSlot = filteredSlots[i];
    const slotTime = new Date(startSlot.start);
    const slotEndTime = new Date(startSlot.end);

    // Only check schedulable hours if there are actual constraints
    if (eventTemplate.preferredSchedulableHours && Object.keys(eventTemplate.preferredSchedulableHours).length > 0) {
      const isValid = isSlotWithinSchedulableHours(
        slotTime,
        eventTemplate.preferredSchedulableHours,
        eventDurationOnly,
        beforeBuffer,
        afterBuffer
      );
      if (!isValid) {
        continue;
      }
    }

    slotsPassedHoursCheck++;

    // When there's a before buffer, we need to check if there's enough consecutive free time
    // The slot at index i represents when FREE TIME starts
    // We need to verify there's continuous free time to fit: beforeBuffer + event + afterBuffer
    // The event itself will start at (slotTime + beforeBuffer)

    let consecutiveStartTime: Date | null = null;
    let consecutiveEndTime: Date | null = null;

    // The free time must start at the slot time (or earlier) and extend through all buffers + event
    const requiredStartTime = new Date(slotTime.getTime());
    const requiredEndTime = new Date(slotTime.getTime() + (beforeBuffer + eventDurationOnly + afterBuffer) * 60 * 1000);

    // Find all consecutive slots that cover the required time range
    // Start looking backwards from current slot to find where consecutive time begins
    let startIndex = i;
    for (let k = i - 1; k >= 0; k--) {
      const prevSlot = filteredSlots[k];
      const prevEnd = new Date(prevSlot.end);
      const currentStart = new Date(filteredSlots[startIndex].start);

      // Check if this slot is consecutive with the next one
      if (prevEnd.getTime() === currentStart.getTime()) {
        startIndex = k;
      } else {
        break; // Gap found, stop looking backwards
      }
    }

    // Now build forward from startIndex to see if we have enough consecutive time
    consecutiveStartTime = new Date(filteredSlots[startIndex].start);
    consecutiveEndTime = new Date(filteredSlots[startIndex].end);

    let j = startIndex + 1;
    while (j < filteredSlots.length) {
      const nextSlot = filteredSlots[j];
      const nextStart = new Date(nextSlot.start);

      // Check if slots are consecutive (no gap)
      if (nextStart.getTime() === consecutiveEndTime.getTime()) {
        consecutiveEndTime = new Date(nextSlot.end);
        j++;
      } else {
        break; // Gap found
      }
    }

    // Verify that the consecutive block starts early enough and ends late enough
    const coversRequiredStart = consecutiveStartTime.getTime() <= requiredStartTime.getTime();
    const coversRequiredEnd = consecutiveEndTime.getTime() >= requiredEndTime.getTime();

    if (!coversRequiredStart || !coversRequiredEnd) {
      slotsFailedConsecutiveCheck++;
      continue;
    }

    // Calculate the actual event start time (after the before buffer)
    const eventStartTime = new Date(slotTime.getTime() + beforeBuffer * 60 * 1000);
    const eventEndTime = new Date(eventStartTime.getTime() + eventDurationOnly * 60 * 1000);

    validSlots.push({
      start: eventStartTime.toISOString(),
      end: eventEndTime.toISOString()
    });
  }

  return validSlots;
}

/**
 * Get candidate slots with automatic fallback if no common time found
 * Combines getAllValidSlots + createFallbackFromTemplate in one call
 */
export function getCandidateSlotsWithFallback(
  availableTimeSlots: TimeSlot[],
  template: {
    duration: number;
    intent?: string;
    preferredSchedulableHours?: SchedulableHours;
    preferredSchedulableDates?: { startDate: string; endDate: string; description?: string };
    travelBuffer?: { beforeMinutes: number; afterMinutes: number };
    hasExplicitTimeRequest?: boolean;
  },
  calendarType: 'personal' | 'work'
): {
  slots: TimeSlot[];
  hasNoCommonTime: boolean;
  hasExplicitTimeConflict: boolean;
} {
  // Try to get valid slots from common availability
  let slots = getAllValidSlots(availableTimeSlots, {
    duration: template.duration,
    preferredSchedulableHours: template.preferredSchedulableHours,
    preferredSchedulableDates: template.preferredSchedulableDates,
    travelBuffer: template.travelBuffer,
  });

  let hasNoCommonTime = false;
  const hasExplicitTimeConflict = false;

  // Fallback if no common slots found
  if (slots.length === 0) {
    // NOTE: Using fallback slots doesn't mean there's a conflict.
    // It just means we're generating slots based on preferred hours
    // instead of using pre-computed common availability.
    // The fallback slots might be completely free.
    // We only set hasExplicitTimeConflict if the user explicitly requested
    // a specific time that conflicts (handled by hasExplicitTimeRequest flag).

    slots = createFallbackFromTemplate(
      {
        duration: template.duration,
        intent: template.intent || 'custom',
        preferredSchedulableHours: template.preferredSchedulableHours,
        preferredSchedulableDates: template.preferredSchedulableDates,
        travelBuffer: template.travelBuffer,
      },
      calendarType
    );
    hasNoCommonTime = true;
  }

  return { slots, hasNoCommonTime, hasExplicitTimeConflict };
}

/**
 * Create fallback time slots using event template preferences when no common slots are available
 * Generates multiple candidate slots across the preferred date range and schedulable hours
 * This allows the LLM to choose the best option considering calendar type and event appropriateness
 */
export function createFallbackFromTemplate(
  eventTemplate: {
    duration: number;
    intent: string;
    preferredSchedulableHours?: SchedulableHours;
    preferredSchedulableDates?: {
      startDate: string; // YYYY-MM-DD format
      endDate: string;   // YYYY-MM-DD format
    };
    travelBuffer?: { beforeMinutes: number; afterMinutes: number };
  },
  calendarType: 'personal' | 'work' = 'personal'
): TimeSlot[] {
  const fallbackSlots: TimeSlot[] = [];

  // Calculate total duration including travel buffers
  const totalDurationNeeded = eventTemplate.travelBuffer
    ? eventTemplate.duration + eventTemplate.travelBuffer.beforeMinutes + eventTemplate.travelBuffer.afterMinutes
    : eventTemplate.duration;

  // Determine date range
  const { startDate, endDate } = getDateRange(eventTemplate.preferredSchedulableDates);

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayOfWeek = getDayOfWeek(currentDate);

    let timeWindows: { start: string; end: string }[] = [];

    if (eventTemplate.preferredSchedulableHours && eventTemplate.preferredSchedulableHours[dayOfWeek]) {
      timeWindows = eventTemplate.preferredSchedulableHours[dayOfWeek];
    } else {
      // No specific schedulable hours - use reasonable defaults based on calendar type
      if (calendarType === 'personal') {
        const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
        if (isWeekend) {
          // Weekend: 9 AM - 9 PM
          timeWindows = [{ start: '09:00', end: '21:00' }];
        } else {
          // Weekday evening: 5 PM - 9 PM
          timeWindows = [{ start: '17:00', end: '21:00' }];
        }
      } else {
        // Work calendar: weekdays 9 AM - 5 PM
        const isWeekday = currentDate.getDay() >= 1 && currentDate.getDay() <= 5;
        if (isWeekday) {
          timeWindows = [{ start: '09:00', end: '17:00' }];
        }
        // Skip weekends for work calendar
      }
    }

    for (const window of timeWindows) {
      const windowStart = parseTimeString(window.start);
      const windowEnd = parseTimeString(window.end);

      // Create slots every 30 minutes within the window
      let slotTime = new Date(currentDate);
      slotTime.setHours(windowStart.hour, windowStart.minute, 0, 0);

      const windowEndTime = new Date(currentDate);
      windowEndTime.setHours(windowEnd.hour, windowEnd.minute, 0, 0);

      while (slotTime.getTime() + totalDurationNeeded * 60 * 1000 <= windowEndTime.getTime()) {
        const slotEnd = new Date(slotTime.getTime() + totalDurationNeeded * 60 * 1000);

        const slot = {
          start: slotTime.toISOString(),
          end: slotEnd.toISOString()
        };

        fallbackSlots.push(slot);

        // Move to next 30-minute increment
        slotTime = new Date(slotTime.getTime() + 30 * 60 * 1000);
      }
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  if (fallbackSlots.length === 0) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const endTime = new Date(tomorrow.getTime() + totalDurationNeeded * 60 * 1000);

    return [{
      start: tomorrow.toISOString(),
      end: endTime.toISOString()
    }];
  }

  return fallbackSlots;
}

