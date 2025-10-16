import type { Calendar } from '@/types';

/**
 * Validates if a state transition is allowed
 */
export function isValidStateTransition(
  fromState: 'universal' | 'personal' | 'work',
  toState: 'universal' | 'personal' | 'work',
  otherCalendar?: Calendar | null
): boolean {
  // No change
  if (fromState === toState) return true;

  // Universal to personal/work is always allowed
  if (fromState === 'universal' && (toState === 'personal' || toState === 'work')) {
    return true;
  }

  // Personal/work to universal requires no other calendar or deletion confirmation
  if ((fromState === 'personal' || fromState === 'work') && toState === 'universal') {
    return true; // Will require deletion confirmation if other calendar exists
  }

  // Personal to work or work to personal
  if ((fromState === 'personal' && toState === 'work') || (fromState === 'work' && toState === 'personal')) {
    // Check if other calendar exists with the target state
    if (otherCalendar && otherCalendar.section === toState) {
      return false; // Can't have two calendars with same state
    }
    return true;
  }

  return false;
}

/**
 * Determines what state options are available for a new calendar
 */
export function getAvailableStatesForNewCalendar(existingCalendars: Calendar[]): ('universal' | 'personal' | 'work')[] {
  if (existingCalendars.length === 0) {
    // First calendar defaults to universal
    return ['universal'];
  }

  if (existingCalendars.length === 1) {
    const existing = existingCalendars[0];

    if (existing.section === 'universal') {
      // If first is universal, second can be personal or work
      return ['personal', 'work'];
    } else if (existing.section === 'personal') {
      // If first is personal, second must be work
      return ['work'];
    } else if (existing.section === 'work') {
      // If first is work, second must be personal
      return ['personal'];
    }
  }

  // Should not have more than 2 calendars
  return [];
}

/**
 * Determines the default state for a new calendar
 */
export function getDefaultStateForNewCalendar(existingCalendars: Calendar[]): 'universal' | 'personal' | 'work' {
  const availableStates = getAvailableStatesForNewCalendar(existingCalendars);

  if (availableStates.length === 0) {
    throw new Error('Cannot add more calendars - maximum of 2 calendars allowed');
  }

  return availableStates[0];
}

/**
 * Validates if a user can add another calendar
 */
export function canAddCalendar(existingCalendars: Calendar[]): boolean {
  return existingCalendars.length < 2;
}

/**
 * Gets the complementary state for a calendar
 */
export function getComplementaryState(state: 'personal' | 'work'): 'personal' | 'work' {
  return state === 'personal' ? 'work' : 'personal';
}

/**
 * Determines if calendars need to swap states
 */
export function shouldSwapStates(
  calendar1: Calendar,
  calendar2: Calendar,
  newStateForCalendar1: 'universal' | 'personal' | 'work'
): boolean {
  // If changing to universal, no swap needed (other will be deleted)
  if (newStateForCalendar1 === 'universal') {
    return false;
  }

  // If both calendars are personal/work and trying to change to the other's state
  if (
    (calendar1.section === 'personal' || calendar1.section === 'work') &&
    (calendar2.section === 'personal' || calendar2.section === 'work') &&
    newStateForCalendar1 === calendar2.section
  ) {
    return true;
  }

  return false;
}
