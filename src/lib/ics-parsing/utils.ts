/**
 * Exception dates, recurrence dates, busy times extraction, and URL validation
 */

import type { IcsEvent } from './parser-core';
import { parseIcsDateTime } from './timezone';

/**
 * Create a recurring event instance
 */
function createRecurringEvent(baseEvent: IcsEvent, startDate: Date, endDate: Date): IcsEvent {
  const recurringEvent: IcsEvent = {
    ...baseEvent,
    uid: `${baseEvent.uid}_${startDate.toISOString().split('T')[0]}`,
    start: startDate,
    end: endDate
  };

  return recurringEvent;
}

/**
 * Parse EXDATE (exception dates) property
 */
export function parseExceptionDates(exdate: string): Date[] {
  const exceptionDates: Date[] = [];

  try {
    // EXDATE can contain multiple dates separated by commas
    // Format: EXDATE;TZID=America/Los_Angeles:20241209T133500,20241210T133500
    // or: EXDATE:20241209T133500Z,20241210T133500Z

    // Handle timezone parameters
    const [propertyPart, datesPart] = exdate.includes(':') ?
      [exdate.substring(0, exdate.indexOf(':')), exdate.substring(exdate.indexOf(':') + 1)] :
      ['', exdate];

    // Extract TZID if present
    let tzid: string | null = null;
    if (propertyPart.includes('TZID=')) {
      const tzidMatch = propertyPart.match(/TZID=([^;]+)/);
      if (tzidMatch) {
        tzid = tzidMatch[1];
      }
    }

    // Split multiple dates and parse each one
    const dateStrings = datesPart.split(',');
    for (const dateStr of dateStrings) {
      const trimmedDate = dateStr.trim();
      if (trimmedDate && trimmedDate.length >= 8) { // Basic length check for YYYYMMDD minimum
        try {
          // Reconstruct the full property line for parsing
          const fullDateLine = tzid ? `EXDATE;TZID=${tzid}:${trimmedDate}` : `EXDATE:${trimmedDate}`;
          const parsedDate = parseIcsDateTime(fullDateLine);
          exceptionDates.push(parsedDate);

        } catch {
          console.warn(`Skipping malformed EXDATE entry: "${trimmedDate}"`);
        }
      }
    }

  } catch (error) {
    console.warn('Failed to parse EXDATE:', exdate, error);
  }

  return exceptionDates;
}

/**
 * Apply exception dates to filter out recurring events
 */
export function applyExceptionDates(events: IcsEvent[], exceptionDates: Date[]): IcsEvent[] {
  if (exceptionDates.length === 0) return events;

  const filteredEvents = events.filter(event => {
    // Check if this event's start time matches any exception date
    for (const exceptionDate of exceptionDates) {
      // Compare dates by converting to the same timezone and checking year/month/day/hour/minute
      if (isSameDateTime(event.start, exceptionDate)) {
        return false; // Exclude this event
      }
    }
    return true; // Include this event
  });

  return filteredEvents;
}

/**
 * Parse RDATE (additional recurrence dates) property
 */
export function parseRecurrenceDates(rdate: string): Date[] {
  const additionalDates: Date[] = [];

  try {
    // RDATE format similar to EXDATE
    const [propertyPart, datesPart] = rdate.includes(':') ?
      [rdate.substring(0, rdate.indexOf(':')), rdate.substring(rdate.indexOf(':') + 1)] :
      ['', rdate];

    // Extract TZID if present
    let tzid: string | null = null;
    if (propertyPart.includes('TZID=')) {
      const tzidMatch = propertyPart.match(/TZID=([^;]+)/);
      if (tzidMatch) {
        tzid = tzidMatch[1];
      }
    }

    // Split multiple dates and parse each one
    const dateStrings = datesPart.split(',');
    for (const dateStr of dateStrings) {
      if (dateStr.trim()) {
        // Reconstruct the full property line for parsing
        const fullDateLine = tzid ? `RDATE;TZID=${tzid}:${dateStr.trim()}` : `RDATE:${dateStr.trim()}`;
        const parsedDate = parseIcsDateTime(fullDateLine);
        additionalDates.push(parsedDate);
      }
    }

  } catch (error) {
    console.warn('Failed to parse RDATE:', rdate, error);
  }

  return additionalDates;
}

/**
 * Create additional event instances from RDATE
 */
export function createAdditionalEvents(baseEvent: IcsEvent, additionalDates: Date[], rangeStart?: Date, rangeEnd?: Date): IcsEvent[] {
  const additionalEvents: IcsEvent[] = [];
  const duration = baseEvent.end.getTime() - baseEvent.start.getTime();

  for (const additionalDate of additionalDates) {
    const newStartDate = new Date(additionalDate);
    const newEndDate = new Date(additionalDate.getTime() + duration);

    // Only include events that overlap with our range
    const overlapsRange = !rangeStart || !rangeEnd || (newStartDate < rangeEnd && newEndDate > rangeStart);

    if (overlapsRange) {
      const additionalEvent = createRecurringEvent(baseEvent, newStartDate, newEndDate);
      additionalEvents.push(additionalEvent);

    }
  }

  return additionalEvents;
}

/**
 * Compare two dates to see if they represent the same date/time
 */
export function isSameDateTime(date1: Date, date2: Date): boolean {
  // Compare with a tolerance of 1 minute to account for timezone/parsing differences
  const timeDiff = Math.abs(date1.getTime() - date2.getTime());
  return timeDiff < 60000; // 1 minute tolerance
}

/**
 * Deduplicate events with the same start/end time (regardless of UID)
 * Keep the "busiest" version (OPAQUE over TRANSPARENT, CONFIRMED over TENTATIVE)
 * This handles cases where Microsoft creates multiple recurring events for the same time slot
 */
