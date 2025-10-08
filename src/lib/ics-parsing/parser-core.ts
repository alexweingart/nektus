/**
 * Main ICS parsing logic and interfaces
 */

import { expandRecurringEvent } from './recurrence';
import { parseIcsDateTime } from './timezone';
import { parseExceptionDates, applyExceptionDates, parseRecurrenceDates, createAdditionalEvents } from './utils';

export interface IcsEvent {
  uid: string;
  summary: string;
  start: Date;
  end: Date;
  status: string;
  transparency: string;
  dtstart?: string; // Preserve original timezone info for debugging
  dtend?: string;   // Preserve original timezone info for debugging
}

export interface ParsedIcsData {
  events: IcsEvent[];
  errors: string[];
}

/**
 * Parse ICS calendar data into events with optional date range filtering for performance
 */
export function parseIcs(icsData: string, rangeStart?: Date, rangeEnd?: Date): ParsedIcsData {
  let events: IcsEvent[] = [];
  const errors: string[] = [];

  try {
    // Split ICS data into lines and normalize
    const lines = icsData
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Find event blocks (VEVENT)
    const eventBlocks: string[][] = [];
    let currentEvent: string[] = [];
    let inEvent = false;

    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') {
        inEvent = true;
        currentEvent = [line];
      } else if (line === 'END:VEVENT') {
        if (inEvent) {
          currentEvent.push(line);
          eventBlocks.push([...currentEvent]);
          currentEvent = [];
          inEvent = false;
        }
      } else if (inEvent) {
        currentEvent.push(line);
      }
    }



    // Parse each event block and capture original text
    for (let i = 0; i < eventBlocks.length; i++) {
      const eventLines = eventBlocks[i];
      try {
        const parsedEvents = parseEventBlock(eventLines, rangeStart, rangeEnd);
        if (parsedEvents && parsedEvents.length > 0) {
          // Attach original ICS text to each parsed event
          const originalText = eventLines.join('\n');
          for (const event of parsedEvents) {
            (event as any).originalText = originalText;
          }

          // Add all events (base event + recurring instances) to the main events array
          events.push(...parsedEvents);
        }
      } catch (error) {
        errors.push(`Failed to parse event: ${error}`);
      }
    }

    // RECURRENCE-ID FIX: Track CANCELLED RECURRENCE-ID instances by UID and original time
    // This maps UID -> Set of CANCELLED RECURRENCE-ID times that should be excluded
    // IMPORTANT: Only track CANCELLED instances, not all RECURRENCE-ID modifications
    const recurrenceIdModifications = new Map<string, Set<string>>();

    // First pass: collect CANCELLED RECURRENCE-ID instances only
    for (const eventLines of eventBlocks) {
    const uidLine = eventLines.find(line => line.startsWith('UID:'));
    const recurrenceIdLine = eventLines.find(line => line.startsWith('RECURRENCE-ID'));
    const statusLine = eventLines.find(line => line.startsWith('STATUS:'));

    if (uidLine && recurrenceIdLine) {
      const uid = uidLine.substring(4).split('\n')[0].trim();
      const uidBase = uid.split('0100000')[0]; // Get base UID before the instance ID

      // Check if this is a CANCELLED instance
      const isCancelled = statusLine && statusLine.includes('CANCELLED');

      // Parse the RECURRENCE-ID date
      const recurrenceIdMatch = recurrenceIdLine.match(/RECURRENCE-ID[^:]*:(\d{8}T\d{6})/);
      if (recurrenceIdMatch) {
        const recurrenceIdTime = recurrenceIdMatch[1];


        // Only add to exclusion list if CANCELLED
        if (isCancelled) {
          if (!recurrenceIdModifications.has(uidBase)) {
            recurrenceIdModifications.set(uidBase, new Set());
          }
          recurrenceIdModifications.get(uidBase)!.add(recurrenceIdTime);
        }
      }
    }
  }

  // DEDUPLICATION FIX: Remove duplicate events and filter out instances that have RECURRENCE-ID modifications
  const deduplicatedEvents: IcsEvent[] = [];
  const seenEventKeys = new Set<string>();

  for (const event of events) {
    // Create a unique key based on UID base (without date suffix) and start time
    // Extract the core UID base - handle Microsoft's complex UID format
    let uidBase = event.uid.split('_')[0]; // Remove date suffix from generated instances

    // Microsoft UIDs often have format: XXXXXXXX01000000000000000
    // We need to match the shorter form from RECURRENCE-ID
    // Extract just the first part before '01000000000000000'
    if (uidBase.includes('01000000000000000')) {
      uidBase = uidBase.replace('01000000000000000', '');
    }

    const eventKey = `${uidBase}_${event.start.toISOString()}`;

    // Silent processing

    // Check if this is a generated instance that has a RECURRENCE-ID modification
    // Convert event start time to YYYYMMDDTHHMMSS format for comparison
    const eventStart = new Date(event.start);
    const eventYear = eventStart.getFullYear();
    const eventMonth = String(eventStart.getMonth() + 1).padStart(2, '0');
    const eventDay = String(eventStart.getDate()).padStart(2, '0');
    const eventHour = String(eventStart.getHours()).padStart(2, '0');
    const eventMinute = String(eventStart.getMinutes()).padStart(2, '0');
    const eventSecond = String(eventStart.getSeconds()).padStart(2, '0');
    const eventDateTimeStr = `${eventYear}${eventMonth}${eventDay}T${eventHour}${eventMinute}${eventSecond}`;

    const hasRecurrenceIdModification = recurrenceIdModifications.has(uidBase) &&
      Array.from(recurrenceIdModifications.get(uidBase)!).some(modTime => {
        // Silent comparison - only log matches

        // Compare just the date/time parts (first 15 characters: YYYYMMDDTHHMMSS)
        const match = modTime.substring(0, 15) === eventDateTimeStr;
        // Silent match processing
        return match;
      });

    if (hasRecurrenceIdModification) {
      continue;
    }

    if (!seenEventKeys.has(eventKey)) {
      seenEventKeys.add(eventKey);
      deduplicatedEvents.push(event);
    } else {
    }
  }

  events = deduplicatedEvents;

  } catch (error) {
    errors.push(`Failed to parse ICS data: ${error}`);
  }





  return { events, errors };
}

