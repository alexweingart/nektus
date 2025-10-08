/**
 * Timezone conversion and date parsing utilities
 */

/**
 * Convert Windows/Outlook timezone names to IANA timezone identifiers
 * Based on Unicode CLDR windowsZones.xml mappings
 */
export function convertToIANATimezone(windowsTzid: string): string | null {
  const timezoneMap: Record<string, string> = {
    // UTC and GMT zones
    'UTC': 'Etc/UTC',
    'UTC-11': 'Etc/GMT+11',
    'UTC-09': 'Etc/GMT+9',
    'UTC-08': 'Etc/GMT+8',
    'UTC-02': 'Etc/GMT+2',
    'UTC+12': 'Etc/GMT-12',
    'UTC+13': 'Etc/GMT-13',

    // Americas
    'Dateline Standard Time': 'Etc/GMT+12',
    'Hawaiian Standard Time': 'Pacific/Honolulu',
    'Alaskan Standard Time': 'America/Anchorage',
    'Pacific Standard Time': 'America/Los_Angeles',
    'Pacific Daylight Time': 'America/Los_Angeles',
    'Pacific Standard Time (Mexico)': 'America/Tijuana',
    'US Mountain Standard Time': 'America/Phoenix',
    'Mountain Standard Time': 'America/Denver',
    'Mountain Daylight Time': 'America/Denver',
    'Mountain Standard Time (Mexico)': 'America/Mazatlan',
    'Yukon Standard Time': 'America/Whitehorse',
    'Central America Standard Time': 'America/Guatemala',
    'Central Standard Time': 'America/Chicago',
    'Central Daylight Time': 'America/Chicago',
    'Central Standard Time (Mexico)': 'America/Mexico_City',
    'Canada Central Standard Time': 'America/Regina',
    'SA Pacific Standard Time': 'America/Bogota',
    'Eastern Standard Time': 'America/New_York',
    'Eastern Daylight Time': 'America/New_York',
    'Eastern Standard Time (Mexico)': 'America/Cancun',
    'US Eastern Standard Time': 'America/Indianapolis',
    'Venezuela Standard Time': 'America/Caracas',
    'Paraguay Standard Time': 'America/Asuncion',
    'Atlantic Standard Time': 'America/Halifax',
    'Central Brazilian Standard Time': 'America/Cuiaba',
    'SA Western Standard Time': 'America/La_Paz',
    'Pacific SA Standard Time': 'America/Santiago',
    'Newfoundland Standard Time': 'America/St_Johns',
    'Tocantins Standard Time': 'America/Araguaina',
    'SA Eastern Standard Time': 'America/Cayenne',
    'Argentina Standard Time': 'America/Buenos_Aires',
    'Montevideo Standard Time': 'America/Montevideo',
    'Bahia Standard Time': 'America/Bahia',
    'E. South America Standard Time': 'America/Sao_Paulo',
    'Greenland Standard Time': 'America/Godthab',
    'Saint Pierre Standard Time': 'America/Miquelon',
    'Mid-Atlantic Standard Time': 'Etc/GMT+2',
    'Azores Standard Time': 'Atlantic/Azores',
    'Cape Verde Standard Time': 'Atlantic/Cape_Verde',
    'Cuba Standard Time': 'America/Havana',
    'Haiti Standard Time': 'America/Port-au-Prince',
    'Turks And Caicos Standard Time': 'America/Grand_Turk',
    'Easter Island Standard Time': 'Pacific/Easter',
    'Marquesas Standard Time': 'Pacific/Marquesas',
    'Aleutian Standard Time': 'America/Adak',
    'Magallanes Standard Time': 'America/Punta_Arenas',

    // Europe
    'GMT Standard Time': 'Europe/London',
    'Greenwich Standard Time': 'Europe/London',
    'W. Europe Standard Time': 'Europe/Berlin',
    'Central Europe Standard Time': 'Europe/Budapest',
    'Romance Standard Time': 'Europe/Paris',
    'Central European Standard Time': 'Europe/Warsaw',
    'W. Central Africa Standard Time': 'Africa/Lagos',
    'GTB Standard Time': 'Europe/Bucharest',
    'Middle East Standard Time': 'Asia/Beirut',
    'Egypt Standard Time': 'Africa/Cairo',
    'E. Europe Standard Time': 'Europe/Chisinau',
    'Syria Standard Time': 'Asia/Damascus',
    'West Bank Standard Time': 'Asia/Hebron',
    'South Africa Standard Time': 'Africa/Johannesburg',
    'FLE Standard Time': 'Europe/Kiev',
    'Israel Standard Time': 'Asia/Jerusalem',
    'Jordan Standard Time': 'Asia/Amman',
    'Kaliningrad Standard Time': 'Europe/Kaliningrad',
    'Sao Tome Standard Time': 'Africa/Sao_Tome',
    'Libya Standard Time': 'Africa/Tripoli',
    'Namibia Standard Time': 'Africa/Windhoek',
    'Arabic Standard Time': 'Asia/Baghdad',
    'Turkey Standard Time': 'Europe/Istanbul',
    'Belarus Standard Time': 'Europe/Minsk',
    'Russian Standard Time': 'Europe/Moscow',
    'E. Africa Standard Time': 'Africa/Nairobi',
    'Volgograd Standard Time': 'Europe/Volgograd',
    'Iran Standard Time': 'Asia/Tehran',
    'Arabian Standard Time': 'Asia/Dubai',
    'Astrakhan Standard Time': 'Europe/Astrakhan',
    'Azerbaijan Standard Time': 'Asia/Baku',
    'Russia Time Zone 3': 'Europe/Samara',
    'Mauritius Standard Time': 'Indian/Mauritius',
    'Saratov Standard Time': 'Europe/Saratov',
    'Georgian Standard Time': 'Asia/Tbilisi',
    'Caucasus Standard Time': 'Asia/Yerevan',
    'Afghanistan Standard Time': 'Asia/Kabul',
    'West Asia Standard Time': 'Asia/Tashkent',
    'Qyzylorda Standard Time': 'Asia/Qyzylorda',
    'Ekaterinburg Standard Time': 'Asia/Yekaterinburg',
    'Pakistan Standard Time': 'Asia/Karachi',
    'India Standard Time': 'Asia/Calcutta',
    'Sri Lanka Standard Time': 'Asia/Colombo',
    'Nepal Standard Time': 'Asia/Kathmandu',
    'Central Asia Standard Time': 'Asia/Almaty',
    'Bangladesh Standard Time': 'Asia/Dhaka',
    'Omsk Standard Time': 'Asia/Omsk',
    'Myanmar Standard Time': 'Asia/Rangoon',
    'SE Asia Standard Time': 'Asia/Bangkok',
    'Altai Standard Time': 'Asia/Barnaul',
    'W. Mongolia Standard Time': 'Asia/Hovd',
    'North Asia Standard Time': 'Asia/Krasnoyarsk',
    'N. Central Asia Standard Time': 'Asia/Novosibirsk',
    'Tomsk Standard Time': 'Asia/Tomsk',
    'China Standard Time': 'Asia/Shanghai',
    'North Asia East Standard Time': 'Asia/Irkutsk',
    'Singapore Standard Time': 'Asia/Singapore',
    'W. Australia Standard Time': 'Australia/Perth',
    'Taipei Standard Time': 'Asia/Taipei',
    'Ulaanbaatar Standard Time': 'Asia/Ulaanbaatar',
    'Aus Central W. Standard Time': 'Australia/Eucla',
    'Transbaikal Standard Time': 'Asia/Chita',
    'Tokyo Standard Time': 'Asia/Tokyo',
    'Japan Standard Time': 'Asia/Tokyo',
    'North Korea Standard Time': 'Asia/Pyongyang',
    'Korea Standard Time': 'Asia/Seoul',
    'Yakutsk Standard Time': 'Asia/Yakutsk',
    'Cen. Australia Standard Time': 'Australia/Adelaide',
    'AUS Central Standard Time': 'Australia/Darwin',
    'E. Australia Standard Time': 'Australia/Brisbane',
    'AUS Eastern Standard Time': 'Australia/Sydney',
    'West Pacific Standard Time': 'Pacific/Port_Moresby',
    'Tasmania Standard Time': 'Australia/Hobart',
    'Vladivostok Standard Time': 'Asia/Vladivostok',
    'Lord Howe Standard Time': 'Australia/Lord_Howe',
    'Bougainville Standard Time': 'Pacific/Bougainville',
    'Russia Time Zone 10': 'Asia/Srednekolymsk',
    'Magadan Standard Time': 'Asia/Magadan',
    'Norfolk Standard Time': 'Pacific/Norfolk',
    'Sakhalin Standard Time': 'Asia/Sakhalin',
    'Central Pacific Standard Time': 'Pacific/Guadalcanal',
    'Russia Time Zone 11': 'Asia/Kamchatka',
    'New Zealand Standard Time': 'Pacific/Auckland',
    'Fiji Standard Time': 'Pacific/Fiji',
    'Chatham Islands Standard Time': 'Pacific/Chatham',
    'Tonga Standard Time': 'Pacific/Tongatapu',
    'Samoa Standard Time': 'Pacific/Apia',
    'Line Islands Standard Time': 'Pacific/Kiritimati',

    // Africa
    'Morocco Standard Time': 'Africa/Casablanca',
    'Sudan Standard Time': 'Africa/Khartoum',

    // Backwards compatibility for common variations
    'Australian Eastern Standard Time': 'Australia/Sydney',
    'AUS Eastern Daylight Time': 'Australia/Sydney',
    'Central European Summer Time': 'Europe/Berlin',
    'Eastern European Summer Time': 'Europe/Athens',
    'Western European Summer Time': 'Europe/London',
    'British Summer Time': 'Europe/London',
  };

  // Also check with "(Standard Time)" removed if not found
  const normalizedTzid = windowsTzid.replace(' (Standard Time)', ' Standard Time');

  return timezoneMap[windowsTzid] ?? timezoneMap[normalizedTzid] ?? null;
}

