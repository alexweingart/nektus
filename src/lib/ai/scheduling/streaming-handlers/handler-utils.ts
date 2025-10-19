import { buildFinalEvent as buildFinalEventUtil } from '@/lib/events/event-utils';
import type { AISchedulingRequest } from '@/types/ai-scheduling';
import type { Event, CalendarUrls, TimeSlot } from '@/types';
import type { Place } from '@/types/places';

/**
 * Get target name for messaging
 */
export function getTargetName(user2Name: string | undefined): string {
  return user2Name || 'them';
}

/**
 * Build final event object - wrapper around utility function
 */
export function buildFinalEvent(
  body: AISchedulingRequest,
  eventResult: { title: string; startTime: string; endTime: string; place?: Place },
  template: Partial<Event>,
  description: string,
  location: string,
  urls: CalendarUrls
): Event {
  return buildFinalEventUtil(
    body.user1Id,
    body.user2Id,
    eventResult,
    template,
    description,
    location,
    urls
  );
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
