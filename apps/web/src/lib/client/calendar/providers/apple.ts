// Apple CalDAV Provider

import { DAVClient } from 'tsdav';
import { TimeSlot } from '@/types';
import { getNotificationMinutes } from '@/lib/constants';

export async function getAppleBusyTimes(
  appleId: string,
  appSpecificPassword: string,
  startTime: string,
  endTime: string
): Promise<TimeSlot[]> {
  try {
    console.log(`🍎 Apple CalDAV: Fetching busy times for ${appleId} from ${startTime} to ${endTime}`);

    const client = new DAVClient({
      serverUrl: 'https://caldav.icloud.com',
      credentials: {
        username: appleId,
        password: appSpecificPassword,
      },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    });

    // Connect to CalDAV server
    await client.login();
    console.log(`🍎 Apple CalDAV: Successfully connected to iCloud`);

    // Get calendar home
    const calendars = await client.fetchCalendars();
    console.log(`🍎 Apple CalDAV: Found ${calendars.length} calendars: ${calendars.map(c => c.displayName).join(', ')}`);

    const busyTimes: TimeSlot[] = [];

    // Query free/busy for each calendar
    for (const calendar of calendars) {
      try {
        console.log(`🍎 Apple CalDAV: Fetching events from calendar "${calendar.displayName}"`);

        // Log the exact query we're about to make
        console.log(`🍎 Apple CalDAV: Querying calendar "${calendar.displayName}" with timeRange:`, {
          start: startTime,
          end: endTime,
          calendarUrl: calendar.url
        });

        // Fetch calendar events instead of free/busy
        const events = await client.fetchCalendarObjects({
          calendar,
          timeRange: {
            start: startTime,
            end: endTime,
          },
        });

        console.log(`🍎 Apple CalDAV: Calendar "${calendar.displayName}" returned ${events.length} events`);

        // If no events, try fetching without time range to see if there are ANY events
        if (events.length === 0) {
          console.log(`🍎 Apple CalDAV: No events found with time range, trying without time range...`);
          try {
            const allEvents = await client.fetchCalendarObjects({
              calendar,
            });
            console.log(`🍎 Apple CalDAV: Calendar "${calendar.displayName}" has ${allEvents.length} total events (without time filter)`);

            // Log a sample of events if any exist
            if (allEvents.length > 0) {
              console.log(`🍎 Apple CalDAV: Sample event data from calendar "${calendar.displayName}":`, allEvents[0]);
            }
          } catch (error) {
            console.log(`🍎 Apple CalDAV: Error fetching all events from "${calendar.displayName}":`, error);
          }
        }

        // Parse events to extract busy times
        for (const event of events) {
          if (event.data) {
            console.log(`🍎 Apple CalDAV: Raw iCal data for event:\n---\n${event.data}\n---`);
            const busyPeriods = parseCalendarEvents(event.data, new Date(startTime), new Date(endTime));
            console.log(`🍎 Apple CalDAV: Parsed ${busyPeriods.length} busy periods from this event:`, busyPeriods);
            busyTimes.push(...busyPeriods);
          }
        }
      } catch (calendarError) {
        console.warn(`🍎 Apple CalDAV: Error fetching calendar ${calendar.displayName}:`, calendarError);
        // Continue with other calendars
      }
    }

    console.log(`🍎 Apple CalDAV: Final result - Found ${busyTimes.length} total busy periods:`, busyTimes);
    return busyTimes;
  } catch (error) {
    console.error('Error fetching Apple busy times:', error);
    return [];
  }
}