/**
 * Convert datetime from any timezone to UTC using simple, robust approach
 */
export function convertTimezoneToUTC(year: number, month: number, day: number, hour: number, minute: number, second: number, tzid: string): Date {
  const ianaTimezone = convertToIANATimezone(tzid);

  if (!ianaTimezone) {
    // If we can't map the timezone, default to Eastern since that's what most Outlook events use
    return convertTimezoneToUTC(year, month, day, hour, minute, second, 'Eastern Standard Time');
  }

  try {
    // Simple approach: Create a date string that explicitly states the timezone
    // and let JavaScript's Date constructor handle the conversion
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;

    // Method 1: Use Intl.DateTimeFormat to get the timezone offset
    const tempDate = new Date(`${dateString}Z`); // Create as UTC first

    try {
      // Get what this date/time would be in the target timezone
      const formatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: ianaTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      const parts = formatter.formatToParts(tempDate);
      const tzYear = parseInt(parts.find(p => p.type === 'year')?.value || '0');
      const tzMonth = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1;
      const tzDay = parseInt(parts.find(p => p.type === 'day')?.value || '0');
      const tzHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
      const tzMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
      const tzSecond = parseInt(parts.find(p => p.type === 'second')?.value || '0');

      // Calculate the offset between what we want and what we got
      const wantedTime = new Date(Date.UTC(year, month, day, hour, minute, second));
      const actualTime = new Date(Date.UTC(tzYear, tzMonth, tzDay, tzHour, tzMinute, tzSecond));

      const offsetMs = wantedTime.getTime() - actualTime.getTime();
      const utcTime = new Date(tempDate.getTime() + offsetMs);

      return utcTime;

    } catch {

      // Method 2: Fallback to hardcoded offsets for common timezones
      const commonOffsets: Record<string, number> = {
        'America/New_York': -5, // EST
        'America/Los_Angeles': -8, // PST
        'America/Chicago': -6, // CST
        'America/Denver': -7, // MST
        'Europe/London': 0, // GMT
        'Europe/Berlin': 1, // CET
        'Europe/Paris': 1, // CET
        'Asia/Tokyo': 9, // JST
      };

      const offsetHours = commonOffsets[ianaTimezone];
      if (offsetHours !== undefined) {
        // Account for daylight saving time (rough approximation)
        const isDST = month >= 2 && month <= 10; // March through November
        const actualOffset = isDST && (ianaTimezone.includes('America') || ianaTimezone.includes('Europe'))
          ? offsetHours + 1
          : offsetHours;

        const utcTime = new Date(Date.UTC(year, month, day, hour - actualOffset, minute, second));

        return utcTime;
      }

      throw new Error(`No fallback available for ${ianaTimezone}`);
    }

  } catch {
    // Final fallback: assume UTC
    const utcTime = new Date(Date.UTC(year, month, day, hour, minute, second));

    return utcTime;
  }
}


