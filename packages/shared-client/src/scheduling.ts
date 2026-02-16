/**
 * Shared scheduling logic for Nektus - used by both iOS and web.
 *
 * Contains event template definitions, time-slot evaluation helpers,
 * and the processCommonSlots algorithm that picks the best meeting
 * time for each event type from a set of common free slots.
 */

import type { TimeSlot, SchedulableHours } from '@nektus/shared-types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Lightweight event template used by the chip-based scheduling UI.
 * This is intentionally simpler than the full Event type from shared-types
 * because it only carries the fields needed for slot selection.
 */
export interface SchedulingEventTemplate {
  id: string;
  title: string;
  duration: number;
  eventType: 'video' | 'in-person';
  travelBuffer?: { beforeMinutes: number; afterMinutes: number };
  preferredSchedulableHours?: SchedulableHours;
  preferMiddleTimeSlot?: boolean;
}

// ============================================================================
// EVENT TEMPLATES
// ============================================================================

/** Pre-defined event templates for quick scheduling chips. */
export const EVENT_TEMPLATES: Record<string, SchedulingEventTemplate> = {
  'video-30': {
    id: 'video-30', title: 'Quick Call', duration: 30, eventType: 'video',
    preferredSchedulableHours: {
      monday: [{ start: '08:00', end: '22:00' }], tuesday: [{ start: '08:00', end: '22:00' }],
      wednesday: [{ start: '08:00', end: '22:00' }], thursday: [{ start: '08:00', end: '22:00' }],
      friday: [{ start: '08:00', end: '22:00' }], saturday: [{ start: '08:00', end: '22:00' }],
      sunday: [{ start: '08:00', end: '22:00' }],
    },
    preferMiddleTimeSlot: true,
  },
  'coffee-30': {
    id: 'coffee-30', title: 'Coffee', duration: 30, eventType: 'in-person',
    travelBuffer: { beforeMinutes: 30, afterMinutes: 30 },
    preferredSchedulableHours: {
      monday: [{ start: '08:00', end: '12:00' }], tuesday: [{ start: '08:00', end: '12:00' }],
      wednesday: [{ start: '08:00', end: '12:00' }], thursday: [{ start: '08:00', end: '12:00' }],
      friday: [{ start: '08:00', end: '12:00' }], saturday: [{ start: '08:00', end: '12:00' }],
      sunday: [{ start: '08:00', end: '12:00' }],
    },
    preferMiddleTimeSlot: true,
  },
  'lunch-60': {
    id: 'lunch-60', title: 'Lunch', duration: 60, eventType: 'in-person',
    travelBuffer: { beforeMinutes: 30, afterMinutes: 30 },
    preferredSchedulableHours: {
      monday: [{ start: '11:30', end: '14:30' }], tuesday: [{ start: '11:30', end: '14:30' }],
      wednesday: [{ start: '11:30', end: '14:30' }], thursday: [{ start: '11:30', end: '14:30' }],
      friday: [{ start: '11:30', end: '14:30' }], saturday: [{ start: '11:30', end: '14:30' }],
      sunday: [{ start: '11:30', end: '14:30' }],
    },
    preferMiddleTimeSlot: true,
  },
  'dinner-60': {
    id: 'dinner-60', title: 'Dinner', duration: 60, eventType: 'in-person',
    travelBuffer: { beforeMinutes: 30, afterMinutes: 30 },
    preferredSchedulableHours: {
      monday: [{ start: '17:00', end: '20:00' }], tuesday: [{ start: '17:00', end: '20:00' }],
      wednesday: [{ start: '17:00', end: '20:00' }], thursday: [{ start: '17:00', end: '20:00' }],
      friday: [{ start: '17:00', end: '20:00' }], saturday: [{ start: '17:00', end: '20:00' }],
      sunday: [{ start: '17:00', end: '20:00' }],
    },
    preferMiddleTimeSlot: true,
  },
  'drinks-60': {
    id: 'drinks-60', title: 'Drinks', duration: 60, eventType: 'in-person',
    travelBuffer: { beforeMinutes: 30, afterMinutes: 30 },
    preferredSchedulableHours: {
      monday: [{ start: '16:00', end: '18:00' }], tuesday: [{ start: '16:00', end: '18:00' }],
      wednesday: [{ start: '16:00', end: '18:00' }], thursday: [{ start: '16:00', end: '18:00' }],
      friday: [{ start: '16:00', end: '22:00' }], saturday: [{ start: '16:00', end: '22:00' }],
      sunday: [{ start: '16:00', end: '18:00' }],
    },
    preferMiddleTimeSlot: true,
  },
  'quick-sync-30': {
    id: 'quick-sync-30', title: 'Quick Sync', duration: 30, eventType: 'video',
    preferredSchedulableHours: {
      monday: [{ start: '08:00', end: '22:00' }], tuesday: [{ start: '08:00', end: '22:00' }],
      wednesday: [{ start: '08:00', end: '22:00' }], thursday: [{ start: '08:00', end: '22:00' }],
      friday: [{ start: '08:00', end: '22:00' }], saturday: [{ start: '08:00', end: '22:00' }],
      sunday: [{ start: '08:00', end: '22:00' }],
    },
  },
  'deep-dive-60': {
    id: 'deep-dive-60', title: 'Deep Dive', duration: 60, eventType: 'video',
    preferredSchedulableHours: {
      monday: [{ start: '08:00', end: '22:00' }], tuesday: [{ start: '08:00', end: '22:00' }],
      wednesday: [{ start: '08:00', end: '22:00' }], thursday: [{ start: '08:00', end: '22:00' }],
      friday: [{ start: '08:00', end: '22:00' }], saturday: [{ start: '08:00', end: '22:00' }],
      sunday: [{ start: '08:00', end: '22:00' }],
    },
  },
  'live-working-session-60': {
    id: 'live-working-session-60', title: 'Working Session', duration: 60, eventType: 'in-person',
    travelBuffer: { beforeMinutes: 30, afterMinutes: 30 },
    preferredSchedulableHours: {
      monday: [{ start: '08:00', end: '22:00' }], tuesday: [{ start: '08:00', end: '22:00' }],
      wednesday: [{ start: '08:00', end: '22:00' }], thursday: [{ start: '08:00', end: '22:00' }],
      friday: [{ start: '08:00', end: '22:00' }], saturday: [{ start: '08:00', end: '22:00' }],
      sunday: [{ start: '08:00', end: '22:00' }],
    },
  },
};

