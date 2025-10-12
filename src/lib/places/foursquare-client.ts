import {
  Coordinates,
  Place,
  PlaceError
} from '@/types/places';
import { isWithinRadius, generateGoogleMapsUrl, calculateDistance } from '../location/location-utils';

// Common Foursquare category IDs - export for use in AI prompts
export const FOURSQUARE_CATEGORIES = {
  // Food & Drink
  restaurant: '4bf58dd8d48988d1c4941735',
  cafe: '4bf58dd8d48988d16d941735',
  coffee_shop: '4bf58dd8d48988d1e0931735',
  bar: '4bf58dd8d48988d116941735',
  nightclub: '4bf58dd8d48988d11f941735',
  food: '4d4b7105d754a06374d81259',

  // Outdoor & Recreation
  park: '4bf58dd8d48988d163941735',
  trail: '4bf58dd8d48988d159941735',
  beach: '4bf58dd8d48988d1e2941735',

  // Sports & Fitness
  gym: '4bf58dd8d48988d175941735',
  tennis_court: '4e39a956bd410d7aed40cbc3',
  athletics_sports: '4f4528bc4b90abdf24c9de85',
  yoga_studio: '4bf58dd8d48988d102941735',

  // Culture & Entertainment
  museum: '4bf58dd8d48988d181941735',
  tourist_attraction: '4bf58dd8d48988d162941735',
  stadium: '4bf58dd8d48988d184941735',

  // Shopping
  shopping_mall: '4bf58dd8d48988d1fd941735',
  store: '4bf58dd8d48988d1fd941735',
};

// Legacy fallback mapping (kept for backwards compatibility)
const CATEGORY_MAP: Record<string, string> = FOURSQUARE_CATEGORIES;

// Foursquare API response interfaces (NEW API format)
interface FoursquareLocation {
  formatted_address?: string;
  address?: string;
  locality?: string;
  region?: string;
  postcode?: string;
  country?: string;
}

interface FoursquareCategory {
  fsq_category_id: string;
  name: string;
  short_name?: string;
  plural_name?: string;
}

interface FoursquarePlace {
  fsq_place_id: string;
  name: string;
  latitude: number;
  longitude: number;
  location: FoursquareLocation;
  categories?: FoursquareCategory[];
  rating?: number; // 0-10 scale (if available)
  price?: number; // 1-4 scale (if available)
  hours?: any; // hours structure (if available)
  distance?: number; // meters from search center
}

interface FoursquareResponse {
  results: FoursquarePlace[];
}

/**
 * Search for places using Foursquare Places API with text query
 */
