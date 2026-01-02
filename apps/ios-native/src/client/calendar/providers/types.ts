/**
 * Shared types for Calendar Providers
 */

export interface TimeSlot {
  start: string; // ISO datetime
  end: string;   // ISO datetime
}

export interface CalendarEvent {
  title: string;
  start: string;
  end: string;
  location?: string;
  attendees?: string[];
  description?: string;
  eventType?: 'video' | 'in-person';
}
