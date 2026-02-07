import { NextRequest, NextResponse } from 'next/server';
import { geocodeAddress } from '@/server/location/geocoding';
import { calculateMidpoint, calculateDistance } from '@/server/location/location';
import { getIPLocation } from '@/server/location/ip-geolocation';
import { searchPlacesByType } from '@/server/places/foursquare';
import {
  PlaceSearchRequest,
  PlacesResponse,
  Place,
  PlaceError
} from '@/types/places';

/**
 * Get client IP from request headers
 */
function getClientIp(request: NextRequest): string {
  // Check various headers for client IP (in order of preference)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can be a comma-separated list, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Vercel-specific header
  const vercelForwardedFor = request.headers.get('x-vercel-forwarded-for');
  if (vercelForwardedFor) {
    return vercelForwardedFor.split(',')[0].trim();
  }

  return '127.0.0.1';
}

/**
 * Check if an IP is a private/development IP that won't resolve via ipinfo.io
 */
function isPrivateOrDevIp(ip: string): boolean {
  if (ip === '127.0.0.1' || ip === '::1') return true;
  if (ip.startsWith('192.168.') || ip.startsWith('10.')) return true;
  if (ip.startsWith('172.')) {
    const secondOctet = parseInt(ip.split('.')[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) return true; // 172.16.0.0/12
  }
  // Tailscale / CGNAT range (100.64.0.0/10)
  if (ip.startsWith('100.')) {
    const secondOctet = parseInt(ip.split('.')[1], 10);
    if (secondOctet >= 64 && secondOctet <= 127) return true;
  }
  return false;
}

/**
 * Get fallback location from IP address
 */
async function getIpBasedLocation(ip: string): Promise<string | null> {
  try {
    // Development/private IP fallback — these won't resolve via ipinfo.io
    if (isPrivateOrDevIp(ip)) {
      console.log(`🔧 Private/dev IP detected (${ip}), using fallback: San Francisco, CA`);
      return 'San Francisco, CA';
    }

    const ipLocation = await getIPLocation(ip);

    if (ipLocation.city && ipLocation.state) {
      const location = `${ipLocation.city}, ${ipLocation.state}`;
      console.log(`📍 Using IP-based location: ${location}`);
      return location;
    }

    // ipinfo returned data but no city/state — use state or country if available
    if (ipLocation.state) {
      console.log(`📍 Using partial IP location (state only): ${ipLocation.state}`);
      return ipLocation.state;
    }

    console.warn(`⚠️ IP geolocation returned no usable location for ${ip}`);
    return null;
  } catch (error) {
    console.error('Failed to get IP-based location:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as PlaceSearchRequest & { useIpFallback?: boolean };

    // Validate meeting_type and datetime are always required
    if (!body.meeting_type || !body.datetime) {
      return NextResponse.json(
        { error: 'Missing required fields: meeting_type, datetime' },
        { status: 400 }
      );
    }

    // Handle address fallback
    let userAAddress = body.userA_address;
    let userBAddress = body.userB_address;

    // If addresses are missing and IP fallback is requested, use IP geolocation
    if ((!userAAddress || !userBAddress) && body.useIpFallback !== false) {
      const clientIp = getClientIp(request);
      console.log(`📍 Missing addresses, attempting IP fallback for IP: ${clientIp}`);

      const ipLocation = await getIpBasedLocation(clientIp);

      if (ipLocation) {
        if (!userAAddress) userAAddress = ipLocation;
        if (!userBAddress) userBAddress = ipLocation;
        console.log(`✅ Using IP-based fallback location: ${ipLocation}`);
      }
    }

    // Final validation - we need at least one address after fallback attempts
    if (!userAAddress && !userBAddress) {
      return NextResponse.json(
        { error: 'No location available. Please set a location in your profile.' },
        { status: 400 }
      );
    }

    // If only one address, use it for both
    if (!userAAddress) userAAddress = userBAddress;
    if (!userBAddress) userBAddress = userAAddress;

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

    // Geocode both addresses (using resolved addresses with IP fallback applied)
    const [userALocation, userBLocation] = await Promise.all([
      geocodeAddress(userAAddress!),
      geocodeAddress(userBAddress!),
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
