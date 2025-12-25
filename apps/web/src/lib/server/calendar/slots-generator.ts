// Slot Generator - Converts busy times + schedulable hours to free 30-minute slots

import { SchedulableHours, TimeSlot } from '@/types';
import { AVAILABILITY_CONSTANTS } from '@/lib/constants';
import {
  getMidnightTomorrowInUserTimezone,
  createUserTimezoneDate,
  parseTimeString,
  getTimezoneOffsetString
} from './time';

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export function generateFreeSlots(
  busyTimes: TimeSlot[],
  schedulableHours: SchedulableHours,
  startTime: Date,
  endTime: Date,
  userTimezone?: string
): TimeSlot[] {
  let slots: TimeSlot[] = [];
  const currentDate = new Date(startTime);

  // Don't allow slots before next day midnight
  const now = new Date();
  let minStartTime: Date;

  if (userTimezone) {
    try {
      minStartTime = getMidnightTomorrowInUserTimezone(userTimezone);
    } catch (error) {
      console.warn(`Invalid user timezone ${userTimezone}, using UTC:`, error);
      minStartTime = new Date(now);
      minStartTime.setUTCHours(0, 0, 0, 0);
      minStartTime.setUTCDate(minStartTime.getUTCDate() + 1);
    }
  } else {
    minStartTime = new Date(now);
    minStartTime.setUTCHours(0, 0, 0, 0);
    minStartTime.setUTCDate(minStartTime.getUTCDate() + 1);
  }

  if (currentDate < minStartTime) {
    currentDate.setTime(minStartTime.getTime());
  }

  while (currentDate < endTime && slots.length < 500) {
    const dayOfWeek = getDayOfWeek(currentDate);
    const daySchedulableHours = schedulableHours[dayOfWeek];

    if (daySchedulableHours && daySchedulableHours.length > 0) {
      for (const timeBlock of daySchedulableHours) {
        const daySlots = generate30MinSlotsForTimeBlock(currentDate, timeBlock, minStartTime, userTimezone);
        const freeSlots = daySlots.filter(slot => !isSlotBusy(slot, busyTimes));
        slots.push(...freeSlots);
      }
    }

    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    currentDate.setUTCHours(0, 0, 0, 0);
  }

  slots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Deduplicate
  const seen = new Set<string>();
  slots = slots.filter(slot => {
    if (seen.has(slot.start)) {
      return false;
    }
    seen.add(slot.start);
    return true;
  });

  return slots;
}

function generate30MinSlotsForTimeBlock(date: Date, timeBlock: TimeSlot, minStartTime?: Date, userTimezone?: string): TimeSlot[] {
  const slots: TimeSlot[] = [];

  const [startHour, startMinute] = timeBlock.start.split(':').map(Number);
  const [endHour, endMinute] = timeBlock.end.split(':').map(Number);

  const blockStart = userTimezone
    ? createUserTimezoneDate(date.getFullYear(), date.getMonth(), date.getDate(), startHour, startMinute, 0, userTimezone)
    : new Date(date.getFullYear(), date.getMonth(), date.getDate(), startHour, startMinute, 0, 0);

  const blockEnd = userTimezone
    ? createUserTimezoneDate(date.getFullYear(), date.getMonth(), date.getDate(), endHour, endMinute, 0, userTimezone)
    : new Date(date.getFullYear(), date.getMonth(), date.getDate(), endHour, endMinute, 0, 0);

  let actualStart = new Date(blockStart);
  if (minStartTime && minStartTime > blockStart && minStartTime.toDateString() === date.toDateString()) {
    actualStart = new Date(minStartTime);
    const minutes = actualStart.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 30) * 30;
    actualStart.setMinutes(roundedMinutes, 0, 0);
    if (actualStart.getMinutes() === 60) {
      actualStart.setHours(actualStart.getHours() + 1, 0, 0, 0);
    }
  }

  const slotStart = new Date(actualStart);
  while (slotStart < blockEnd) {
    const slotEnd = new Date(slotStart.getTime() + AVAILABILITY_CONSTANTS.slotDuration * 60 * 1000);

    if (slotEnd <= blockEnd) {
      const formatInUserTimezone = (date: Date) => {
        if (userTimezone) {
          const tzOffset = getTimezoneOffsetString(date, userTimezone);
          return new Intl.DateTimeFormat('sv-SE', {
            timeZone: userTimezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          }).format(date).replace(' ', 'T') + tzOffset;
        } else {
          return date.toISOString();
        }
      };

      slots.push({
        start: formatInUserTimezone(slotStart),
        end: formatInUserTimezone(slotEnd),
      });
    }

    slotStart.setMinutes(slotStart.getMinutes() + AVAILABILITY_CONSTANTS.slotDuration);
  }

  return slots;
}

