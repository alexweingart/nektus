import type { SchedulableHours } from '@nektus/shared-types';

export const AVAILABILITY_CONSTANTS = {
  lookAheadHours: 2,
  lookAheadDays: 14,
  slotDuration: 30,
  inPersonBufferBefore: 30,
  inPersonBufferAfter: 30,
} as const;

export const WORK_SCHEDULABLE_HOURS: SchedulableHours = {
  monday: [{ start: '09:00', end: '17:00' }],
  tuesday: [{ start: '09:00', end: '17:00' }],
  wednesday: [{ start: '09:00', end: '17:00' }],
  thursday: [{ start: '09:00', end: '17:00' }],
  friday: [{ start: '09:00', end: '17:00' }],
  saturday: [],
  sunday: [],
};

export const PERSONAL_SCHEDULABLE_HOURS: SchedulableHours = {
  monday: [{ start: '08:00', end: '09:00' }, { start: '17:00', end: '22:00' }],
  tuesday: [{ start: '08:00', end: '09:00' }, { start: '17:00', end: '22:00' }],
  wednesday: [{ start: '08:00', end: '09:00' }, { start: '17:00', end: '22:00' }],
  thursday: [{ start: '08:00', end: '09:00' }, { start: '17:00', end: '22:00' }],
  friday: [{ start: '08:00', end: '09:00' }, { start: '17:00', end: '22:00' }],
  saturday: [{ start: '08:00', end: '22:00' }],
  sunday: [{ start: '08:00', end: '22:00' }],
};

// Universal schedulable hours (for CalConnect merge - combines personal + work)
export const UNIVERSAL_SCHEDULABLE_HOURS: SchedulableHours = {
  monday: [{ start: '08:00', end: '22:00' }],
  tuesday: [{ start: '08:00', end: '22:00' }],
  wednesday: [{ start: '08:00', end: '22:00' }],
  thursday: [{ start: '08:00', end: '22:00' }],
  friday: [{ start: '08:00', end: '22:00' }],
  saturday: [{ start: '08:00', end: '22:00' }],
  sunday: [{ start: '08:00', end: '22:00' }],
};

// Standard 10-minute notification for all events (Google Calendar standard)
export function getNotificationMinutes(): number {
  return 10; // 10 minutes before for all events
}

// ============================================================================
// CACHE TTL TIERS
// ============================================================================

/** Cache TTL values in seconds (for Redis) and milliseconds (for client) */
export const CACHE_TTL = {
  /** 5 minutes - exchange state, auth flags, contacts cache, pre-fetch cooldowns */
  SHORT_S: 5 * 60,          // 300 seconds
  SHORT_MS: 5 * 60 * 1000,  // 300,000 ms

  /** 1 hour - calendar data, AI scheduling, session handoff, asset caches */
  LONG_S: 60 * 60,          // 3,600 seconds
  LONG_MS: 60 * 60 * 1000,  // 3,600,000 ms

  /** 7 days - IP geolocation, Redis keepalive */
  WEEKLY_S: 7 * 24 * 60 * 60,         // 604,800 seconds
  WEEKLY_MS: 7 * 24 * 60 * 60 * 1000, // 604,800,000 ms

  /** 30 days - NextAuth JWT session */
  MONTHLY_S: 30 * 24 * 60 * 60,         // 2,592,000 seconds
  MONTHLY_MS: 30 * 24 * 60 * 60 * 1000, // 2,592,000,000 ms
} as const;

// ============================================================================
// EXCHANGE TIMEOUT TIERS
// ============================================================================

/** Exchange timeout values in milliseconds */
export const EXCHANGE_TIMEOUT = {
  /** 1 second - polling intervals */
  FAST_MS: 1_000,

  /** 5 seconds - BLE data transfer, connection timeouts */
  MEDIUM_MS: 5_000,

  /** 60 seconds - scan, bump, QR/OAuth exchange timeouts */
  SLOW_MS: 60_000,
} as const;

// ============================================================================
// ANIMATION DURATION TIERS
// ============================================================================

/** Standardized animation durations in milliseconds */
export const ANIMATION = {
  /** 1000ms - exchange reveal, background color transitions, avatar crossfades */
  CINEMATIC_MS: 1_000,

  /** 500ms - page transitions, screen fades, exchange enter */
  NAVIGATION_MS: 500,

  /** 300ms - modals, button fades, slides, UI element transitions */
  UI_MS: 300,

  /** 100ms - touch feedback, instant interactions */
  MICRO_MS: 100,
} as const;