/**
 * Parse ICS date/time format to JavaScript Date with proper timezone handling
 * Supports formats like:
 * - DTSTART:20240923T113000Z (UTC)
 * - DTSTART:20240923T113000 (floating time)
 * - DTSTART;TZID=America/Los_Angeles:20240923T113000 (timezone-specific)
 */
export function parseIcsDateTime(icsDateTime: string): Date {
  let actualDateTime = icsDateTime;
  let tzid: string | null = null;

  // Check if this is a full property line (includes property name)
  if (icsDateTime.includes(':')) {
    const parts = icsDateTime.split(':');

    // If we have multiple colons, rejoin the datetime part
    if (parts.length > 2) {
      actualDateTime = parts.slice(1).join(':');
    } else {
      actualDateTime = parts[1];
    }

    // Extract TZID parameter from the property part
    const propertyPart = parts[0];
    if (propertyPart.includes('TZID=')) {
      const tzidMatch = propertyPart.match(/TZID=([^;]+)/);
      if (tzidMatch) {
        tzid = tzidMatch[1];
      }
    }
  }

  // Check if this is a UTC time (ends with Z)
  const isUtc = actualDateTime.endsWith('Z');

  // Remove Z suffix and T separator for parsing
  const cleanDateTime = actualDateTime.replace(/Z$/, '').replace(/T/, '');

  // Handle different date formats
  if (cleanDateTime.length === 8) {
    // YYYYMMDD (all-day event)
    const year = parseInt(cleanDateTime.substring(0, 4));
    const month = parseInt(cleanDateTime.substring(4, 6)) - 1; // Month is 0-indexed
    const day = parseInt(cleanDateTime.substring(6, 8));

    const date = isUtc
      ? new Date(Date.UTC(year, month, day))
      : new Date(year, month, day);

    return date;

  } else if (cleanDateTime.length >= 14) {
    // YYYYMMDDHHMMSS
    const year = parseInt(cleanDateTime.substring(0, 4));
    const month = parseInt(cleanDateTime.substring(4, 6)) - 1;
    const day = parseInt(cleanDateTime.substring(6, 8));
    const hour = parseInt(cleanDateTime.substring(8, 10));
    const minute = parseInt(cleanDateTime.substring(10, 12));
    const second = parseInt(cleanDateTime.substring(12, 14)) || 0;

    let date: Date;

    if (isUtc) {
      // UTC time - create directly
      date = new Date(Date.UTC(year, month, day, hour, minute, second));
    } else if (tzid) {
      // Timezone-specific time - convert to UTC
      date = convertTimezoneToUTC(year, month, day, hour, minute, second, tzid);
    } else {
      // Floating time - treat as local
      date = new Date(year, month, day, hour, minute, second);
    }

    return date;
  }

  throw new Error(`Unsupported date format: ${icsDateTime}`);
}
