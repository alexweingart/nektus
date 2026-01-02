/**
 * Calendar Providers Index
 * Re-exports all calendar provider modules
 */

// Shared types
export * from './types';

// Provider functions (explicitly export to avoid TimeSlot conflicts)
export {
  getGoogleBusyTimes,
  refreshGoogleToken,
  getGoogleCalendarList,
} from './google';

export {
  getMicrosoftBusyTimes,
  refreshMicrosoftToken,
  getMicrosoftCalendarList,
  getMicrosoftUserProfile,
} from './microsoft';

export {
  getAppleBusyTimes,
  testAppleConnection,
  getAppleCalendarList,
  generateAppleCalendarFile,
  openCalendarEvent,
} from './apple';

export * from './tokens';

// Default exports
export { default as googleCalendar } from './google';
export { default as microsoftCalendar } from './microsoft';
export { default as appleCalendar } from './apple';
export { default as calendarTokens } from './tokens';