export async function searchFoursquarePlaces(
  location: Coordinates,
  radius: number,
  textQuery: string,
  category?: string
): Promise<Place[]> {
  const apiKey = process.env.FOURSQUARE_API_KEY;

  if (!apiKey) {
    const error: PlaceError = {
      code: 'API_ERROR',
      message: 'Foursquare API key not configured',
    };
    throw error;
  }

  try {
    const url = new URL('https://places-api.foursquare.com/places/search');

    // Required parameters
    url.searchParams.set('ll', `${location.lat},${location.lng}`);
    url.searchParams.set('radius', Math.round(radius).toString()); // Must be integer
    url.searchParams.set('limit', '50');

    // Optional parameters
    if (textQuery) {
      url.searchParams.set('query', textQuery);
    }

    if (category) {
      url.searchParams.set('categories', category);
    }

    // Request specific fields - NEW API field names
    // Core (free): fsq_place_id, name, latitude, longitude, location, categories
    // Premium (paid): rating, price, hours
    url.searchParams.set('fields', 'fsq_place_id,name,latitude,longitude,location,categories');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Places-Api-Version': '2025-06-17',
      },
    });

    const data: FoursquareResponse = await response.json();

    if (!response.ok) {
      if (response.status === 429) {
        const error: PlaceError = {
          code: 'QUOTA_EXCEEDED',
          message: 'Foursquare API quota exceeded',
        };
        throw error;
      }

      const error: PlaceError = {
        code: 'API_ERROR',
        message: `Foursquare search failed: ${response.status}`,
        details: data,
      };
      throw error;
    }

    if (!data.results || data.results.length === 0) {
      return [];
    }

    // Convert API response to our Place interface (NEW API format)
    const places: Place[] = data.results
      .filter((place: FoursquarePlace) => place.latitude && place.longitude)
      .map((place: FoursquarePlace) => {
        const placeCoords = {
          lat: place.latitude,
          lng: place.longitude
        };
        const distanceFromCenter = calculateDistance(location, placeCoords);

        // Build address from available fields
        const address = place.location.formatted_address ||
                       place.location.address ||
                       `${place.location.locality || ''}, ${place.location.region || ''}`.trim();

        return {
          place_id: place.fsq_place_id,
          name: place.name || 'Unknown Place',
          address: address,
          coordinates: placeCoords,
          rating: place.rating ? place.rating / 2 : undefined, // Convert 0-10 to 0-5 scale if available
          price_level: place.price,
          google_maps_url: generateGoogleMapsUrl(placeCoords, place.name),
          distance_from_midpoint_km: Math.round(distanceFromCenter * 10) / 10,
          opening_hours: place.hours ? {
            open_now: place.hours.open_now,
            periods: place.hours.regular?.map((period: any) => ({
              open: { day: period.day, hour: 0, minute: 0 },
              close: { day: period.day, hour: 0, minute: 0 }
            })),
            weekday_text: place.hours.display
          } : undefined
        };
      });

    // Filter by radius and rating (4+ stars for better quality)
    const filteredPlaces = places.filter(place => {
      const withinRadius = isWithinRadius(location, place.coordinates, radius / 1000);
      const goodRating = !place.rating || place.rating >= 4.0; // Include unrated or 4+ star places
      return withinRadius && goodRating;
    });

    return filteredPlaces.sort((a, b) => {
      if (a.rating && b.rating) {
        return b.rating - a.rating;
      }
      if (a.rating && !b.rating) return -1;
      if (!a.rating && b.rating) return 1;
      return 0;
    });

  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      throw error;
    }

    const locationError: PlaceError = {
      code: 'API_ERROR',
      message: 'Failed to search places with Foursquare',
      details: error,
    };
    throw locationError;
  }
}

/**
 * Search for places near a location with specific category
 */
export async function searchFoursquareNearby(
  location: Coordinates,
  radius: number,
  categories: string[]
): Promise<Place[]> {
  const apiKey = process.env.FOURSQUARE_API_KEY;

  if (!apiKey) {
    const error: PlaceError = {
      code: 'API_ERROR',
      message: 'Foursquare API key not configured',
    };
    throw error;
  }

  try {
    const url = new URL('https://places-api.foursquare.com/places/search');

    url.searchParams.set('ll', `${location.lat},${location.lng}`);
    url.searchParams.set('radius', Math.round(radius).toString()); // Must be integer
    url.searchParams.set('categories', categories.join(','));
    url.searchParams.set('limit', '50');
    url.searchParams.set('fields', 'fsq_place_id,name,latitude,longitude,location,categories');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Places-Api-Version': '2025-06-17',
      },
    });

    const data: FoursquareResponse = await response.json();

    if (!response.ok) {
      if (response.status === 429) {
        const error: PlaceError = {
          code: 'QUOTA_EXCEEDED',
          message: 'Foursquare API quota exceeded',
        };
        throw error;
      }

      const error: PlaceError = {
        code: 'API_ERROR',
        message: `Foursquare nearby search failed: ${response.status}`,
        details: data,
      };
      throw error;
    }

    if (!data.results || data.results.length === 0) {
      return [];
    }

    // Convert to Place interface (NEW API format)
    const places: Place[] = data.results
      .filter((place: FoursquarePlace) => place.latitude && place.longitude)
      .map((place: FoursquarePlace) => {
        const placeCoords = {
          lat: place.latitude,
          lng: place.longitude
        };
        const distanceFromCenter = calculateDistance(location, placeCoords);

        const address = place.location.formatted_address ||
                       place.location.address ||
                       `${place.location.locality || ''}, ${place.location.region || ''}`.trim();

        return {
          place_id: place.fsq_place_id,
          name: place.name || 'Unknown Place',
          address: address,
          coordinates: placeCoords,
          rating: place.rating ? place.rating / 2 : undefined,
          price_level: place.price,
          google_maps_url: generateGoogleMapsUrl(placeCoords, place.name),
          distance_from_midpoint_km: Math.round(distanceFromCenter * 10) / 10,
          opening_hours: place.hours ? {
            open_now: place.hours.open_now,
            periods: place.hours.regular?.map((period: any) => ({
              open: { day: period.day, hour: 0, minute: 0 },
              close: { day: period.day, hour: 0, minute: 0 }
            })),
            weekday_text: place.hours.display
          } : undefined
        };
      });

    // Filter by radius and rating
    const filteredPlaces = places.filter(place => {
      const withinRadius = isWithinRadius(location, place.coordinates, radius / 1000);
      const goodRating = !place.rating || place.rating >= 4.0;
      return withinRadius && goodRating;
    });

    return filteredPlaces.sort((a, b) => {
      if (a.rating && b.rating) {
        return b.rating - a.rating;
      }
      if (a.rating && !b.rating) return -1;
      if (!a.rating && b.rating) return 1;
      return 0;
    });

  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      throw error;
    }

    const locationError: PlaceError = {
      code: 'API_ERROR',
      message: 'Failed to search nearby places',
      details: error,
    };
    throw locationError;
  }
}

