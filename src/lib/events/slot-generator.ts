// Slot Generator - Converts busy times + schedulable hours to free 30-minute slots

import { SchedulableHours, TimeSlot } from '@/types';
import { AVAILABILITY_CONSTANTS } from '@/lib/constants';
import {
  getMidnightTomorrowInUserTimezone,
  createUserTimezoneDate,
  timeToMinutes,
  minutesToTime,
  // getSlotDurationMinutes, // Unused currently
  getTimezoneOffsetString
} from './time-utils';

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// Merge schedulable hours from two calendars (e.g., personal and work)
export function mergeSchedulableHours(
  hours1: SchedulableHours,
  hours2: SchedulableHours
): SchedulableHours {
  const merged: SchedulableHours = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };

  const days: (keyof SchedulableHours)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  for (const day of days) {
    const combinedSlots = [...(hours1[day] || []), ...(hours2[day] || [])];

    if (combinedSlots.length === 0) {
      merged[day] = [];
      continue;
    }

    // Sort slots by start time
    combinedSlots.sort((a, b) => {
      const aStart = timeToMinutes(a.start);
      const bStart = timeToMinutes(b.start);
      return aStart - bStart;
    });

    // Merge overlapping or adjacent slots
    const mergedSlots: TimeSlot[] = [];
    let currentSlot = { ...combinedSlots[0] };

    for (let i = 1; i < combinedSlots.length; i++) {
      const nextSlot = combinedSlots[i];
      const currentEnd = timeToMinutes(currentSlot.end);
      const nextStart = timeToMinutes(nextSlot.start);
      const nextEnd = timeToMinutes(nextSlot.end);

      if (nextStart <= currentEnd) {
        // Slots overlap or are adjacent - merge them
        currentSlot.end = minutesToTime(Math.max(currentEnd, nextEnd));
      } else {
        // Slots don't overlap - save current and start new
        mergedSlots.push(currentSlot);
        currentSlot = { ...nextSlot };
      }
    }

    // Add the last slot
    mergedSlots.push(currentSlot);
    merged[day] = mergedSlots;
  }

  return merged;
}

