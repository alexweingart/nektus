/**
 * IP Geolocation Service
 * Uses IPinfo.io API with Redis caching for geographic location and VPN detection
 */

import { redis, isRedisAvailable } from '@/lib/config/redis';

interface IPLocationData {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  org?: string;
  hosting?: boolean;
  vpn?: boolean;
  tor?: boolean;
  loc?: string; // "lat,lng"
}

export interface ProcessedLocation {
  ip: string;
  city?: string;
  state?: string;
  country?: string;
  isVPN: boolean;
  octet: string;
  confidence: 'vpn' | 'city' | 'state' | 'octet';
  cached?: boolean;
  raw?: IPLocationData;
}

// Known VPN/proxy providers (common ASN patterns)
const VPN_PROVIDERS = [
  'cloudflare',
  'vpn',
  'proxy',
  'hosting',
  'datacenter',
  'amazon',
  'google cloud',
  'microsoft',
  'digital ocean',
  'linode'
];

/**
 * Get IP location data with caching
 */
export async function getIPLocation(ip: string): Promise<ProcessedLocation> {
  // Handle localhost and private IPs
  if (ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return {
      ip,
      isVPN: false,
      octet: ip.split('.')[0],
      confidence: 'octet',
      cached: false
    };
  }

  // Check Redis cache first
  const cacheKey = `ip_geo:${ip}`;
  if (isRedisAvailable()) {
    try {
      const cached = await redis!.get(cacheKey);
      if (cached && typeof cached === 'string') {
        const parsed = JSON.parse(cached) as ProcessedLocation;
        parsed.cached = true;
        console.log(`📍 Using cached location for ${ip}: ${parsed.city || parsed.state || 'unknown'}`);
        return parsed;
      }
    } catch (error) {
      console.warn('Redis cache read failed for IP location:', error);
    }
  }

  // Fetch from IPinfo.io
  let locationData: IPLocationData;
  try {
    console.log(`🌍 Fetching location for IP: ${ip}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch(`https://ipinfo.io/${ip}/json`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Nektus/1.0'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`IPinfo API error: ${response.status}`);
    }

    locationData = await response.json();
    console.log(`📍 IPinfo response for ${ip}:`, {
      city: locationData.city,
      region: locationData.region,
      country: locationData.country,
      org: locationData.org,
      hosting: locationData.hosting,
      vpn: locationData.vpn
    });

  } catch (error) {
    console.warn(`Failed to fetch location for ${ip}:`, error);
    
    // Return fallback with octet matching (ensure this always works)
    const fallback = {
      ip,
      isVPN: false,
      octet: ip.split('.')[0],
      confidence: 'octet' as const,
      cached: false
    };
    
    console.log(`📍 Using fallback location for ${ip}:`, fallback);
    return fallback;
  }

  // Process the location data
  const processed = processLocationData(locationData);
  processed.cached = false; // Fresh lookup
  
  // Cache the result (24 hour TTL)
  if (isRedisAvailable()) {
    try {
      await redis!.setex(cacheKey, 24 * 60 * 60, JSON.stringify(processed));
    } catch (error) {
      console.warn('Redis cache write failed for IP location:', error);
    }
  }

  return processed;
}

/**
 * Process raw IPinfo data into standardized format
 */
function processLocationData(data: IPLocationData): ProcessedLocation {
  const isVPN = detectVPN(data);
  const octet = data.ip.split('.')[0];
  
  // Determine confidence level based on available data and VPN status
  let confidence: 'vpn' | 'city' | 'state' | 'octet';
  
  if (isVPN) {
    confidence = 'vpn';
  } else if (data.city && data.region) {
    confidence = 'city';
  } else if (data.region) {
    confidence = 'state';
  } else {
    confidence = 'octet';
  }

  return {
    ip: data.ip,
    city: data.city,
    state: data.region,
    country: data.country,
    isVPN,
    octet,
    confidence,
    raw: data
  };
}

/**
 * Detect if IP is from VPN/proxy/hosting provider
 */
function detectVPN(data: IPLocationData): boolean {
  // Direct VPN detection from IPinfo
  if (data.vpn === true || data.hosting === true || data.tor === true) {
    return true;
  }

  // Check organization name for VPN patterns
  if (data.org) {
    const orgLower = data.org.toLowerCase();
    return VPN_PROVIDERS.some(provider => orgLower.includes(provider));
  }

  return false;
}


/**
 * Compare two locations for matching confidence
 */
export function getMatchConfidence(location1: ProcessedLocation, location2: ProcessedLocation): {
  confidence: 'vpn' | 'city' | 'state' | 'octet' | 'no_match';
  timeWindow: number;
} {
  const timeWindows = {
    vpn: 200,
    city: 500,
    state: 400,
    octet: 300
  };

  // VPN users get VPN confidence regardless of location data
  if (location1.isVPN || location2.isVPN) {
    return { confidence: 'vpn', timeWindow: timeWindows.vpn };
  }

  // Same city matching
  if (location1.city && location2.city && 
      location1.city === location2.city &&
      location1.state === location2.state &&
      location1.country === location2.country) {
    return { confidence: 'city', timeWindow: timeWindows.city };
  }

  // Same state matching
  if (location1.state && location2.state &&
      location1.state === location2.state &&
      location1.country === location2.country) {
    return { confidence: 'state', timeWindow: timeWindows.state };
  }

  // Same octet matching
  if (location1.octet === location2.octet) {
    return { confidence: 'octet', timeWindow: timeWindows.octet };
  }

  // No geographic overlap
  return { confidence: 'no_match', timeWindow: 0 };
}