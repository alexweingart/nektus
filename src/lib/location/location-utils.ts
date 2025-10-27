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
  // For very close locations (< 3km), use 1km radius
  // For close locations (3-5km), use 2km radius
  // For distant locations, use 30% of the distance but cap at 25km
  let searchRadiusKm;
  if (totalDistance < 3) {
    searchRadiusKm = 1;
  } else if (totalDistance < 5) {
    searchRadiusKm = 2;
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
 */
export function generateGoogleMapsUrl(coordinates: Coordinates, placeName?: string): string {
  if (placeName) {
    // Use both place name and coordinates for accurate, reliable links
    const encodedName = encodeURIComponent(placeName);
    const query = `${encodedName}+${coordinates.lat},${coordinates.lng}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  } else {
    // Fallback to coordinates only
    return `https://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}`;
  }
}

/**
 * Generate Google Maps directions URL between two points
 */
export function generateDirectionsUrl(origin: Coordinates, destination: Coordinates): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}`;
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
 * Calculate optimal meeting suggestions based on two user locations
 * Considers travel time fairness and venue density
 */
export function calculateOptimalSearchZones(
  userA: Coordinates,
  userB: Coordinates
): MidpointCalculation[] {
  const distance = calculateDistance(userA, userB);

  // For very close users (< 3km), just search around midpoint
  if (distance < 3) {
    return [calculateMidpoint(userA, userB)];
  }

  // For distant users (> 50km), search multiple zones
  if (distance > 50) {
    const midpoint = calculateMidpoint(userA, userB);

    // Also search closer to each user for their convenience
    const quarterPointA: Coordinates = {
      lat: userA.lat + (midpoint.coordinates.lat - userA.lat) * 0.5,
      lng: userA.lng + (midpoint.coordinates.lng - userA.lng) * 0.5,
    };

    const quarterPointB: Coordinates = {
      lat: userB.lat + (midpoint.coordinates.lat - userB.lat) * 0.5,
      lng: userB.lng + (midpoint.coordinates.lng - userB.lng) * 0.5,
    };

    return [
      midpoint,
      {
        coordinates: quarterPointA,
        search_radius_meters: 10000, // 10km radius
      },
      {
        coordinates: quarterPointB,
        search_radius_meters: 10000, // 10km radius
      },
    ];
  }

  // For medium distances, just use midpoint with appropriate radius
  return [calculateMidpoint(userA, userB)];
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