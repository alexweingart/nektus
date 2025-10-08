import type { SchedulableHours } from '@/types/profile';

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

// Note: UNIVERSAL removed - Nekt doesn't have universal calendar concept
// Personal and work calendars have separate schedulable hours

// Standard 10-minute notification for all events (Google Calendar standard)
export function getNotificationMinutes(): number {
  return 10; // 10 minutes before for all events
}
