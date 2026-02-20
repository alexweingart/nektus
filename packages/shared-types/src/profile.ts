import type { Place } from './places';

// Field sections for profile organization
export type FieldSection = 'universal' | 'personal' | 'work';

// Unified contact entry interface - handles ALL profile fields
export interface ContactEntry {
  fieldType: string;           // 'name', 'bio', 'email', 'phone', 'instagram', etc.
                               // For custom links: extracted domain (e.g., "medium", "substack", "github")
  value: string;               // The actual field value
                               // For custom links: full URL, for social: username
  section: FieldSection;
  order: number;               // Consistent ordering across all fields
  isVisible: boolean;          // Whether field is shown or hidden
  confirmed: boolean;          // User has confirmed this field
  automatedVerification?: boolean;
  discoveryMethod?: 'ai' | 'manual' | 'email-guess' | 'phone-guess';

  // Link-specific fields (Phase 5)
  linkType?: 'default' | 'custom';  // "default" = native social (facebook, instagram, etc.)
                                     // "custom" = user-added custom link (medium, substack, etc.)
  icon?: string;                     // Icon URL/path - for ALL links (both default and custom)
                                     // Default: static asset path (e.g., "/icons/default/facebook.svg")
                                     // Custom: favicon URL from Google
}

export interface UserProfile {
  userId: string;
  shortCode: string;  // 8-char base62 identifier for short URLs (/c/{shortCode})
  profileImage: string;
  backgroundImage: string;
  backgroundColors?: string[];  // Extracted colors for ParticleNetwork: [dominant, accent1, accent2]
  lastUpdated: number;
  contactEntries: ContactEntry[];  // Everything is now a ContactEntry (name, bio, contacts)
  // AI generation completion flags - persist across sessions
  aiGeneration?: {
    bioGenerated: boolean;
    avatarGenerated: boolean;
    backgroundImageGenerated: boolean;
  };
  // Scheduling fields (from CalConnect)
  calendars?: Calendar[];       // Max 2: one personal, one work
  locations?: UserLocation[];   // Max 2: one personal, one work
  timezone?: string;            // User's timezone for scheduling
  deviceBusyTimes?: DeviceBusyTimesCache;  // Cached EventKit busy times (synced from device)
}

// Unified bio and social generation types
export interface BioAndSocialGenerationResponse {
  bio: string;
  socialProfiles: Record<string, string | null>; // platform -> username
  verified: Record<string, boolean>; // platform -> verification status
  success: boolean;
  socialProfilesDiscovered: number;
  socialProfilesVerified: number;
}

export interface AIBioAndSocialResult {
  bio: string;
  socialProfiles: {
    facebook?: string | null;
    instagram?: string | null;
    linkedin?: string | null;
    x?: string | null;
    snapchat?: string | null;
  };
}

// ============================================================================
// SCHEDULING & CALENDAR TYPES (from CalConnect)
// ============================================================================

export interface TimeSlot {
  start: string;
  end: string;
}

export interface DeviceBusyTimesCache {
  slots: TimeSlot[];       // Busy time slots synced from device (EventKit)
  updatedAt: number;       // Timestamp of last sync (ms since epoch)
  windowStart: string;     // ISO date — start of the cached window
  windowEnd: string;       // ISO date — end of the cached window
}

export interface SchedulableHours {
  monday: TimeSlot[];
  tuesday: TimeSlot[];
  wednesday: TimeSlot[];
  thursday: TimeSlot[];
  friday: TimeSlot[];
  saturday: TimeSlot[];
  sunday: TimeSlot[];
}

