import type { Place } from '@/types/places';
import type { DetermineIntentResult } from '@/types/ai-scheduling';
import { geocodeAddress } from '@/server/location/geocoding';
import { calculateMidpoint } from '@/server/location/location';
import { searchLocalEvents } from './search-events';
import { createCompletion, getModelForTask, getReasoningEffortForTask } from '@/server/ai-scheduling/openai-client';
import { searchFoursquarePlaces, getFoursquareCategoriesForActivity } from '@/server/places/foursquare';

interface PlaceSearchParams {
  intentResult: DetermineIntentResult;
  userLocations: string[];
  userCoordinates?: Array<{ lat: number; lng: number } | null | undefined>;
  userIp?: string;
  timeframe?: 'today' | 'tomorrow' | 'this weekend' | 'next week';
}

interface ActivitySuggestion {
  activity: string;
  searchQuery: string;
  description: string;
  suggestedPlaceTypes?: string[];
}

interface SpecialEvent {
  eventName: string;
  eventDescription: string;
  eventDate?: string;
  eventTime?: string;
  eventType?: string;
  url?: string;
}

interface SpecialEventPlace extends Place, SpecialEvent {}

export async function searchPlaces(params: PlaceSearchParams): Promise<Place[]> {
  const { intentResult, userLocations, userCoordinates, userIp, timeframe = 'tomorrow' } = params;

  try {
    switch (intentResult.intentSpecificity) {
      case 'specific_place':
        return await searchSpecificPlace(intentResult.specificPlace!, userLocations, intentResult.suggestedPlaceTypes, userCoordinates, userIp);

      case 'activity_type':
        return await searchPlacesByActivity(intentResult.activitySearchQuery!, userLocations, intentResult, userCoordinates, userIp);

      case 'generic':
        return await searchGenericActivities(userLocations, timeframe, userCoordinates, userIp);

      default:
        return [];
    }
  } catch (error) {
    console.error('Error in searchPlaces:', error);
    return [];
  }
}

// Tier 1: Specific Place Search
async function searchSpecificPlace(
  placeName: string,
  userLocations: string[],
  suggestedPlaceTypes?: string[],
  userCoordinates?: Array<{ lat: number; lng: number } | null | undefined>,
  userIp?: string
): Promise<Place[]> {
  try {
    const { searchCenter } = await getMidpointFromLocations(userLocations, userCoordinates, userIp);

    // Wide radius (100km) — Foursquare's relevance ranking handles matching,
    // location is used for RANKING, not filtering
    const WIDE_SEARCH_RADIUS = 100000;

    // Use suggested categories to ensure we get the right type of venue
    // (e.g., searching for "Chic N Time" for dinner should only match restaurants, not barbershops)
    const categories = suggestedPlaceTypes?.join(',');

    const places = await searchFoursquarePlaces(
      searchCenter,
      WIDE_SEARCH_RADIUS,
      placeName,
      categories
    );

    if (places.length > 0) {
      return places.slice(0, 10);
    }

    return [];
  } catch (error) {
    console.error('Error searching for specific place:', error);
    return [];
  }
}

// Tier 2: Activity-Based Search
async function searchPlacesByActivity(
  activitySearchQuery: string,
  userLocations: string[],
  _intentResult: DetermineIntentResult,
  userCoordinates?: Array<{ lat: number; lng: number } | null | undefined>,
  userIp?: string
): Promise<Place[]> {
  try {
    const { searchCenter, searchRadiusMeters } = await getMidpointFromLocations(userLocations, userCoordinates, userIp);

    let places = await searchFoursquarePlaces(
      searchCenter,
      searchRadiusMeters,
      activitySearchQuery,
      undefined
    );

    // If we got fewer than 4 results, try expanding the radius
    if (places.length < 4) {
      const expandedPlaces = await searchFoursquarePlaces(
        searchCenter,
        searchRadiusMeters * 2,
        activitySearchQuery,
        undefined
      );

      if (expandedPlaces.length > places.length) {
        places = expandedPlaces;
      }
    }

    return places.slice(0, 10);
  } catch (error) {
    console.error('Error searching for places by activity:', error);
    return [];
  }
}

