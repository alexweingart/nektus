import type { Coordinates } from '@/types/places';

/**
 * Find a Google Place ID using the Text Search (New) API
 * This is used to get accurate Google Maps URLs for places found via Foursquare
 */
export async function getGooglePlaceId(
  placeName: string,
  coordinates: Coordinates
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.warn('⚠️ Google Maps API key not configured, skipping Place ID lookup');
    return null;
  }

  try {
    // Use Text Search (New) API with location bias for accuracy
    // https://developers.google.com/maps/documentation/places/web-service/text-search
    const url = 'https://places.googleapis.com/v1/places:searchText';

    console.log(`🔍 Fetching Google Place ID for "${placeName}" at (${coordinates.lat}, ${coordinates.lng})`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName',
      },
      body: JSON.stringify({
        textQuery: placeName,
        locationBias: {
          circle: {
            center: {
              latitude: coordinates.lat,
              longitude: coordinates.lng,
            },
            radius: 500.0, // Bias results within 500m of the coordinates
          },
        },
      }),
    });

    console.log(`📡 Google Places API response status: ${response.status}`);

    const data = await response.json();
    console.log(`📦 Google Places API response data:`, JSON.stringify(data).substring(0, 500));

    if (!response.ok) {
      console.warn(`⚠️ Google Places API error for "${placeName}": ${response.status} - ${JSON.stringify(data)}`);
      return null;
    }

    if (data.places && data.places.length > 0) {
      const placeId = data.places[0].id;
      console.log(`✅ Found Google Place ID for "${placeName}": ${placeId}`);
      return placeId;
    } else {
      console.warn(`⚠️ No Google Place ID found for "${placeName}"`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error getting Google Place ID for "${placeName}":`, error);
    return null;
  }
}

/**
 * Batch lookup Google Place IDs for multiple places
 * Runs in parallel for minimal latency
 */
export async function getGooglePlaceIds(
  places: Array<{ name: string; coordinates: Coordinates }>
): Promise<Map<string, string>> {
  console.log(`🔍 Looking up Google Place IDs for ${places.length} places...`);

  const startTime = Date.now();

  // Run all lookups in parallel
  const results = await Promise.all(
    places.map(async (place) => ({
      name: place.name,
      placeId: await getGooglePlaceId(place.name, place.coordinates)
    }))
  );

  const elapsed = Date.now() - startTime;
  console.log(`⏱️ Google Place ID lookup completed in ${elapsed}ms`);

  // Convert to Map for easy lookup
  const placeIdMap = new Map<string, string>();
  results.forEach(({ name, placeId }) => {
    if (placeId) {
      placeIdMap.set(name, placeId);
    }
  });

  console.log(`✅ Successfully found ${placeIdMap.size}/${places.length} Google Place IDs`);
  return placeIdMap;
}