export function generateFreeSlots(
  busyTimes: TimeSlot[],
  schedulableHours: SchedulableHours,
  startTime: Date,
  endTime: Date,
  userTimezone?: string
): TimeSlot[] {
  console.log(`📊 generateFreeSlots: ${busyTimes.length} busy times, ${startTime.toISOString()} to ${endTime.toISOString()}, timezone: ${userTimezone || 'UTC'}`);

  // DEBUG: Log ALL busy times
  console.log(`🔍 ALL ${busyTimes.length} BUSY TIMES:`);
  busyTimes.forEach((busy, idx) => {
    const start = new Date(busy.start);
    const end = new Date(busy.end);
    console.log(`  ${idx + 1}. ${start.toLocaleString('en-US', { timeZone: userTimezone || 'UTC', dateStyle: 'short', timeStyle: 'short' })} - ${end.toLocaleString('en-US', { timeZone: userTimezone || 'UTC', timeStyle: 'short' })}`);
  });

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

    // DEBUG: Track specific weekend days
    const dateStr = currentDate.toLocaleDateString('en-US', { timeZone: userTimezone || 'UTC', month: '2-digit', day: '2-digit', year: 'numeric' });
    const isTargetWeekend = dateStr === '11/15/2025' || dateStr === '11/16/2025';

    if (isTargetWeekend) {
      console.log(`\n🎯 Processing ${dateStr} (${dayOfWeek}):`);
      console.log(`  Schedulable hours:`, daySchedulableHours);
    }

    if (daySchedulableHours && daySchedulableHours.length > 0) {
      for (const timeBlock of daySchedulableHours) {
        const daySlots = generate30MinSlotsForTimeBlock(currentDate, timeBlock, minStartTime, userTimezone);

        if (isTargetWeekend) {
          console.log(`  Generated ${daySlots.length} slots for time block ${timeBlock.start}-${timeBlock.end}`);
          console.log(`  Sample slots:`, daySlots.slice(0, 5).map(s => new Date(s.start).toLocaleString('en-US', { timeZone: userTimezone || 'UTC', timeStyle: 'short' })));
        }

        const freeSlots = daySlots.filter(slot => !isSlotBusy(slot, busyTimes));

        if (isTargetWeekend) {
          const filteredCount = daySlots.length - freeSlots.length;
          console.log(`  Filtered out ${filteredCount} busy slots, keeping ${freeSlots.length} free slots`);
          if (filteredCount > 0) {
            console.log(`  Busy slots filtered:`);
            daySlots.filter(slot => isSlotBusy(slot, busyTimes)).slice(0, 10).forEach(slot => {
              const slotStart = new Date(slot.start);
              const slotEnd = new Date(slot.end);
              const conflictingBusy = busyTimes.find(busy => {
                const busyStart = new Date(busy.start);
                const busyEnd = new Date(busy.end);
                return slotStart < busyEnd && slotEnd > busyStart;
              });
              console.log(`    ❌ ${slotStart.toLocaleString('en-US', { timeZone: userTimezone || 'UTC', timeStyle: 'short' })} - conflicts with ${conflictingBusy ? new Date(conflictingBusy.start).toLocaleString('en-US', { timeZone: userTimezone || 'UTC', dateStyle: 'short', timeStyle: 'short' }) + ' - ' + new Date(conflictingBusy.end).toLocaleString('en-US', { timeZone: userTimezone || 'UTC', timeStyle: 'short' }) : 'unknown'}`);
            });
          }
        }

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

  console.log(`✓ Generated ${slots.length} free slots from ${busyTimes.length} busy periods`);

  // Debug: Show free slots for Saturday Oct 19, 2025
  const oct19Slots = slots.filter(slot => {
    const slotDate = new Date(slot.start);
    return slotDate.getMonth() === 9 && slotDate.getDate() === 19 && slotDate.getFullYear() === 2025;
  });
  if (oct19Slots.length > 0) {
    console.log(`📅 Free slots for Saturday Oct 19, 2025 (${oct19Slots.length} slots):`);
    oct19Slots.slice(0, 10).forEach((slot, idx) => {
      const start = new Date(slot.start);
      const end = new Date(slot.end);
      console.log(`  ${idx + 1}. ${start.toLocaleString('en-US', { timeZone: userTimezone || 'America/Los_Angeles', timeStyle: 'short' })} - ${end.toLocaleString('en-US', { timeZone: userTimezone || 'America/Los_Angeles', timeStyle: 'short' })}`);
    });
    if (oct19Slots.length > 10) {
      console.log(`  ... and ${oct19Slots.length - 10} more`);
    }
  }

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
  user2Slots: TimeSlot[],
  duration: number = 60,
  _travelBuffer?: { beforeMinutes: number; afterMinutes: number }
): TimeSlot[] {
  console.log(`🔍 findSlotIntersection: ${user1Slots.length} x ${user2Slots.length} slots, duration: ${duration}min`);
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

  const returnedSlots = uniqueSlots.slice(0, 150);
  console.log(`✓ Found ${returnedSlots.length} common slots`);
  return returnedSlots;
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

  console.log(`✓ Merged ${allBusyTimes.length} busy times into ${merged.length} periods`);
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

export function get24x7AvailabilityTimeRange(): { startTime: string; endTime: string } {
  const now = new Date();
  const startTime = new Date(now);
  startTime.setUTCHours(0, 0, 0, 0);
  startTime.setUTCDate(startTime.getUTCDate() + 1);

  const endTime = new Date(startTime.getTime() + (AVAILABILITY_CONSTANTS.lookAheadDays + 1) * 24 * 60 * 60 * 1000);

  return {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  };
}