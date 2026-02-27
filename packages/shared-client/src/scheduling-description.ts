/**
 * Shared calendar event description builder for Nektus.
 *
 * Produces a standardized description used by all scheduling paths
 * (Web Smart Schedule, Web AI Schedule, iOS Smart Schedule, iOS AI Schedule).
 */

export interface CalendarDescriptionParams {
  /** 'video' or 'in-person' */
  eventType: 'video' | 'in-person';
  /** Contact / attendee name */
  contactName: string;
  /** Travel buffer (for in-person events) */
  travelBuffer?: { beforeMinutes: number; afterMinutes: number };
  /** Actual meeting start time (after travel buffer) */
  actualStart?: Date;
  /** Actual meeting end time (before return buffer) */
  actualEnd?: Date;
  /** Place name for in-person events */
  placeName?: string;
  /** Video platform name (e.g. "Google Meet", "Zoom") */
  videoPlatform?: string;
  /** Organizer's display name */
  organizerName?: string;
  /** Organizer's shortCode for branding footer URL */
  shortCode?: string;
  /** Timezone string for formatting times (e.g. "America/New_York") */
  timezone?: string;
}

/**
 * Build a standardized calendar event description with Nekt branding footer.
 */
export function buildCalendarEventDescription(params: CalendarDescriptionParams): string {
  const {
    eventType,
    contactName,
    travelBuffer,
    actualStart,
    actualEnd,
    placeName,
    videoPlatform,
    organizerName,
    shortCode,
    timezone,
  } = params;

  let description = '';

  if (eventType === 'in-person') {
    const place = placeName || 'the venue';
    description = `Meeting with ${contactName} at ${place}`;
  } else if (eventType === 'video') {
    const platform = videoPlatform || 'platform TBD';
    if (platform === 'Google Meet' || platform === 'Microsoft Teams') {
      description = `Video call on ${platform}`;
    } else {
      const organizer = organizerName || 'organizer';
      description = `Video call on ${platform} - ${organizer} to send video link or phone #`;
    }
  } else {
    description = `Meeting with ${contactName}`;
  }

  // Nekt branding footer with shortCode-based profile URL
  const profileUrl = shortCode
    ? `https://nekt.us/c/${shortCode}`
    : 'https://nekt.us';
  description += `\n\nScheduled via Nekt (nekt.us). You can check out my profile here: ${profileUrl}`;

  return description;
}