export interface Calendar {
  id: string;
  userId: string;
  provider: 'google' | 'microsoft' | 'apple' | 'other';
  email: string;
  section: FieldSection;  // Changed from 'state' to match Nekt naming (no 'universal' for calendars)
  schedulableHours: SchedulableHours;
  connectionStatus?: 'connecting' | 'connected' | 'failed';
  accessMethod?: 'oauth' | 'ics' | 'caldav' | 'eventkit';  // How we access this calendar (caldav for Apple, eventkit for iOS device calendars)
  icsUrl?: string;  // ICS feed URL if using ICS access
  lastError?: string;  // Track ICS fetch errors
  selectedCalendarIds?: string[];  // For Google: which specific calendars to include
  // OAuth tokens (encrypted, stored directly in calendar for nektus)
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarTokens {
  email: string;
  provider: 'google' | 'microsoft' | 'apple';
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  // Apple-specific
  appleId?: string;
  appSpecificPassword?: string;
}

// Calendar URL types
export interface CalendarUrls {
  google: string;
  outlook: string;
  apple: string; // .ics download link
}

export interface Event {
  id: string;
  organizerId: string;
  attendeeId?: string;
  title: string;
  description?: string;
  duration: number;
  eventType: 'video' | 'in-person';
  intent: 'first30m' | 'first1h' | 'coffee' | 'lunch' | 'dinner' | 'drinks' | 'quick_sync' | 'deep_dive' | 'live_working_session' | 'custom';

  // For scheduled events: actual meeting time
  startTime?: Date;
  endTime?: Date;

  // For templates: preferred schedulable hours by day
  preferredSchedulableHours?: SchedulableHours;

  // For templates: preferred date range constraints
  preferredSchedulableDates?: {
    startDate: string; // YYYY-MM-DD format
    endDate: string;   // YYYY-MM-DD format
    description: string; // Human-readable description (e.g., "next week", "the week after this")
  };

  // For meal/social events: prefer middle time slots within window
  preferMiddleTimeSlot?: boolean;

  location?: string;
  videoCallLink?: string;

  // Calendar URLs for this specific event (generated when event is scheduled)
  calendar_urls?: CalendarUrls;

  travelBuffer?: {
    beforeMinutes: number;
    afterMinutes: number;
  };

  // New properties for AI scheduling
  preferredPlaces?: Place[]; // Array of possible places for in-person events
  explicitUserTimes?: boolean; // User specified exact times
  explicitUserPlace?: boolean; // User specified exact place
  specificPlaceName?: string; // Specific place name requested by user
  hasExplicitTimeRequest?: boolean; // User requested specific time

  status?: 'template' | 'scheduled' | 'cancelled' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

// Subset of Event with only fields needed for calendar composition
export interface EventTemplate {
  id: string;
  title: string;
  duration: number;
  eventType: 'video' | 'in-person';
  intent: string;
  travelBuffer?: {
    beforeMinutes: number;
    afterMinutes: number;
  };
}

// Location interface
export interface UserLocation {
  id: string;
  userId: string;
  city: string;
  region: string;
  address?: string;
  zip?: string;
  country?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  section: FieldSection;  // Changed from 'state' to match Nekt naming (no 'universal' for locations)
  validated?: boolean;
  radarPlaceId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Address validation interfaces
export interface ValidationResult {
  isValid: boolean;
  message?: string;
  suggestion?: string;
  wasValidated?: boolean; // Indicates if validation was actually performed
}

export interface AddressValidation {
  address: ValidationResult;
  city: ValidationResult;
  region: ValidationResult;
  country: ValidationResult;
  zip: ValidationResult;
  overall: boolean;
}

// Suggestion chip for Smart Schedule
export interface SuggestionChip {
  id: string;
  eventId: string;
  icon?: string;
  suggestedSlot?: TimeSlot;
  loading?: boolean;
}

// Scheduling parameters
export interface SchedulingParams {
  user1Id: string;
  user2Id: string;
  calendarType: 'personal' | 'work';
  eventTemplateIds: string[];
}

// Availability request/response
export interface AvailabilityRequest {
  user1Id: string;
  user2Id: string;
  startDate: string;
  endDate: string;
  duration: number;
  intent?: string;
}

export interface AvailabilityResponse {
  slots: TimeSlot[];
  timezone: string;
}