// Tier 3: Generic Activity Discovery
async function searchGenericActivities(
  userLocations: string[],
  timeframe: string,
  userCoordinates?: Array<{ lat: number; lng: number } | null | undefined>,
  userIp?: string
): Promise<Place[]> {
  try {
    const { searchCenter, searchRadiusMeters, primaryLocation } = await getMidpointFromLocations(userLocations, userCoordinates, userIp);

    const [activitySuggestions, specialEvents] = await Promise.all([
      suggestActivitiesWithLLM(primaryLocation, timeframe),
      searchSpecialEvents(primaryLocation, timeframe)
    ]);

    const activityPlaces = await findPlacesForActivities(activitySuggestions, searchCenter, searchRadiusMeters);

    return [...activityPlaces, ...specialEvents];
  } catch (error) {
    console.error('Error in generic activity discovery:', error);
    return [];
  }
}

// 3A: LLM Activity Suggestions
async function suggestActivitiesWithLLM(
  location: string,
  timeframe: string
): Promise<ActivitySuggestion[]> {
  const prompt = `You are a local activity expert. Suggest 3-5 diverse activities for ${timeframe} in ${location}.

For each activity, provide:
1. Activity name (short, e.g., "hiking", "museums", "coffee tasting")
2. Search query for finding venues (e.g., "hiking trails", "art museums", "specialty coffee shops")
3. Brief description of why it's good for this location/timeframe
4. Suggested Foursquare category types (e.g., ["park", "tourist_attraction"] for hiking, ["cafe", "restaurant"] for coffee, ["museum"] for museums)

Focus on activities that:
- Are appropriate for ${timeframe}
- Take advantage of ${location}'s unique features
- Offer variety (indoor/outdoor, cultural/recreational, etc.)
- Are suitable for meeting someone

Return as JSON array: [{"activity": "...", "searchQuery": "...", "description": "...", "suggestedPlaceTypes": ["type1", "type2"]}]`;

  try {
    const completion = await createCompletion({
      model: getModelForTask('navigation'), // Use fast model for suggestions
      reasoning_effort: getReasoningEffortForTask('navigation'),
      verbosity: 'low',
      messages: [
        { role: 'system', content: 'You are a helpful local activity expert. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8 // Higher creativity for activity suggestions
    });

    const result = completion.choices[0].message.content;
    const parsed = JSON.parse(result || '{"activities": []}');

    const activities = Array.isArray(parsed) ? parsed : (parsed.activities || []);
    return activities;

  } catch (error) {
    console.error('Error getting LLM activity suggestions:', error);
    return getDefaultActivitySuggestions();
  }
}

// 3B: Special Events Web Search
async function searchSpecialEvents(
  location: string,
  timeframe: string
): Promise<SpecialEventPlace[]> {
  try {
    const eventResults = await searchLocalEvents(location, timeframe);

    if (eventResults.length === 0) {
      return [];
    }

    const specialEventPlaces: SpecialEventPlace[] = await Promise.all(
      eventResults.map(async (event, index) => {
        let coordinates = { lat: 0, lng: 0 };

        try {
          // Get real coordinates from the event address
          const geocoded = await geocodeAddress(event.address);
          coordinates = geocoded.coordinates;
        } catch (_error) {
          console.warn(`Failed to geocode event address: ${event.address}`, _error);
          // Keep default coordinates if geocoding fails
        }

        return {
          // Place fields
          place_id: `event-${Date.now()}-${index}`,
          name: event.venue || event.title,
          address: event.address,
          coordinates,
          rating: undefined,
          price_level: undefined,
          google_maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`,

          // SpecialEvent fields
          eventName: event.title,
          eventDescription: event.description,
          eventDate: event.date,
          eventTime: event.startTime,
          eventType: event.activityType,
          url: event.url
        };
      })
    );

    return specialEventPlaces;
  } catch (error) {
    console.error('Error searching for special events:', error);
    return [];
  }
}

// 3C: Find Places for Activities
async function findPlacesForActivities(
  activities: ActivitySuggestion[],
  searchCenter: { lat: number; lng: number },
  searchRadiusMeters: number
): Promise<Place[]> {
  const allPlaces: Place[] = [];

  for (const activity of activities) {
    try {
      const categories = activity.suggestedPlaceTypes && activity.suggestedPlaceTypes.length > 0
        ? activity.suggestedPlaceTypes
        : getFoursquareCategoriesForActivity(activity.searchQuery);

      const places = await searchFoursquarePlaces(
        searchCenter,
        searchRadiusMeters,
        activity.searchQuery,
        categories.join(',')
      );

      // Take top 3 places per activity to maintain diversity
      allPlaces.push(...places.slice(0, 3));
    } catch (_error) {
      console.error(`Error searching for activity ${activity.activity}:`, _error);
    }
  }

  return allPlaces;
}

// Helper: Calculate midpoint from user locations
async function getMidpointFromLocations(
  userLocations: string[],
  userCoordinates?: Array<{ lat: number; lng: number } | null | undefined>,
  userIp?: string
): Promise<{
  searchCenter: { lat: number; lng: number };
  searchRadiusMeters: number;
  primaryLocation: string;
}> {
  // Use coordinates directly if available (avoid geocoding)
  const validCoordinates = userCoordinates?.filter(coord => coord && coord.lat && coord.lng) || [];

  if (validCoordinates.length > 0) {
    if (validCoordinates.length === 1) {
      return {
        searchCenter: validCoordinates[0]!,
        searchRadiusMeters: 1500, // 1.5km for single location
        primaryLocation: userLocations[0] || 'User location'
      };
    } else {
      // Multiple coordinates - calculate midpoint
      const midpoint = calculateMidpoint(validCoordinates[0]!, validCoordinates[1]!);
      return {
        searchCenter: midpoint.coordinates,
        searchRadiusMeters: midpoint.search_radius_meters,
        primaryLocation: userLocations[0] || 'User location'
      };
    }
  }

  // Fallback to geocoding if no coordinates available
  const validLocations = userLocations.filter(loc => loc && loc.trim());

  if (validLocations.length === 0) {
    // Fallback to IP-based location
    if (userIp) {
      console.log(`📍 No user locations provided, falling back to IP geolocation for ${userIp}`);

      // Development fallback for localhost
      if (userIp === '127.0.0.1' || userIp === '::1' || userIp.startsWith('192.168.') || userIp.startsWith('10.') || userIp.startsWith('100.')) {
        const devFallbackLocation = 'San Francisco, CA';
        console.log(`🔧 Development mode detected (IP: ${userIp}), using fallback: ${devFallbackLocation}`);
        const geocoded = await geocodeAddress(devFallbackLocation);
        return {
          searchCenter: geocoded.coordinates,
          searchRadiusMeters: 1500, // 1.5km for single location (matches <3km distance logic)
          primaryLocation: devFallbackLocation
        };
      }

      const { getIPLocation } = await import('@/server/location/ip-geolocation');
      const ipLocation = await getIPLocation(userIp);

      if (ipLocation.city && ipLocation.state) {
        const fallbackLocation = `${ipLocation.city}, ${ipLocation.state}`;
        console.log(`✅ Using IP-based location: ${fallbackLocation}`);
        const geocoded = await geocodeAddress(fallbackLocation);
        return {
          searchCenter: geocoded.coordinates,
          searchRadiusMeters: 1500, // 1.5km for single location (matches <3km distance logic)
          primaryLocation: fallbackLocation
        };
      }
    }

    throw new Error('No valid user locations provided and IP geolocation unavailable');
  }

  const primaryLocation = validLocations[0];

  if (validLocations.length === 1) {
    // Single location - geocode it
    const geocoded = await geocodeAddress(primaryLocation);
    return {
      searchCenter: geocoded.coordinates,
      searchRadiusMeters: 1500, // 1.5km for single location (matches <3km distance logic)
      primaryLocation
    };
  }

  // Multiple locations - calculate midpoint
  const geocodedLocations = await Promise.all(
    validLocations.map(async (location) => {
      const result = await geocodeAddress(location);
      return result.coordinates;
    })
  );

  const midpoint = calculateMidpoint(geocodedLocations[0], geocodedLocations[1]);
  return {
    searchCenter: midpoint.coordinates,
    searchRadiusMeters: midpoint.search_radius_meters,
    primaryLocation
  };
}

// Fallback activity suggestions
function getDefaultActivitySuggestions(): ActivitySuggestion[] {
  return [
    {
      activity: 'coffee',
      searchQuery: 'specialty coffee shops',
      description: 'Great for casual conversations',
      suggestedPlaceTypes: ['cafe', 'restaurant']
    },
    {
      activity: 'parks',
      searchQuery: 'parks and recreation areas',
      description: 'Outdoor activities and fresh air',
      suggestedPlaceTypes: ['park', 'tourist_attraction']
    },
    {
      activity: 'restaurants',
      searchQuery: 'highly rated restaurants',
      description: 'Dining and culinary experiences',
      suggestedPlaceTypes: ['restaurant']
    },
    {
      activity: 'cultural sites',
      searchQuery: 'museums and cultural attractions',
      description: 'Local culture and history',
      suggestedPlaceTypes: ['museum', 'tourist_attraction']
    }
  ];
}