import type { Place } from '@/types/places';
import type { DetermineIntentResult } from '@/types/ai-scheduling';
import { geocodeAddress } from '@/lib/places/geocoding';
import { calculateMidpoint } from '@/lib/location/location-utils';
import { searchLocalEvents } from './search-events';
import { createCompletion, getModelForTask, getReasoningEffortForTask } from '@/lib/ai/scheduling/openai-client';
import { searchFoursquarePlaces, getFoursquareCategoriesForActivity } from '@/lib/places/foursquare-client';

export interface PlaceSearchParams {
  intentResult: DetermineIntentResult;
  userLocations: string[];
  dateTime?: string;
  timeframe?: 'today' | 'tomorrow' | 'this weekend' | 'next week';
}

export interface ActivitySuggestion {
  activity: string;
  searchQuery: string;
  description: string;
  suggestedPlaceTypes?: string[]; // Foursquare category IDs
}

export interface SpecialEvent {
  eventName: string;
  eventDescription: string;
  eventDate?: string;
  eventTime?: string;
  eventType?: string;
  url?: string;
}

export interface SpecialEventPlace extends Place, SpecialEvent {
  // Inherits all Place fields + SpecialEvent fields
}

export async function searchPlaces(params: PlaceSearchParams): Promise<Place[]> {
  const { intentResult, userLocations, dateTime: _dateTime, timeframe = 'tomorrow' } = params;

  console.log(`🎯 determineThingsToDo called with specificity: ${intentResult.intentSpecificity}`);

  try {
    switch (intentResult.intentSpecificity) {
      case 'specific_place':
        return await searchSpecificPlace(intentResult.specificPlace!, userLocations, intentResult.suggestedPlaceTypes);

      case 'activity_type':
        return await searchPlacesByActivity(intentResult.activitySearchQuery!, userLocations, intentResult);

      case 'generic':
        return await searchGenericActivities(userLocations, timeframe);

      default:
        console.log('⚠️ Unknown intent specificity, defaulting to empty results');
        return [];
    }
  } catch (error) {
    console.error('Error in determineThingsToDo:', error);
    return [];
  }
}

