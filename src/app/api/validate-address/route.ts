import { NextRequest, NextResponse } from 'next/server';

export interface RadarAddressValidationRequest {
  address: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface RadarAddressValidationResponse {
  success: boolean;
  valid: boolean;
  formatted?: {
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  coordinates?: {
    lat: number;
    lng: number;
  };
  suggestions?: Array<{
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }>;
  error?: string;
  confidence?: 'exact' | 'high' | 'medium' | 'low';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RadarAddressValidationRequest;

    // Validate required fields
    if (!body.address && !body.city) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: 'Either address or city is required'
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.RADAR_TEST_SECRET_KEY || process.env.RADAR_LIVE_SECRET_KEY;


    if (!apiKey) {
      console.error('Missing Radar API key');
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
      body.state,
      body.postalCode,
      body.country
    ].filter(Boolean);

    const fullAddress = addressParts.join(', ');

    console.log('Validating address with Radar:', fullAddress);

    // Construct URL with query parameters
    const url = new URL('https://api.radar.io/v1/geocode/forward');
    url.searchParams.set('query', fullAddress);
    // Restrict to supported countries only
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
      console.error('Radar API error:', radarData);
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

    const response_data: RadarAddressValidationResponse = {
      success: true,
      valid: true,
      formatted: {
        address: bestMatch.formattedAddress || bestMatch.addressLabel || '',
        city: bestMatch.city || '',
        state: bestMatch.state || '',
        postalCode: bestMatch.postalCode || '',
        country: bestMatch.country || ''
      },
      coordinates: {
        lat: bestMatch.latitude,
        lng: bestMatch.longitude
      },
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
        state: addr.state || '',
        postalCode: addr.postalCode || '',
        country: addr.country || ''
      }))
    };

    return NextResponse.json(response_data);

  } catch (error) {
    console.error('Address validation API error:', error);
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

// Handle GET requests for simple address validation
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const address = searchParams.get('address');
  const city = searchParams.get('city');
  const state = searchParams.get('state');
  const postalCode = searchParams.get('postalCode');
  const country = searchParams.get('country');

  if (!address && !city) {
    return NextResponse.json(
      {
        success: false,
        valid: false,
        error: 'Either address or city parameter is required'
      },
      { status: 400 }
    );
  }

  // Convert to POST format and reuse POST handler
  const body: RadarAddressValidationRequest = {
    address: address || '',
    city: city || '',
    state: state || '',
    postalCode: postalCode || '',
    country: country || ''
  };

  // Create a new request with the body
  const postRequest = new NextRequest(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return POST(postRequest);
}