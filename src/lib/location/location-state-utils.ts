import type { User, UserLocation } from '@/types';

/**
 * Checks if user can add another location (max 2 locations)
 */
export function canAddLocation(user: User): boolean {
  // Users can add a location if they have fewer than 2 locations
  return (user.locations || []).length < 2;
}

/**
 * Gets the default state for a new location based on existing locations
 */
export function getDefaultStateForNewLocation(user: User): 'universal' | 'personal' | 'work' {
  const locations = user.locations || [];
  if (locations.length === 0) {
    return 'universal';
  }

  // If user has one location
  if (locations.length === 1) {
    const existingLocation = locations[0];

    // If existing location is universal, we need to show modal
    if (existingLocation.state === 'universal') {
      throw new Error('User has universal location - modal required');
    }

    // Return the opposite state
    return existingLocation.state === 'personal' ? 'work' : 'personal';
  }

  // Should not reach here if canAddLocation is working correctly
  throw new Error('User already has maximum locations');
}

/**
 * Checks if adding a location requires showing confirmation modal
 */
export function shouldShowLocationModal(user: User): boolean {
  const locations = user.locations || [];
  return locations.length === 1 && locations[0].state === 'universal';
}

/**
 * Gets available states for a location based on other locations
 */
export function getAvailableStatesForLocation(location: UserLocation, otherLocations: UserLocation[]): ('universal' | 'personal' | 'work')[] {
  if (location.state === 'universal') {
    return ['universal', 'personal', 'work'];
  }

  const otherStates = otherLocations.map(loc => loc.state);

  if (otherStates.includes('personal')) {
    return ['work', 'universal'];
  } else if (otherStates.includes('work')) {
    return ['personal', 'universal'];
  } else if (otherStates.includes('universal')) {
    return ['personal', 'work'];
  }

  return ['universal', 'personal', 'work'];
}