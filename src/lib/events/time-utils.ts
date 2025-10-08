/**
 * Robust timezone utilities for consistent date/time handling across the application.
 * All functions ensure that times are properly converted to/from user timezones.
 */

/**
 * Converts a UTC date to represent the same moment in the user's timezone.
 * This is useful when you have a UTC date and want to know what hour/minute it represents
 * in the user's local time.
 */
export function getUserTimezoneDate(utcDate: Date, userTimezone: string): Date {
  if (!userTimezone) {
    return utcDate;
  }

  try {
    // Use Intl.DateTimeFormat to get the date components in the user's timezone
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: userTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = formatter.format(utcDate);
    // Format is "YYYY-MM-DD HH:mm:ss"
    const [datePart, timePart] = parts.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute, second] = timePart.split(':').map(Number);

    // Create a new date representing this time in the local timezone
    return new Date(year, month - 1, day, hour, minute, second);
  } catch (error) {
    console.warn(`Failed to convert date to user timezone ${userTimezone}:`, error);
    return utcDate;
  }
}

/**
 * Creates a UTC date that represents a specific time in the user's timezone.
 * This is useful when you want to say "5 PM in the user's timezone" and get the UTC equivalent.
 */
export function createUserTimezoneDate(
  year: number,
  month: number, // 0-based (January = 0)
  day: number,
  hour: number = 0,
  minute: number = 0,
  second: number = 0,
  userTimezone: string
): Date {
  if (!userTimezone) {
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }

  try {
    // Create date string in format that can be parsed consistently
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const hourStr = String(hour).padStart(2, '0');
    const minuteStr = String(minute).padStart(2, '0');
    const secondStr = String(second).padStart(2, '0');

    // Use the inverse of getUserTimezoneDate
    // We want: "what UTC time, when converted to userTimezone, shows our target time?"

    // Start with an educated guess: create the time as if it were UTC
    const testUTC = new Date(`${year}-${monthStr}-${dayStr}T${hourStr}:${minuteStr}:${secondStr}.000Z`);

    // See what this UTC time looks like in the user's timezone
    const userTzTime = getUserTimezoneDate(testUTC, userTimezone);

    // Calculate how far off we are
    const targetTime = new Date(year, month, day, hour, minute, second);
    const offsetMs = targetTime.getTime() - userTzTime.getTime();

    // Adjust the UTC time by the offset
    const result = new Date(testUTC.getTime() + offsetMs);


    return result;
  } catch (error) {
    console.warn(`Failed to create date in user timezone ${userTimezone}:`, error);
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }
}

/**
 * Gets the current time as it appears in the user's timezone.
 * Useful for "what time is it now for the user?"
 */
export function getCurrentTimeInUserTimezone(userTimezone: string): Date {
  return getUserTimezoneDate(new Date(), userTimezone);
}

/**
 * Gets midnight tomorrow in the user's timezone, converted to UTC.
 * This is the most common operation for scheduling - "when does tomorrow start for the user?"
 */
export function getMidnightTomorrowInUserTimezone(userTimezone: string): Date {
  const now = new Date();

  // Get what "today" is in the user's timezone
  const todayInUserTz = getUserTimezoneDate(now, userTimezone);

  // Calculate tomorrow's date components
  const tomorrowYear = todayInUserTz.getFullYear();
  const tomorrowMonth = todayInUserTz.getMonth(); // Already 0-based
  const tomorrowDay = todayInUserTz.getDate() + 1;

  // Create midnight tomorrow in the user's timezone using the existing function
  const result = createUserTimezoneDate(
    tomorrowYear,
    tomorrowMonth,
    tomorrowDay,
    0, 0, 0, // midnight
    userTimezone
  );


  return result;
}

/**
 * Extract hour and minute from a UTC date as they appear in user's timezone.
 * Useful for checking time windows like "is this between 5 PM and 8 PM for the user?"
 */
export function getHourMinuteInUserTimezone(utcDate: Date, userTimezone: string): { hour: number, minute: number } {
  if (!userTimezone) {
    return { hour: utcDate.getHours(), minute: utcDate.getMinutes() };
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });

    const parts = formatter.formatToParts(utcDate);
    const hour = parseInt(parts.find(part => part.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(part => part.type === 'minute')?.value || '0');

    return { hour, minute };
  } catch (error) {
    console.warn(`Failed to get hour/minute in user timezone ${userTimezone}:`, error);
    return { hour: utcDate.getHours(), minute: utcDate.getMinutes() };
  }
}

/**
 * Format a date for display with weekday and time
 */
export function formatEventDisplayTime(startTime: Date, timezone: string = 'America/Los_Angeles'): string {
  return startTime.toLocaleString('en-US', {
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone
  });
}

/**
 * Format a time range string
 */
export function formatTimeRange(start: Date, end: Date): string {
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  const startTimeStr = start.toLocaleTimeString('en-US', timeOptions);
  const endTimeStr = end.toLocaleTimeString('en-US', timeOptions);
  return `${startTimeStr} - ${endTimeStr}`;
}

/**
 * Convert time string (HH:MM) to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Parse time string to hour and minute components
 */
export function parseTimeString(timeStr: string): { hour: number; minute: number } {
  const [hourStr, minuteStr] = timeStr.split(':');
  return { hour: parseInt(hourStr), minute: parseInt(minuteStr) };
}

/**
 * Get day of week from Date object
 */
export function getDayOfWeek(date: Date): 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
  return days[date.getDay()];
}

/**
 * Convert minutes since midnight to time string (HH:MM)
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Get slot duration in minutes
 */
export function getSlotDurationMinutes(slot: { start: string; end: string }): number {
  const start = new Date(slot.start);
  const end = new Date(slot.end);
  return (end.getTime() - start.getTime()) / (1000 * 60);
}

/**
 * Convert days to milliseconds
 */
export function DAYS_TO_MS(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

/**
 * Format event time into individual components and combined string
 * Useful for building flexible time displays
 */
export function formatEventTimeComponents(date: Date, timezone: string): {
  dayName: string;
  time: string;
  date: string;
  formatted: string;
} {
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone });
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone
  });
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: timezone });

  return {
    dayName,
    time,
    date: dateStr,
    formatted: `${dayName}, ${dateStr} at ${time}`
  };
}

/**
 * Get timezone offset string (e.g., "-07:00", "+00:00")
 */
export function getTimezoneOffsetString(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'longOffset'
    });

    const parts = formatter.formatToParts(date);
    const offsetPart = parts.find(part => part.type === 'timeZoneName');

    if (offsetPart && offsetPart.value.startsWith('GMT')) {
      // Extract offset from "GMT-07:00" or "GMT+00:00"
      const offset = offsetPart.value.replace('GMT', '');
      return offset;
    }

    // Fallback: manually calculate offset
    const utcTime = date.getTime();
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    const localTime = tzDate.getTime();

    // Get local timezone offset to convert tzDate back to proper UTC equivalent
    const localOffset = tzDate.getTimezoneOffset() * 60000;
    const adjustedTzTime = localTime + localOffset;

    const offsetMs = adjustedTzTime - utcTime;
    const offsetMinutes = offsetMs / 60000;

    const hours = Math.floor(Math.abs(offsetMinutes) / 60);
    const mins = Math.abs(offsetMinutes) % 60;
    const sign = offsetMinutes >= 0 ? '+' : '-';

    return `${sign}${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  } catch (error) {
    console.warn(`Failed to calculate timezone offset for ${timezone}:`, error);
    return '+00:00'; // Fallback to UTC
  }
}