// ============================================================================
// TIME HELPERS
// ============================================================================

/** Convert "HH:MM" string to minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Get day-of-week key from a Date object. */
export function getDayOfWeek(date: Date): keyof SchedulableHours {
  const days: (keyof SchedulableHours)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
}

/**
 * Format a date as "Today", "Tomorrow", the weekday name (if within 7 days),
 * or a short "Mon DD" date string.
 */
export function formatSmartDay(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const inputDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (inputDate.getTime() === today.getTime()) return 'Today';
  if (inputDate.getTime() === tomorrow.getTime()) return 'Tomorrow';

  const daysDiff = Math.floor((inputDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 0 && daysDiff <= 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================================================
// SLOT EVALUATION
// ============================================================================

/** Check if a slot's full time block fits within preferred schedulable hours. */
export function isSlotWithinSchedulableHours(
  slotTime: Date,
  preferredHours: SchedulableHours,
  eventDuration: number,
  beforeBuffer: number = 0,
  afterBuffer: number = 0,
): boolean {
  const timeInMinutes = slotTime.getHours() * 60 + slotTime.getMinutes();
  const daySchedule = preferredHours[getDayOfWeek(slotTime)];
  if (!daySchedule || daySchedule.length === 0) return false;

  for (const tw of daySchedule) {
    const startWindow = timeToMinutes(tw.start);
    const endWindow = timeToMinutes(tw.end);
    if (startWindow === endWindow) {
      if (Math.abs(timeInMinutes - startWindow) < 30) return true;
    } else if (endWindow > startWindow) {
      const blockEnd = timeInMinutes + beforeBuffer + eventDuration + afterBuffer;
      if (timeInMinutes >= startWindow && blockEnd <= endWindow) return true;
    } else {
      const totalBlock = beforeBuffer + eventDuration + afterBuffer;
      const windowDuration = (1440 - startWindow) + endWindow;
      let shifted = timeInMinutes - startWindow;
      if (shifted < 0) shifted += 1440;
      if (shifted >= 0 && shifted + totalBlock <= windowDuration) return true;
    }
  }
  return false;
}

/** Get all valid time slots for an event template from common 30-min slots. */
export function getAllValidSlots(
  commonSlots: TimeSlot[],
  template: SchedulingEventTemplate,
): TimeSlot[] {
  const sorted = [...commonSlots].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  const eventDuration = template.duration;
  const beforeBuffer = template.travelBuffer?.beforeMinutes || 0;
  const afterBuffer = template.travelBuffer?.afterMinutes || 0;
  const validSlots: TimeSlot[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const slotTime = new Date(sorted[i].start);

    // Check preferred hours filter
    if (template.preferredSchedulableHours && Object.keys(template.preferredSchedulableHours).length > 0) {
      if (!isSlotWithinSchedulableHours(slotTime, template.preferredSchedulableHours, eventDuration, beforeBuffer, afterBuffer)) {
        continue;
      }
    }

    // Check consecutive free time covers buffer + event + buffer
    const requiredEnd = new Date(slotTime.getTime() + (beforeBuffer + eventDuration + afterBuffer) * 60 * 1000);

    // Find consecutive block starting from or before this slot
    let startIndex = i;
    for (let k = i - 1; k >= 0; k--) {
      if (new Date(sorted[k].end).getTime() === new Date(sorted[startIndex].start).getTime()) {
        startIndex = k;
      } else break;
    }

    let consecutiveEnd = new Date(sorted[startIndex].end);
    let j = startIndex + 1;
    while (j < sorted.length && new Date(sorted[j].start).getTime() === consecutiveEnd.getTime()) {
      consecutiveEnd = new Date(sorted[j].end);
      j++;
    }

    if (new Date(sorted[startIndex].start).getTime() > slotTime.getTime() || consecutiveEnd.getTime() < requiredEnd.getTime()) {
      continue;
    }

    // Event starts after before-buffer
    const eventStart = new Date(slotTime.getTime() + beforeBuffer * 60 * 1000);
    const eventEnd = new Date(eventStart.getTime() + eventDuration * 60 * 1000);
    validSlots.push({ start: eventStart.toISOString(), end: eventEnd.toISOString() });
  }

  return validSlots;
}

/** Calculate center of a schedulable window for a given day. */
export function calculateWindowCenter(hours: SchedulableHours, date: Date): number | null {
  const daySchedule = hours[getDayOfWeek(date)];
  if (!daySchedule || daySchedule.length === 0) return null;
  const startMin = timeToMinutes(daySchedule[0].start);
  const endMin = timeToMinutes(daySchedule[0].end);
  const effectiveEnd = endMin < startMin ? endMin + 1440 : endMin;
  const center = Math.floor((startMin + effectiveEnd) / 2);
  return center >= 1440 ? center - 1440 : center;
}

/** Select the slot closest to the center of the preferred window. */
export function selectOptimalSlot(
  slots: TimeSlot[],
  centerMinutes: number,
  eventDuration: number,
): TimeSlot | null {
  if (slots.length === 0) return null;
  if (slots.length === 1) return slots[0];

  return slots.reduce((best, slot) => {
    const slotStart = new Date(slot.start);
    const midpoint = slotStart.getHours() * 60 + slotStart.getMinutes() + eventDuration / 2;
    const dist = Math.abs(midpoint - centerMinutes);

    const bestStart = new Date(best.start);
    const bestMid = bestStart.getHours() * 60 + bestStart.getMinutes() + eventDuration / 2;
    const bestDist = Math.abs(bestMid - centerMinutes);

    if (dist < bestDist) return slot;
    if (dist === bestDist && slotStart.getTime() < bestStart.getTime()) return slot;
    return best;
  }, slots[0]);
}

// ============================================================================
// MAIN PROCESSING
// ============================================================================

/**
 * Process common free slots into a single suggested time per event template.
 *
 * For each template ID the algorithm:
 * 1. Finds all slots that satisfy the template's preferred hours and
 *    have enough consecutive free time for travel buffers + event duration.
 * 2. If `preferMiddleTimeSlot` is set, picks the slot on the earliest
 *    available day that is closest to the center of the preferred window.
 * 3. Otherwise picks the earliest valid slot.
 */
export function processCommonSlots(
  commonSlots: TimeSlot[],
  templateIds: string[],
): Record<string, TimeSlot | null> {
  const times: Record<string, TimeSlot | null> = {};

  for (const id of templateIds) {
    const template = EVENT_TEMPLATES[id];
    if (!template) { times[id] = null; continue; }

    const validSlots = getAllValidSlots(commonSlots, template);

    if (validSlots.length === 0) {
      times[id] = null;
    } else if (template.preferMiddleTimeSlot && template.preferredSchedulableHours) {
      // Pick slot closest to center of preferred window on earliest available day
      const earliestDate = new Date(validSlots[0].start);
      earliestDate.setHours(0, 0, 0, 0);

      const slotsOnDay = validSlots.filter(s => {
        const d = new Date(s.start); d.setHours(0, 0, 0, 0);
        return d.getTime() === earliestDate.getTime();
      });

      const center = calculateWindowCenter(template.preferredSchedulableHours, earliestDate);
      if (center !== null && slotsOnDay.length > 0) {
        times[id] = selectOptimalSlot(slotsOnDay, center, template.duration);
      } else {
        times[id] = validSlots[0];
      }
    } else {
      times[id] = validSlots[0];
    }
  }

  return times;
}