/**
 * Parse a single VEVENT block into an event object
 */
function parseEventBlock(lines: string[], rangeStart?: Date, rangeEnd?: Date): IcsEvent[] {
  const eventData: Record<string, string> = {};


  // Track all properties we encounter for debugging
  const allProperties = new Set<string>();

  // Parse each line in the event
  for (const line of lines) {
    if (line.startsWith('BEGIN:') || line.startsWith('END:')) {
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.substring(0, colonIndex);
    const value = line.substring(colonIndex + 1);

    // Handle properties with parameters (e.g., DTSTART;TZID=America/New_York:20231201T090000)
    const semiIndex = key.indexOf(';');
    const propName = semiIndex === -1 ? key : key.substring(0, semiIndex);

    // Track this property
    allProperties.add(propName);

    // For DTSTART and DTEND, preserve the full line including TZID parameters
    if (propName === 'DTSTART' || propName === 'DTEND') {
      eventData[propName] = key + ':' + value; // Preserve full line with TZID
    } else {
      eventData[propName] = value;
    }
  }

  // Log all properties found for this event (disabled for clarity)

  // Check for commonly ignored properties (disabled for clarity)
  // const commonProps = ['DESCRIPTION', 'LOCATION', 'ORGANIZER', 'ATTENDEE', 'CLASS', 'CATEGORIES', 'PRIORITY', 'SEQUENCE', 'RECURRENCE-ID', 'EXDATE', 'EXRULE', 'RDATE', 'ALARM', 'VALARM'];
  // const foundCommonProps = commonProps.filter(prop => allProperties.has(prop));
  // if (foundCommonProps.length > 0) {
  // }

  // Extract required fields
  const uid = eventData['UID'];
  const summary = eventData['SUMMARY'] || 'Busy';
  const dtstart = eventData['DTSTART'];
  const dtend = eventData['DTEND'];
  const status = eventData['STATUS'] || 'CONFIRMED';
  const transparency = eventData['TRANSP'] || 'OPAQUE';

  // Check for cancelled events
  const method = eventData['METHOD'];

  // Detect cancellations - RFC 5545 standard ways:
  // 1. STATUS:CANCELLED - event is cancelled
  // 2. METHOD:CANCEL - cancellation message
  const isCancelled = status === 'CANCELLED' || method === 'CANCEL';

  // IMPORTANT FIX: For RECURRENCE-ID events (modified instances of recurring series),
  // we must use the actual DTSTART date, not the RECURRENCE-ID date.
  // RECURRENCE-ID indicates which instance was modified, but DTSTART contains the new date/time.
  // Handle RECURRENCE-ID modifications

  if (isCancelled) {
    // Skip cancelled events from busy time calculation
    return [];
  }

  // Also check for events that might be effectively cancelled
  // Check for potentially suspicious transparent events marked as busy

  // Get RRULE (will be null for RECURRENCE-ID modified instances)
  const rrule = eventData['RRULE'];

  // Extract EXDATE and RDATE for recurring event handling
  const exdate = eventData['EXDATE'];
  const rdate = eventData['RDATE'];

  if (!uid || !dtstart) {
    return []; // Skip events without required fields
  }

  try {
    const startDate = parseIcsDateTime(dtstart);
    const endDate = dtend ? parseIcsDateTime(dtend) : new Date(startDate.getTime() + 60 * 60 * 1000); // Default 1 hour

    const baseEvent: IcsEvent = {
      uid,
      summary,
      start: startDate,
      end: endDate,
      status,
      transparency,
      dtstart, // Preserve original timezone info for debugging
      dtend    // Preserve original timezone info for debugging
    };

    // If there's an RRULE, expand the recurring events with EXDATE/RDATE support
    if (rrule) {
      // Debug logging for recurring events - only log if expansion seems wrong
      const recurringEvents = expandRecurringEvent(baseEvent, rrule, rangeStart, rangeEnd);

      // Only log details if we got suspiciously few instances for a weekly event
      if (rrule.includes('FREQ=WEEKLY') && recurringEvents.length <= 2 && rangeStart && rangeEnd) {
        const rangeDays = (rangeEnd.getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000);
        const expectedInstances = Math.floor(rangeDays / 7); // Rough estimate
        if (expectedInstances > 2) {
          console.log(`⚠️ WEEKLY event expanded to only ${recurringEvents.length} instances (expected ~${expectedInstances})`);
          console.log(`   Summary: "${summary}"`);
          console.log(`   RRULE: ${rrule}`);
          console.log(`   Base event start: ${startDate.toISOString()}`);
          console.log(`   Range: ${rangeStart?.toISOString()} to ${rangeEnd?.toISOString()}`);
          console.log(`   Expanded instances:`, recurringEvents.map(e => e.start.toISOString()));
        }
      }

      // Always log total for reference
      console.log(`🔁 Recurring event found: "${summary}" (${uid})`);
      console.log(`   RRULE: ${rrule}`);
      console.log(`   Expanded to ${recurringEvents.length} instances`);

      // Apply EXDATE filtering (remove exception dates)
      let filteredEvents = recurringEvents;
      if (exdate) {
        const exceptionDates = parseExceptionDates(exdate);
        filteredEvents = applyExceptionDates(recurringEvents, exceptionDates);
        console.log(`   After EXDATE: ${filteredEvents.length} instances`);
      }

      // Apply RDATE additions (add extra occurrence dates)
      if (rdate) {
        const additionalDates = parseRecurrenceDates(rdate);
        const additionalEvents = createAdditionalEvents(baseEvent, additionalDates, rangeStart, rangeEnd);
        filteredEvents.push(...additionalEvents);
        console.log(`   After RDATE: ${filteredEvents.length} instances`);
      }

      return filteredEvents;
    }

    return [baseEvent];
  } catch {
    throw new Error(`Invalid date format in event ${uid}`);
  }
}
