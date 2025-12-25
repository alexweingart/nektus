import { NextRequest, NextResponse } from 'next/server';
import { geocodeAddress } from '@/lib/server/location/geocoding';
import { calculateMidpoint, calculateDistance } from '@/lib/server/location/location';
import { searchPlacesByType } from '@/lib/server/places/foursquare';
import {
  PlaceSearchRequest,
  PlacesResponse,
  Place,
  PlaceError
} from '@/types/places';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as PlaceSearchRequest;

    // Validate required fields
    if (!body.userA_address || !body.userB_address || !body.meeting_type || !body.datetime) {
      return NextResponse.json(
        { error: 'Missing required fields: userA_address, userB_address, meeting_type, datetime' },
        { status: 400 }
      );
    }

    // Validate meeting type is a non-empty string
    if (!body.meeting_type || typeof body.meeting_type !== 'string' || body.meeting_type.trim() === '') {
      return NextResponse.json(
        { error: 'Invalid meeting_type. Must be a non-empty string' },
        { status: 400 }
      );
    }

    // Parse and validate datetime
    const meetingDateTime = new Date(body.datetime);
    if (isNaN(meetingDateTime.getTime())) {
      return NextResponse.json(
        { error: 'Invalid datetime format. Use ISO string format.' },
        { status: 400 }
      );
    }

    // Geocode both addresses
    const [userALocation, userBLocation] = await Promise.all([
      geocodeAddress(body.userA_address),
      geocodeAddress(body.userB_address),
    ]);

    // Calculate optimal search location
    const midpointCalc = calculateMidpoint(
      userALocation.coordinates,
      userBLocation.coordinates
    );

    // Define search configuration for different meeting types
    const searchConfig: Record<string, { placeType: 'restaurant' | 'cafe' | 'food'; keywords?: string }> = {
      coffee: { placeType: 'cafe', keywords: 'coffee' },
      lunch: { placeType: 'restaurant', keywords: 'lunch' },
      dinner: { placeType: 'restaurant', keywords: 'dinner' },
      drinks: { placeType: 'restaurant', keywords: 'bar pub cocktail' },
      // Add more types as needed in the future
    };

    // Use default restaurant search if meeting type is not configured
    const config = searchConfig[body.meeting_type] || { placeType: 'restaurant', keywords: body.meeting_type };

    // Search for places based on meeting type
    const searchResults = await searchPlacesByType(
      midpointCalc.coordinates,
      midpointCalc.search_radius_meters,
      config.placeType,
      config.keywords,
      meetingDateTime
    );

    // Process results and calculate distances
    const suggestions = searchResults.slice(0, 3).map((place): Place => {
      const distanceFromMidpoint = calculateDistance(
        midpointCalc.coordinates,
        place.coordinates
      );

      return {
        ...place,
        distance_from_midpoint_km: Math.round(distanceFromMidpoint * 10) / 10,
      };
    });

    // Build response with dynamic meeting type key
    const response: PlacesResponse = {
      [body.meeting_type]: suggestions,
      metadata: {
        search_center: midpointCalc.coordinates,
        search_radius_km: Math.round(midpointCalc.search_radius_meters / 100) / 10,
        request_timestamp: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Location suggestions API error:', error);

    // Handle known error types
    if (error && typeof error === 'object' && 'code' in error) {
      const placeError = error as PlaceError;

      const statusMap = {
        'INVALID_ADDRESS': 400,
        'NO_RESULTS': 404,
        'QUOTA_EXCEEDED': 429,
        'API_ERROR': 500,
        'GEOCODING_FAILED': 400,
      };

      return NextResponse.json(
        {
          error: placeError.message,
          code: placeError.code,
          details: placeError.details
        },
        { status: statusMap[placeError.code] || 500 }
      );
    }

    // Handle unknown errors
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle GET requests with query parameters (optional convenience method)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const userA_address = searchParams.get('userA_address');
  const userB_address = searchParams.get('userB_address');
  const meeting_type = searchParams.get('meeting_type');
  const datetime = searchParams.get('datetime');
  const duration = searchParams.get('duration');

  if (!userA_address || !userB_address || !meeting_type || !datetime) {
    return NextResponse.json(
      { error: 'Missing required query parameters: userA_address, userB_address, meeting_type, datetime' },
      { status: 400 }
    );
  }

  // Convert to POST format and reuse POST handler
  const body: PlaceSearchRequest = {
    userA_address,
    userB_address,
    meeting_type,
    datetime,
    duration: duration ? parseInt(duration) : undefined,
  };

  // Create a new request with the body
  const postRequest = new NextRequest(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return POST(postRequest);
}