// Tier 1: Specific Place Search
async function searchSpecificPlace(
  placeName: string,
  userLocations: string[],
  suggestedPlaceTypes?: string[]
): Promise<Place[]> {
  console.log(`🔍 Tier 1: Searching for specific place: ${placeName}`);

  try {
    // Calculate midpoint between users for search center
    const { searchCenter } = await getMidpointFromLocations(userLocations);

    // For specific places, try with no category first (best match), then with suggested categories
    try {
      const places = await searchFoursquarePlaces(
        searchCenter,
        10000, // 10km radius
        placeName,
        undefined // No category filter for specific place search
      );

      if (places.length > 0) {
        console.log(`✅ Found ${places.length} matches for specific place: ${placeName}`);
        return places.slice(0, 1); // Return only the best match
      }
    } catch (error) {
      console.log(`   Search failed for specific place: ${placeName}`, error);
    }

    console.log(`⚠️ No matches found for specific place: ${placeName}`);
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
  intentResult: DetermineIntentResult
): Promise<Place[]> {
  console.log(`🎾 Tier 2: Searching for activity: ${activitySearchQuery}`);
  console.log(`🔍 Intent result received:`, intentResult);

  try {
    // Calculate midpoint between users for search center
    const { searchCenter } = await getMidpointFromLocations(userLocations);

    // Use Foursquare categories from intent detection, with fallback
    const categories = intentResult.suggestedPlaceTypes || getFoursquareCategoriesForActivity(activitySearchQuery);
    console.log(`🎯 Using Foursquare categories for "${activitySearchQuery}": ${categories.length} categories`);

    const allPlaces: Place[] = [];

    // Try each suggested category for this activity
    for (const category of categories) {
      try {
        const places = await searchFoursquarePlaces(
          searchCenter,
          15000, // 15km radius for activity search
          activitySearchQuery,
          category
        );

        allPlaces.push(...places);
        console.log(`   Found ${places.length} places for category: ${category}`);

      } catch {
        console.log(`   Category ${category} failed for activity search, continuing...`);
        continue;
      }
    }

    // Remove duplicates and sort by rating
    const uniquePlaces = deduplicatePlaces(allPlaces);
    console.log(`✅ Found ${uniquePlaces.length} unique places for activity: ${activitySearchQuery}`);
    return uniquePlaces.slice(0, 10); // Return top 10 results

  } catch (error) {
    console.error('Error searching for places by activity:', error);
    return [];
  }
}

// Tier 3: Generic Activity Discovery
async function searchGenericActivities(
  userLocations: string[],
  timeframe: string
): Promise<Place[]> {
  console.log(`🌟 Tier 3: Generic activity discovery for timeframe: ${timeframe}`);

  try {
    // Calculate midpoint for context
    const { searchCenter, primaryLocation } = await getMidpointFromLocations(userLocations);

    // 3A & 3B: Run in parallel
    const [activitySuggestions, specialEvents] = await Promise.all([
      // 3A: LLM suggests general activities
      suggestActivitiesWithLLM(primaryLocation, timeframe),
      // 3B: Web search for special events
      searchSpecialEvents(primaryLocation, timeframe)
    ]);

    console.log(`📋 3A: LLM suggested ${activitySuggestions.length} activities`);
    console.log(`🎪 3B: Found ${specialEvents.length} special events`);

    // 3C: Find places for each LLM-suggested activity
    const activityPlaces = await findPlacesForActivities(activitySuggestions, searchCenter);

    // 3D: Combine activity places with special event places
    const allPlaces = [...activityPlaces, ...specialEvents];

    console.log(`✅ Total places found: ${allPlaces.length} (${activityPlaces.length} activity + ${specialEvents.length} events)`);
    return allPlaces;

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
  console.log(`🧠 3A: Getting LLM activity suggestions for ${location}`);

  const prompt = `You are a local activity expert. Suggest 3-5 diverse activities for ${timeframe} in ${location}.

For each activity, provide:
1. Activity name (short, e.g., "hiking", "museums", "coffee tasting")
2. Search query for finding venues (e.g., "hiking trails", "art museums", "specialty coffee shops")
3. Brief description of why it's good for this location/timeframe
4. Suggested Google Places API types (e.g., ["park", "tourist_attraction"] for hiking, ["cafe", "restaurant"] for coffee, ["museum"] for museums)

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

    // Handle both array and object with activities key
    const activities = Array.isArray(parsed) ? parsed : (parsed.activities || []);

    console.log(`✅ LLM suggested ${activities.length} activities`);
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
  console.log(`🌐 3B: Searching for special events in ${location}`);

  try {
    // Search for real events using OpenAI's web search and get structured data
    const eventResults = await searchLocalEvents(location, timeframe);

    if (eventResults.length === 0) {
      console.log(`⚠️ No structured events found for ${location}`);
      return [];
    }

    // Convert EventSearchResult to SpecialEventPlace format with real geocoding
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

    console.log(`✅ Found ${specialEventPlaces.length} structured special events for ${location}`);
    return specialEventPlaces;

  } catch (error) {
    console.error('Error searching for special events:', error);
    return [];
  }
}

// 3C: Find Places for Activities
async function findPlacesForActivities(
  activities: ActivitySuggestion[],
  searchCenter: { lat: number; lng: number }
): Promise<Place[]> {
  console.log(`🔍 3C: Finding places for ${activities.length} activities`);

  const allPlaces: Place[] = [];

  for (const activity of activities) {
    try {
      console.log(`   Searching for: ${activity.searchQuery}`);

      // Use LLM-suggested Foursquare categories if available, otherwise infer from search query
      const categories = activity.suggestedPlaceTypes && activity.suggestedPlaceTypes.length > 0
        ? activity.suggestedPlaceTypes
        : getFoursquareCategoriesForActivity(activity.searchQuery);

      for (const category of categories) {
        try {
          const places = await searchFoursquarePlaces(
            searchCenter,
            12000, // 12km radius
            activity.searchQuery,
            category
          );

          // Take top 2-3 places per activity to maintain diversity
          const topPlaces = places.slice(0, 3);
          allPlaces.push(...topPlaces);

          console.log(`   Found ${places.length} places for ${activity.activity} (category: ${category}), taking top ${topPlaces.length}`);

        } catch {
          console.log(`   Category ${category} failed for activity ${activity.activity}, continuing...`);
          continue;
        }
      }

    } catch (_error) {
      console.error(`Error searching for activity ${activity.activity}:`, _error);
    }
  }

  return allPlaces;
}

// Helper: Calculate midpoint from user locations
async function getMidpointFromLocations(userLocations: string[]): Promise<{
  searchCenter: { lat: number; lng: number };
  primaryLocation: string;
}> {
  const validLocations = userLocations.filter(loc => loc && loc.trim());

  if (validLocations.length === 0) {
    throw new Error('No valid user locations provided');
  }

  const primaryLocation = validLocations[0];

  if (validLocations.length === 1) {
    // Single location - geocode it
    const geocoded = await geocodeAddress(primaryLocation);
    return {
      searchCenter: geocoded.coordinates,
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

  // For multiple locations, use the first two coordinates for midpoint calculation
  if (geocodedLocations.length >= 2) {
    const midpoint = calculateMidpoint(geocodedLocations[0], geocodedLocations[1]);
    return {
      searchCenter: midpoint.coordinates,
      primaryLocation
    };
  } else {
    // Single location (shouldn't happen as we handle this case above, but safety fallback)
    return {
      searchCenter: geocodedLocations[0],
      primaryLocation
    };
  }
}

// Note: This function is replaced by getFoursquareCategoriesForActivity from foursquare-client
// Removed - no longer used

// Helper: Remove duplicate places based on place_id
function deduplicatePlaces(places: Place[]): Place[] {
  const seen = new Set<string>();
  return places.filter(place => {
    if (seen.has(place.place_id)) {
      return false;
    }
    seen.add(place.place_id);
    return true;
  });
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