function deduplicateEvents(events: IcsEvent[]): IcsEvent[] {
  const eventMap = new Map<string, IcsEvent>();

  for (const event of events) {
    // Use time-based key instead of UID+time to catch overlapping events from different series
    const key = `${event.start.getTime()}:${event.end.getTime()}`;
    const existing = eventMap.get(key);

    // Debug logging for Tuesday Oct 7 11:05 AM
    if (event.start.toISOString() === '2025-10-07T18:05:00.000Z') {
      console.log(`📋 Deduplication check for Tuesday Oct 7 11:05 AM`);
      console.log(`   UID: "${event.uid}"`);
      console.log(`   Summary: "${event.summary}"`);
      console.log(`   Transparency: "${event.transparency}"`);
      console.log(`   Start: ${event.start.toISOString()}`);
      console.log(`   End: ${event.end.toISOString()}`);
      console.log(`   Key: "${key}"`);
      console.log(`   Existing: ${existing ? `YES ("${existing.summary}", ${existing.transparency}, end: ${existing.end.toISOString()})` : 'NO'}`);
    }

    if (!existing) {
      eventMap.set(key, event);
    } else {
      // Keep the busiest version
      const isBusier =
        (event.transparency === 'OPAQUE' && existing.transparency === 'TRANSPARENT') ||
        (event.transparency === existing.transparency && event.status === 'CONFIRMED' && existing.status !== 'CONFIRMED');

      if (isBusier) {
        console.log(`📋 Deduplication: Replacing "${existing.summary}" (${existing.transparency}) with "${event.summary}" (${event.transparency}) at ${event.start.toISOString()}`);
        eventMap.set(key, event);
      } else {
        console.log(`📋 Deduplication: Keeping "${existing.summary}" (${existing.transparency}) over "${event.summary}" (${event.transparency}) at ${event.start.toISOString()}`);
      }
    }
  }

  return Array.from(eventMap.values());
}

/**
 * Filter events to only show busy times for scheduling
 */
export function extractBusyTimes(events: IcsEvent[], startDate: Date, endDate: Date): Array<{ start: Date; end: Date }> {
  // First, deduplicate events with the same UID and start time
  // Keep the "busiest" version (OPAQUE over TRANSPARENT, CONFIRMED over TENTATIVE)
  const deduplicatedEvents = deduplicateEvents(events);

  const busyTimes = deduplicatedEvents
    .filter(event => {
      // Only include confirmed events that mark time as busy
      const isConfirmed = event.status !== 'CANCELLED' && event.status !== 'TENTATIVE';

      // Also check if the summary/title indicates tentative status
      const isTentativeByTitle = event.summary.toLowerCase().includes('tentative');

      const isBusy = event.transparency !== 'TRANSPARENT';
      const isInRange = event.start < endDate && event.end > startDate;

      // Include busy times if:
      // 1. Event is confirmed, not tentative by title, busy, and in range
      // 2. OR event has "busy" in title (regardless of status) and is opaque/in range
      // BUT NEVER include tentative events (they should remain free time)
      const hasBusyTitle = event.summary.toLowerCase().includes('busy');

      const shouldInclude = (
        (isConfirmed && !isTentativeByTitle && isBusy && isInRange) ||
        (hasBusyTitle && !isTentativeByTitle && event.transparency === 'OPAQUE' && isInRange)
      );

      // Debug logging for Tuesday Oct 7 11:05 AM event
      if (event.start.toISOString() === '2025-10-07T18:05:00.000Z') {
        console.log(`🎯 extractBusyTimes - Found Tuesday Oct 7 11:05 AM event`);
        console.log(`   UID: "${event.uid}"`);
        console.log(`   Summary: "${event.summary}"`);
        console.log(`   Status: "${event.status}"`);
        console.log(`   Transparency: "${event.transparency}"`);
        console.log(`   isConfirmed: ${isConfirmed}`);
        console.log(`   isTentativeByTitle: ${isTentativeByTitle}`);
        console.log(`   isBusy: ${isBusy}`);
        console.log(`   isInRange: ${isInRange}`);
        console.log(`   hasBusyTitle: ${hasBusyTitle}`);
        console.log(`   shouldInclude: ${shouldInclude}`);
      }

      return shouldInclude;
    })
    .map(event => ({
      start: event.start,
      end: event.end
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // Debug: Log all busy times on Tuesday Oct 7, 2025
  const tuesdayBusyTimes = busyTimes.filter(bt => {
    const btDate = new Date(bt.start);
    return btDate.getFullYear() === 2025 && btDate.getMonth() === 9 && btDate.getDate() === 7;
  });

  if (tuesdayBusyTimes.length > 0) {
    console.log(`📅 Found ${tuesdayBusyTimes.length} busy times on Tuesday Oct 7, 2025:`);
    tuesdayBusyTimes.forEach(bt => {
      console.log(`   ${bt.start.toISOString()} - ${bt.end.toISOString()}`);
    });
  }

  return busyTimes;
}

/**
 * Validate ICS URL format
 */
export function validateIcsUrl(url: string): { isValid: boolean; error?: string } {
  try {
    const parsedUrl = new URL(url);

    // Check if it's a valid HTTP/HTTPS URL
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { isValid: false, error: 'URL must use HTTP or HTTPS' };
    }

    // Check if it looks like an ICS feed
    if (!url.includes('.ics') && !url.includes('/ical/') && !url.includes('calendar')) {
      return { isValid: false, error: 'URL does not appear to be a calendar feed' };
    }

    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }
}
