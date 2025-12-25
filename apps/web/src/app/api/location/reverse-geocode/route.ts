/**
 * Reverse Geocoding API - Convert coordinates to address using Radar
 * Part of Phase 4: Location Management
 */

import { NextRequest, NextResponse } from 'next/server';

export interface ReverseGeocodeRequest {
  lat: number;
  lng: number;
}

export interface ReverseGeocodeResponse {
  success: boolean;
  address?: string;
  city?: string;
  region?: string;
  zip?: string;
  country?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  radarPlaceId?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ReverseGeocodeRequest;

    // Validate required fields
    if (typeof body.lat !== 'number' || typeof body.lng !== 'number') {
      return NextResponse.json(
        {
          success: false,
          error: 'Latitude and longitude are required'
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.RADAR_SECRET_KEY;

    if (!apiKey) {
      console.error('[Reverse Geocode] Missing Radar API key');
      return NextResponse.json(
        {
          success: false,
          error: 'Geocoding service not configured'
        },
        { status: 500 }
      );
    }

    console.log('[Reverse Geocode] Reverse geocoding coordinates:', body.lat, body.lng);

    // Construct URL with query parameters
    const url = new URL('https://api.radar.io/v1/geocode/reverse');
    url.searchParams.set('coordinates', `${body.lat},${body.lng}`);

    const radarResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
    });

    const radarData = await radarResponse.json();

    if (!radarResponse.ok) {
      console.error('[Reverse Geocode] Radar API error:', radarData);
      return NextResponse.json(
        {
          success: false,
          error: 'Geocoding service error'
        },
        { status: 500 }
      );
    }

    // Check if Radar found an address
    if (!radarData.addresses || radarData.addresses.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No address found for these coordinates'
      });
    }

    // Get the best match (first result)
    const bestMatch = radarData.addresses[0];

    // Extract just the street address (number + street)
    const streetAddress = bestMatch.number && bestMatch.street
      ? `${bestMatch.number} ${bestMatch.street}`
      : '';

    const responseData: ReverseGeocodeResponse = {
      success: true,
      address: streetAddress,
      city: bestMatch.city || '',
      region: bestMatch.state || '',
      zip: bestMatch.postalCode || '',
      country: bestMatch.country || bestMatch.countryCode || '',
      coordinates: {
        lat: bestMatch.latitude,
        lng: bestMatch.longitude
      },
      radarPlaceId: bestMatch.placeId
    };

    console.log('[Reverse Geocode] Successfully geocoded:', {
      city: responseData.city,
      region: responseData.region,
      country: responseData.country
    });

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('[Reverse Geocode] API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}
