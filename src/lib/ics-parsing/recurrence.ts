/**
 * Recurring event generation and expansion using rrule.js library
 */

import { rrulestr } from 'rrule';
import type { IcsEvent } from './parser-core';

/**
 * Parse RRULE to generate recurring event instances using rrule.js
 */
export function expandRecurringEvent(baseEvent: IcsEvent, rrule: string, rangeStart?: Date, rangeEnd?: Date): IcsEvent[] {
  // Only include base event if it's within the requested range
  const baseInRange = (!rangeStart || baseEvent.start >= rangeStart) && (!rangeEnd || baseEvent.start < rangeEnd);
  const events: IcsEvent[] = baseInRange ? [baseEvent] : [];

  try {
    // Construct RRULE string with DTSTART for rrule.js
    const dtstart = baseEvent.start.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const rruleString = `DTSTART:${dtstart}\nRRULE:${rrule}`;

    // Parse RRULE using rrule.js
    const rule = rrulestr(rruleString, { forceset: false });

    // Calculate event duration
    const duration = baseEvent.end.getTime() - baseEvent.start.getTime();

    // Generate occurrences within the range
    // Start from base event, end at rangeEnd (or 1 year from base if no range)
    const effectiveRangeStart = baseEvent.start;
    const effectiveRangeEnd = rangeEnd || new Date(baseEvent.start.getTime() + 365 * 24 * 60 * 60 * 1000);

    const occurrences = rule.between(effectiveRangeStart, effectiveRangeEnd, true);

    // Convert occurrences to IcsEvent objects
    // Skip base event if we already added it, or if it's outside the requested range
    const startIndex = baseInRange ? 1 : 0;
    for (let i = startIndex; i < occurrences.length; i++) {
      const occurrenceStart = occurrences[i];

      // Only include if within requested range (if provided)
      if (!rangeStart || occurrenceStart >= rangeStart) {
        const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);
        events.push({
          ...baseEvent,
          start: occurrenceStart,
          end: occurrenceEnd,
        });
      }
    }

    console.log(`🔁 Recurring event found: "${baseEvent.summary}" (${baseEvent.uid})`);
    console.log(`   RRULE: ${rrule}`);
    console.log(`   Base event start: ${baseEvent.start.toISOString()}`);
    console.log(`   Range: ${rangeStart?.toISOString() || 'none'} to ${rangeEnd?.toISOString() || 'none'}`);
    console.log(`   Expanded to ${events.length} instances`);

    // Special logging for Tuesday 11:05 AM events (18:05 UTC)
    if (rrule.includes('BYDAY=TU') && rrule.includes('UNTIL=20260324T180500Z')) {
      console.log(`   🎯 FOUND THE TUESDAY 11:05 AM EVENT!`);
      console.log(`   Event summary: "${baseEvent.summary}"`);
      console.log(`   Event status: "${baseEvent.status}"`);
      console.log(`   Event transparency: "${baseEvent.transparency}"`);
      console.log(`   rrule.js occurrences: ${occurrences.length}`);
      console.log(`   First 5 occurrences:`, occurrences.slice(0, 5).map(d => d.toISOString()));
      console.log(`   Final events array length: ${events.length}`);
      console.log(`   Final events:`, events.map(e => ({ start: e.start.toISOString(), transparency: e.transparency, status: e.status })));
    }

  } catch (error) {
    console.error(`❌ Error expanding RRULE for event "${baseEvent.summary}":`, error);
    console.error(`   RRULE: ${rrule}`);
  }

  return events;
}
