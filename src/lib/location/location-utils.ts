import { Coordinates, MidpointCalculation } from '@/types/places';

/**
 * Calculate the distance between two coordinates using the Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = toRadians(coord2.lat - coord1.lat);
  const dLng = toRadians(coord2.lng - coord1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.lat)) * Math.cos(toRadians(coord2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in kilometers

  return distance;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate the geographic midpoint between two coordinates
 * Returns the midpoint and suggested search radius
 */
export function calculateMidpoint(coord1: Coordinates, coord2: Coordinates): MidpointCalculation {
  // Calculate the midpoint using simple arithmetic mean
  const midpoint: Coordinates = {
    lat: (coord1.lat + coord2.lat) / 2,
    lng: (coord1.lng + coord2.lng) / 2,
  };

  // Calculate distance between the two points
  const totalDistance = calculateDistance(coord1, coord2);

  // Set search radius based on distance between points
  // For close locations (< 3km), use 1.5km radius
  // For distant locations, use 30% of the distance but cap at 25km
  let searchRadiusKm;
  if (totalDistance < 3) {
    searchRadiusKm = 1.5;
  } else {
    searchRadiusKm = Math.min(totalDistance * 0.3, 25);
  }

  return {
    coordinates: midpoint,
    search_radius_meters: searchRadiusKm * 1000, // Convert to meters for Google API
  };
}

/**
 * Create a search bounding box around a center point
 * Returns northeast and southwest corners for a rectangular search area
 */
export function createBoundingBox(center: Coordinates, radiusKm: number): {
  northeast: Coordinates;
  southwest: Coordinates;
} {
  // Approximate degrees per kilometer (varies by latitude)
  const latDegreesPerKm = 1 / 111.32;
  const lngDegreesPerKm = 1 / (111.32 * Math.cos(toRadians(center.lat)));

  const latDelta = radiusKm * latDegreesPerKm;
  const lngDelta = radiusKm * lngDegreesPerKm;

  return {
    northeast: {
      lat: center.lat + latDelta,
      lng: center.lng + lngDelta,
    },
    southwest: {
      lat: center.lat - latDelta,
      lng: center.lng - lngDelta,
    },
  };
}

/**
 * Check if a point is within a certain radius of a center point
 */
export function isWithinRadius(center: Coordinates, point: Coordinates, radiusKm: number): boolean {
  const distance = calculateDistance(center, point);
  return distance <= radiusKm;
}

/**
 * Generate Google Maps URL for a location
 * Prefers using Google Place ID when available for accurate place cards
 */
export function generateGoogleMapsUrl(
  coordinates: Coordinates,
  placeName?: string,
  googlePlaceId?: string
): string {
  if (googlePlaceId && placeName) {
    // Best option: Use Place ID for guaranteed accurate place card
    const encodedName = encodeURIComponent(placeName);
    return `https://www.google.com/maps/search/?api=1&query=${encodedName}&query_place_id=${googlePlaceId}`;
  } else if (placeName) {
    // Fallback: Use search with place name only
    const encodedName = encodeURIComponent(placeName);
    return `https://www.google.com/maps/search/?api=1&query=${encodedName}`;
  } else {
    // Last resort: coordinates only
    return `https://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}`;
  }
}

/**
 * Validate coordinates are within valid ranges
 */
export function validateCoordinates(coordinates: Coordinates): boolean {
  const { lat, lng } = coordinates;

  // Latitude must be between -90 and 90
  if (lat < -90 || lat > 90) {
    return false;
  }

  // Longitude must be between -180 and 180
  if (lng < -180 || lng > 180) {
    return false;
  }

  return true;
}

/**
 * Format distance for display
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  } else if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)}km`;
  } else {
    return `${Math.round(distanceKm)}km`;
  }
}

/**
 * Find the best location for a user based on calendar type preference
 * Falls back to universal location, then first available location
 */
export function findBestLocationForCalendarType<T extends { section: 'personal' | 'work' | 'universal' }>(
  locations: T[] | undefined,
  calendarType: 'personal' | 'work'
): T | null {
  if (!locations || locations.length === 0) {
    return null;
  }

  // First try to find a location that matches the preferred calendar type
  const matchingLocation = locations.find((loc) => loc.section === calendarType);
  if (matchingLocation) {
    return matchingLocation;
  }

  // Fall back to universal
  const universalLocation = locations.find((loc) => loc.section === 'universal');
  if (universalLocation) {
    return universalLocation;
  }

  // If no universal, just use the first available location
  return locations[0];
}

/**
 * Build a full address string from location components
 * Filters out empty parts and joins with commas
 */
export function buildFullAddress(location: { address?: string; city?: string; region?: string } | null): string | null {
  if (!location) {
    return null;
  }

  const parts = [location.address, location.city, location.region]
    .filter(part => part && part.trim());

  return parts.length > 0 ? parts.join(', ') : null;
}