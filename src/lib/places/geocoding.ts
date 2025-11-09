import { Coordinates, PlaceError, GeocodeResult } from '@/types/places';

/**
 * Convert an address string to coordinates using Google Maps Geocoding API
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    const error: PlaceError = {
      code: 'API_ERROR',
      message: 'Google Maps API key not configured',
    };
    throw error;
  }

  if (!address || address.trim().length === 0) {
    const error: PlaceError = {
      code: 'INVALID_ADDRESS',
      message: 'Address cannot be empty',
    };
    throw error;
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', address.trim());
    url.searchParams.set('key', apiKey);

    console.log(`🌍 Geocoding address: "${address.trim()}"`);

    const response = await fetch(url.toString(), {
      method: 'GET',
    });

    const data = await response.json();

    if (data.status === 'ZERO_RESULTS') {
      const error: PlaceError = {
        code: 'NO_RESULTS',
        message: `No results found for address: ${address}`,
      };
      throw error;
    }

    if (data.status === 'OVER_QUERY_LIMIT') {
      const error: PlaceError = {
        code: 'QUOTA_EXCEEDED',
        message: 'Google Maps API quota exceeded',
      };
      throw error;
    }

    if (data.status !== 'OK' || !data.results[0]) {
      const error: PlaceError = {
        code: 'GEOCODING_FAILED',
        message: `Geocoding failed: ${data.status}`,
        details: data,
      };
      throw error;
    }

    const result = data.results[0];
    const location = result.geometry.location;

    console.log(`✅ Geocoded to: ${result.formatted_address} (${location.lat}, ${location.lng})`);

    return {
      coordinates: {
        lat: location.lat,
        lng: location.lng,
      },
      formatted_address: result.formatted_address,
      place_id: result.place_id,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      throw error;
    }

    // Handle network/API errors
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ECONNABORTED') {
      const locationError: PlaceError = {
        code: 'API_ERROR',
        message: 'Request timeout - please try again',
      };
      throw locationError;
    }

    const locationError: PlaceError = {
      code: 'API_ERROR',
      message: 'Failed to geocode address',
      details: error,
    };
    throw locationError;
  }
}

/**
 * Batch geocode multiple addresses
 */
export async function geocodeAddresses(addresses: string[]): Promise<GeocodeResult[]> {
  const results = await Promise.allSettled(
    addresses.map(address => geocodeAddress(address))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      const error: PlaceError = {
        code: 'GEOCODING_FAILED',
        message: `Failed to geocode address ${index + 1}: ${addresses[index]}`,
        details: result.reason,
      };
      throw error;
    }
  });
}

/**
 * Reverse geocode coordinates to get address
 */
export async function reverseGeocode(coordinates: Coordinates): Promise<string> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    const error: PlaceError = {
      code: 'API_ERROR',
      message: 'Google Maps API key not configured',
    };
    throw error;
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${coordinates.lat},${coordinates.lng}`);
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString(), {
      method: 'GET',
    });

    const data = await response.json();

    if (data.status !== 'OK' || !data.results[0]) {
      const error: PlaceError = {
        code: 'GEOCODING_FAILED',
        message: 'Reverse geocoding failed',
        details: data,
      };
      throw error;
    }

    return data.results[0].formatted_address;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      throw error;
    }

    const locationError: PlaceError = {
      code: 'API_ERROR',
      message: 'Failed to reverse geocode coordinates',
      details: error,
    };
    throw locationError;
  }
}