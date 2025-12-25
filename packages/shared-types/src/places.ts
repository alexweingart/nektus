// Core types
export interface Coordinates {
  lat: number;
  lng: number;
}

// Search request - combines what was LocationSearchParams and SearchQuery
export interface PlaceSearchRequest {
  userA_address: string;
  userB_address: string;
  meeting_type: string; // flexible string for any meeting type
  datetime: string; // ISO string
  duration?: number; // minutes, optional
}

// Place result - simplified from LocationSuggestion
export interface Place {
  place_id: string;
  name: string;
  address: string;
  coordinates: Coordinates;
  description?: string; // venue description from Foursquare
  tips?: string[]; // user reviews/tips from Foursquare (text only)
  rating?: number; // 0-5 scale (converted from Foursquare's 0-10 scale)
  price_level?: number; // 1-4 scale
  google_maps_url: string;
  google_place_id?: string; // Google Place ID for accurate Maps URLs
  distance_from_midpoint_km?: number;
  opening_hours?: {
    open_now?: boolean;
    periods?: Array<{
      open: { day: number; hour: number; minute: number };
      close?: { day: number; hour: number; minute: number };
    }>;
    weekday_text?: string[];
  };
}

// API Response - renamed from LocationSuggestionsResponse
export interface PlacesResponse {
  [meetingType: string]: Place[] | unknown; // Dynamic keys for different meeting types
  metadata: {
    search_center: Coordinates;
    search_radius_km: number;
    request_timestamp: string;
  };
}

// Internal processing types
export interface MidpointCalculation {
  coordinates: Coordinates;
  search_radius_meters: number;
}

export interface GeocodeResult {
  coordinates: Coordinates;
  formatted_address: string;
  place_id?: string;
}

// Error types - renamed from LocationError
export interface PlaceError {
  code: 'GEOCODING_FAILED' | 'NO_RESULTS' | 'API_ERROR' | 'INVALID_ADDRESS' | 'QUOTA_EXCEEDED';
  message: string;
  details?: unknown;
}