function isSlotBusy(slot: TimeSlot, busyTimes: TimeSlot[]): boolean {
  const slotStart = new Date(slot.start);
  const slotEnd = new Date(slot.end);

  return busyTimes.some(busy => {
    const busyStart = new Date(busy.start);
    const busyEnd = new Date(busy.end);
    return slotStart < busyEnd && slotEnd > busyStart;
  });
}

function getDayOfWeek(date: Date): DayOfWeek {
  const days: DayOfWeek[] = [
    'sunday', 'monday', 'tuesday', 'wednesday',
    'thursday', 'friday', 'saturday'
  ];
  return days[date.getDay()];
}

// Find intersection of two slot arrays (for find-common-times)
export function findSlotIntersection(
  user1Slots: TimeSlot[],
  user2Slots: TimeSlot[]
): TimeSlot[] {
  const commonSlots: TimeSlot[] = [];

  for (const user1Slot of user1Slots) {
    for (const user2Slot of user2Slots) {
      const overlap = findTimeOverlap(user1Slot, user2Slot);

      if (overlap) {
        commonSlots.push({
          start: overlap.start,
          end: overlap.end,
        });
      }
    }
  }

  const uniqueSlots = commonSlots.filter((slot, index, arr) =>
    arr.findIndex(s => s.start === slot.start) === index
  );

  uniqueSlots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return uniqueSlots.slice(0, 150);
}

function findTimeOverlap(slot1: TimeSlot, slot2: TimeSlot): TimeSlot | null {
  const start1 = new Date(slot1.start);
  const end1 = new Date(slot1.end);
  const start2 = new Date(slot2.start);
  const end2 = new Date(slot2.end);

  const overlapStart = start1 > start2 ? start1 : start2;
  const overlapEnd = end1 < end2 ? end1 : end2;

  if (overlapStart < overlapEnd) {
    return {
      start: overlapStart.toISOString(),
      end: overlapEnd.toISOString(),
    };
  }

  return null;
}

// Merge multiple busy time arrays (for combining providers)
export function mergeBusyTimes(busyTimeArrays: TimeSlot[][]): TimeSlot[] {
  const allBusyTimes = busyTimeArrays.flat();

  allBusyTimes.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const merged: TimeSlot[] = [];

  for (const current of allBusyTimes) {
    if (merged.length === 0) {
      merged.push(current);
      continue;
    }

    const last = merged[merged.length - 1];
    const lastEnd = new Date(last.end);
    const currentStart = new Date(current.start);

    if (currentStart <= lastEnd) {
      const currentEnd = new Date(current.end);
      const mergedEnd = new Date(Math.max(lastEnd.getTime(), currentEnd.getTime()));
      last.end = mergedEnd.toISOString();
    } else {
      merged.push(current);
    }
  }

  return merged;
}

// Helper to get time range for availability queries
export function getAvailabilityTimeRange(userTimezone?: string): { startTime: string; endTime: string } {
  if (userTimezone) {
    try {
      const startTime = getMidnightTomorrowInUserTimezone(userTimezone);
      const endTime = new Date(startTime.getTime() + AVAILABILITY_CONSTANTS.lookAheadDays * 24 * 60 * 60 * 1000);

      return {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      };
    } catch (error) {
      console.warn(`Invalid user timezone ${userTimezone}, falling back to UTC:`, error);
    }
  }

  const now = new Date();
  const startTime = new Date(now);
  startTime.setUTCHours(0, 0, 0, 0);
  startTime.setUTCDate(startTime.getUTCDate() + 1);

  const endTime = new Date(startTime.getTime() + AVAILABILITY_CONSTANTS.lookAheadDays * 24 * 60 * 60 * 1000);

  return {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  };
}

// Helper to get date range from preferred dates or use default (tomorrow + 14 days)
export function getDateRange(preferredSchedulableDates?: {
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

/**
 * Create fallback time slots using event template preferences when no common slots are available
 * Generates multiple candidate slots across the preferred date range and schedulable hours
 * This allows the LLM to choose the best option considering calendar type and event appropriateness
 */
export function createFallbackFromTemplate(
  eventTemplate: {
    duration: number;
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