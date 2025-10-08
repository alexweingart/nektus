/**
 * Location Validation API - Uses Radar to validate addresses
 * Part of Phase 4: Location Management
 */

import { NextRequest, NextResponse } from 'next/server';

export interface RadarAddressValidationRequest {
  address?: string;
  city: string;
  region: string;  // State/Province
  zip?: string;
  country: string;
}

export interface RadarAddressValidationResponse {
  success: boolean;
  valid: boolean;
  formatted?: {
    address: string;
    city: string;
    region: string;
    zip: string;
    country: string;
  };
  coordinates?: {
    lat: number;
    lng: number;
  };
  radarPlaceId?: string;
  suggestions?: Array<{
    address: string;
    city: string;
    region: string;
    zip: string;
    country: string;
  }>;
  error?: string;
  confidence?: 'exact' | 'high' | 'medium' | 'low';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RadarAddressValidationRequest;

    // Validate required fields
    if (!body.city || !body.region || !body.country) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: 'City, region, and country are required'
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.RADAR_SECRET_KEY;

    if (!apiKey) {
      console.error('[Location Validate] Missing Radar API key');
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: 'Address validation service not configured'
        },
        { status: 500 }
      );
    }

    // Build the address string for Radar API
    const addressParts = [
      body.address,
      body.city,
      body.region,
      body.zip,
      body.country
    ].filter(Boolean);

    const fullAddress = addressParts.join(', ');

    console.log('[Location Validate] Validating address with Radar:', fullAddress);

    // Construct URL with query parameters
    const url = new URL('https://api.radar.io/v1/geocode/forward');
    url.searchParams.set('query', fullAddress);
    // Restrict to supported countries only (USA, Canada, Australia)
    url.searchParams.set('country', 'US,CA,AU');

    const radarResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
    });

    const radarData = await radarResponse.json();

    if (!radarResponse.ok) {
      console.error('[Location Validate] Radar API error:', radarData);
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: 'Address validation service error'
        },
        { status: 500 }
      );
    }

    // Check if Radar found valid addresses
    if (!radarData.addresses || radarData.addresses.length === 0) {
      return NextResponse.json({
        success: true,
        valid: false,
        error: 'No valid address found',
        suggestions: []
      });
    }

    // Get the best match (first result)
    const bestMatch = radarData.addresses[0];

    // Determine confidence level based on Radar's confidence score
    const getConfidenceLevel = (confidence: number): 'exact' | 'high' | 'medium' | 'low' => {
      if (confidence >= 0.9) return 'exact';
      if (confidence >= 0.7) return 'high';
      if (confidence >= 0.5) return 'medium';
      return 'low';
    };

    const responseData: RadarAddressValidationResponse = {
      success: true,
      valid: true,
      formatted: {
        address: bestMatch.formattedAddress || bestMatch.addressLabel || body.address || '',
        city: bestMatch.city || body.city,
        region: bestMatch.state || body.region,
        zip: bestMatch.postalCode || body.zip || '',
        country: bestMatch.country || body.country
      },
      coordinates: {
        lat: bestMatch.latitude,
        lng: bestMatch.longitude
      },
      radarPlaceId: bestMatch.placeId,
      confidence: getConfidenceLevel(bestMatch.confidence || 0.5),
      suggestions: radarData.addresses.slice(1, 4).map((addr: {
        formattedAddress?: string;
        addressLabel?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
      }) => ({
        address: addr.formattedAddress || addr.addressLabel || '',
        city: addr.city || '',
        region: addr.state || '',
        zip: addr.postalCode || '',
        country: addr.country || ''
      }))
    };

    console.log('[Location Validate] Validation successful with confidence:', responseData.confidence);

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('[Location Validate] API error:', error);
    return NextResponse.json(
      {
        success: false,
        valid: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}