/**
 * Search for places by type with comprehensive filtering
 * Maintains compatibility with existing Google Places API interface
 */
export async function searchPlacesByType(
  location: Coordinates,
  radius: number,
  type: 'restaurant' | 'cafe' | 'food',
  keyword?: string,
  meetingDateTime?: Date
): Promise<Place[]> {
  // Map Google Places type to Foursquare category
  const category = CATEGORY_MAP[type] || CATEGORY_MAP.restaurant;

  // Use text search if keyword is provided, otherwise use nearby search
  if (keyword) {
    return await searchFoursquarePlaces(location, radius, keyword, category);
  } else {
    return await searchFoursquareNearby(location, radius, [category]);
  }
}

/**
 * Helper function to get Foursquare category IDs from activity keywords
 */
export function getFoursquareCategoriesForActivity(activityQuery: string): string[] {
  const query = activityQuery.toLowerCase();

  // Map keywords to Foursquare categories
  if (query.includes('coffee') || query.includes('café') || query.includes('cafe')) {
    return [CATEGORY_MAP.coffee, CATEGORY_MAP.cafe];
  }
  if (query.includes('restaurant') || query.includes('food') || query.includes('dining') || query.includes('lunch') || query.includes('dinner')) {
    return [CATEGORY_MAP.restaurant];
  }
  if (query.includes('hik') || query.includes('trail')) {
    return [CATEGORY_MAP.trail, CATEGORY_MAP.park, CATEGORY_MAP.tourist_attraction];
  }
  if (query.includes('park') || query.includes('outdoor')) {
    return [CATEGORY_MAP.park, CATEGORY_MAP.tourist_attraction];
  }
  if (query.includes('museum') || query.includes('art') || query.includes('gallery')) {
    return [CATEGORY_MAP.museum];
  }
  if (query.includes('shopping') || query.includes('mall') || query.includes('store')) {
    return [CATEGORY_MAP.shopping_mall];
  }
  if (query.includes('gym') || query.includes('fitness') || query.includes('sport') || query.includes('workout')) {
    return [CATEGORY_MAP.gym];
  }
  if (query.includes('bar') || query.includes('drink') || query.includes('pub') || query.includes('cocktail')) {
    return [CATEGORY_MAP.bar];
  }
  if (query.includes('nightlife') || query.includes('club') || query.includes('nightclub')) {
    return [CATEGORY_MAP.night_club];
  }

  // Default fallback
  return [CATEGORY_MAP.tourist_attraction, CATEGORY_MAP.restaurant, CATEGORY_MAP.park];
}