function parseCalendarEvents(icalData: string, startTime: Date, endTime: Date): TimeSlot[] {
  const busyTimes: TimeSlot[] = [];

  try {
    console.log(`🍎 Apple CalDAV: Parsing iCal data, looking for events between ${startTime.toISOString()} and ${endTime.toISOString()}`);

    // Parse iCalendar VEVENT format
    const lines = icalData.split('\n');
    let currentEvent: Record<string, string> = {};
    let currentEventProps: Record<string, { value: string; params: Record<string, string> }> = {};
    let inEvent = false;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine === 'BEGIN:VEVENT') {
        inEvent = true;
        currentEvent = {};
        currentEventProps = {};
        console.log(`🍎 Apple CalDAV: Found VEVENT start`);
      } else if (trimmedLine === 'END:VEVENT' && inEvent) {
        inEvent = false;
        console.log(`🍎 Apple CalDAV: Found VEVENT end, processing event:`, currentEvent);

        // Process the event if it has start and end times
        if (currentEvent.DTSTART && currentEvent.DTEND) {
          console.log(`🍎 Apple CalDAV: Event has DTSTART: "${currentEvent.DTSTART}" and DTEND: "${currentEvent.DTEND}"`);

          // Check for timezone information in the parsed properties
          const startTzInfo = currentEventProps.DTSTART?.params?.TZID || 'UTC';
          const endTzInfo = currentEventProps.DTEND?.params?.TZID || 'UTC';
          console.log(`🍎 Apple CalDAV: Timezone info - DTSTART TZID: "${startTzInfo}", DTEND TZID: "${endTzInfo}"`);

          const eventStartStr = parseICalDateTime(currentEvent.DTSTART);
          const eventEndStr = parseICalDateTime(currentEvent.DTEND);

          console.log(`🍎 Apple CalDAV: Parsed times - Start: "${eventStartStr}", End: "${eventEndStr}"`);

          if (eventStartStr && eventEndStr) {
            const eventStart = new Date(eventStartStr);
            const eventEnd = new Date(eventEndStr);
            const startTimeDate = new Date(startTime);
            const endTimeDate = new Date(endTime);

            console.log(`🍎 Apple CalDAV: Event dates - Start: ${eventStart.toISOString()}, End: ${eventEnd.toISOString()}`);
            console.log(`🍎 Apple CalDAV: Query range - Start: ${startTimeDate.toISOString()}, End: ${endTimeDate.toISOString()}`);

            // Check if event overlaps with requested time range
            const overlaps = eventStart < endTimeDate && eventEnd > startTimeDate;
            console.log(`🍎 Apple CalDAV: Event overlaps with query range: ${overlaps}`);

            if (overlaps) {
              const busyPeriod = {
                start: eventStart.toISOString(),
                end: eventEnd.toISOString(),
              };
              console.log(`🍎 Apple CalDAV: Adding busy period:`, busyPeriod);
              busyTimes.push(busyPeriod);
            } else {
              console.log(`🍎 Apple CalDAV: Event outside query range, skipping`);
            }
          } else {
            console.log(`🍎 Apple CalDAV: Failed to parse event times, skipping event`);
          }
        } else {
          console.log(`🍎 Apple CalDAV: Event missing DTSTART or DTEND, skipping`);
        }
      } else if (inEvent && trimmedLine.includes(':')) {
        // Parse property with potential parameters
        const colonIndex = trimmedLine.indexOf(':');
        const propPart = trimmedLine.substring(0, colonIndex);
        const valuePart = trimmedLine.substring(colonIndex + 1);

        // Split property name and parameters
        const [propName, ...paramParts] = propPart.split(';');
        const params: Record<string, string> = {};

        // Parse parameters
        for (const paramPart of paramParts) {
          const [paramName, paramValue] = paramPart.split('=');
          if (paramName && paramValue) {
            params[paramName] = paramValue;
          }
        }

        // Store both old format and new format
        currentEvent[propName] = valuePart;
        currentEventProps[propName] = { value: valuePart, params };

        if (propName === 'DTSTART' || propName === 'DTEND') {
          console.log(`🍎 Apple CalDAV: Found ${propName} property: "${trimmedLine}"`);
          console.log(`🍎 Apple CalDAV: Parsed ${propName} - Value: "${valuePart}", Params:`, params);
        }
      }
    }

    console.log(`🍎 Apple CalDAV: Finished parsing, found ${busyTimes.length} busy periods`);
  } catch (error) {
    console.error('🍎 Apple CalDAV: Error parsing calendar events:', error);
  }

  return busyTimes;
}

// Currently unused but may be needed for future Apple calendar integration
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function parseVFreeBusy(vfreebusyData: string): TimeSlot[] {
  const busyTimes: TimeSlot[] = [];

  try {
    // Parse iCalendar VFREEBUSY format
    const lines = vfreebusyData.split('\n');

    for (const line of lines) {
      if (line.startsWith('FREEBUSY;FBTYPE=BUSY:')) {
        const busyData = line.split('FREEBUSY;FBTYPE=BUSY:')[1];
        const periods = busyData.split(',');

        for (const period of periods) {
          if (period.includes('/')) {
            const [start, end] = period.split('/');

            // Convert from iCalendar format to ISO datetime
            const startDate = parseICalDateTime(start);
            const endDate = parseICalDateTime(end);

            if (startDate && endDate) {
              busyTimes.push({
                start: startDate,
                end: endDate,
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error parsing VFREEBUSY data:', error);
  }

  return busyTimes;
}

function parseICalDateTime(icalDate: string): string | null {
  try {
    console.log(`🍎 Apple CalDAV: Parsing iCal date: "${icalDate}"`);

    // iCalendar format: 20250120T140000Z or 20250120T140000
    // Convert to ISO format: 2025-01-20T14:00:00Z

    if (icalDate.length < 15) {
      console.log(`🍎 Apple CalDAV: iCal date too short (${icalDate.length} chars), expected at least 15`);
      return null;
    }

    const year = icalDate.substring(0, 4);
    const month = icalDate.substring(4, 6);
    const day = icalDate.substring(6, 8);
    const hour = icalDate.substring(9, 11);
    const minute = icalDate.substring(11, 13);
    const second = icalDate.substring(13, 15);

    // Check if it's UTC (ends with Z) or local time
    const isUtc = icalDate.endsWith('Z');
    const timezone = isUtc ? 'Z' : 'Z'; // For now, force everything to UTC - we'll improve this later

    const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}${timezone}`;
    console.log(`🍎 Apple CalDAV: Converted "${icalDate}" -> "${isoString}" (detected UTC: ${isUtc})`);

    // Validate the result by trying to create a Date object
    const testDate = new Date(isoString);
    if (isNaN(testDate.getTime())) {
      console.log(`🍎 Apple CalDAV: Invalid date result: "${isoString}"`);
      return null;
    }

    return isoString;
  } catch (error) {
    console.error('🍎 Apple CalDAV: Error parsing iCal date:', icalDate, error);
    return null;
  }
}

export async function testAppleConnection(
  appleId: string,
  appSpecificPassword: string
): Promise<boolean> {
  try {
    const client = new DAVClient({
      serverUrl: 'https://caldav.icloud.com',
      credentials: {
        username: appleId,
        password: appSpecificPassword,
      },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    });

    await client.login();
    const calendars = await client.fetchCalendars();

    console.log(`✅ Apple CalDAV connection successful. Found ${calendars.length} calendars.`);
    return true;
  } catch (error) {
    console.error('❌ Apple CalDAV connection failed:', error);
    return false;
  }
}

interface CalendarEvent {
  title: string;
  start: string;
  end: string;
  location?: string;
  attendees?: string[];
  description?: string;
  eventType?: 'video' | 'in-person';
}

export function generateAppleCalendarFile(event: CalendarEvent): string {
  // Generate .ics file content for Apple Calendar
  const formatDateForICal = (isoDate: string) => {
    return new Date(isoDate).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const startFormatted = formatDateForICal(event.start);
  const endFormatted = formatDateForICal(event.end);
  const uid = `${Date.now()}@calconnect.app`;
  const notificationMinutes = getNotificationMinutes();

  let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//CalConnect//CalConnect Event//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${uid}
DTSTART:${startFormatted}
DTEND:${endFormatted}
SUMMARY:${event.title}`;

  if (event.description) {
    // Escape special characters for iCal format
    const escapedDescription = event.description.replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n');
    icsContent += `\nDESCRIPTION:${escapedDescription}`;
  }

  if (event.location) {
    icsContent += `\nLOCATION:${event.location}`;
  }

  if (event.attendees && event.attendees.length > 0) {
    for (const attendee of event.attendees) {
      icsContent += `\nATTENDEE:mailto:${attendee}`;
    }
  }

  // Add VALARM for 10-minute notification
  icsContent += `\nBEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Event reminder
TRIGGER:-PT${notificationMinutes}M
END:VALARM`;

  icsContent += `\nSTATUS:CONFIRMED
SEQUENCE:0
CREATED:${formatDateForICal(new Date().toISOString())}
LAST-MODIFIED:${formatDateForICal(new Date().toISOString())}
DTSTAMP:${formatDateForICal(new Date().toISOString())}
END:VEVENT
END:VCALENDAR`;

  return icsContent;
}

export async function getAppleCalendarList(
  appleId: string,
  appSpecificPassword: string
): Promise<Array<{
  url: string;
  displayName: string;
}>> {
  try {
    const client = new DAVClient({
      serverUrl: 'https://caldav.icloud.com',
      credentials: {
        username: appleId,
        password: appSpecificPassword,
      },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    });

    await client.login();
    const calendars = await client.fetchCalendars();

    return calendars.map(calendar => ({
      url: calendar.url,
      displayName: typeof calendar.displayName === 'string' ? calendar.displayName : 'Unnamed Calendar',
    }));
  } catch (error) {
    console.error('Error fetching Apple calendar list:', error);
    return [];
  }
}