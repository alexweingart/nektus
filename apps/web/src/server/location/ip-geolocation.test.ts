import { describe, it, expect } from 'vitest';
import {
  getMatchConfidence,
  detectVPN,
  processLocationData,
} from './ip-geolocation';
import type { ProcessedLocation, IPLocationData } from './ip-geolocation';

const makeLocation = (overrides: Partial<ProcessedLocation>): ProcessedLocation => ({
  ip: '1.2.3.4',
  isVPN: false,
  octet: '1',
  confidence: 'city',
  ...overrides,
});

describe('getMatchConfidence', () => {
  it('returns vpn when either location is VPN', () => {
    const loc1 = makeLocation({ isVPN: true, city: 'NYC', state: 'NY', country: 'US' });
    const loc2 = makeLocation({ city: 'NYC', state: 'NY', country: 'US' });
    const result = getMatchConfidence(loc1, loc2);
    expect(result.confidence).toBe('vpn');
    expect(result.timeWindow).toBe(200);
  });

  it('returns vpn when second location is VPN', () => {
    const loc1 = makeLocation({ city: 'NYC', state: 'NY', country: 'US' });
    const loc2 = makeLocation({ isVPN: true });
    expect(getMatchConfidence(loc1, loc2).confidence).toBe('vpn');
  });

  it('returns city when same city+state+country', () => {
    const loc1 = makeLocation({ city: 'NYC', state: 'NY', country: 'US' });
    const loc2 = makeLocation({ city: 'NYC', state: 'NY', country: 'US' });
    const result = getMatchConfidence(loc1, loc2);
    expect(result.confidence).toBe('city');
    expect(result.timeWindow).toBe(500);
  });

  it('returns state when same state+country but different city', () => {
    const loc1 = makeLocation({ city: 'NYC', state: 'NY', country: 'US' });
    const loc2 = makeLocation({ city: 'Buffalo', state: 'NY', country: 'US' });
    const result = getMatchConfidence(loc1, loc2);
    expect(result.confidence).toBe('state');
    expect(result.timeWindow).toBe(400);
  });

  it('returns octet when same first octet', () => {
    const loc1 = makeLocation({ city: 'NYC', state: 'NY', country: 'US', octet: '72' });
    const loc2 = makeLocation({ city: 'London', state: 'England', country: 'GB', octet: '72' });
    const result = getMatchConfidence(loc1, loc2);
    expect(result.confidence).toBe('octet');
    expect(result.timeWindow).toBe(300);
  });

  it('returns no_match when nothing matches', () => {
    const loc1 = makeLocation({ city: 'NYC', state: 'NY', country: 'US', octet: '72' });
    const loc2 = makeLocation({ city: 'London', state: 'England', country: 'GB', octet: '85' });
    const result = getMatchConfidence(loc1, loc2);
    expect(result.confidence).toBe('no_match');
    expect(result.timeWindow).toBe(0);
  });

  it('prefers city over state', () => {
    const loc1 = makeLocation({ city: 'NYC', state: 'NY', country: 'US', octet: '72' });
    const loc2 = makeLocation({ city: 'NYC', state: 'NY', country: 'US', octet: '72' });
    expect(getMatchConfidence(loc1, loc2).confidence).toBe('city');
  });

  it('does not match cities in different countries', () => {
    const loc1 = makeLocation({ city: 'Portland', state: 'OR', country: 'US', octet: '1' });
    const loc2 = makeLocation({ city: 'Portland', state: 'OR', country: 'CA', octet: '2' });
    expect(getMatchConfidence(loc1, loc2).confidence).not.toBe('city');
  });

  it('does not match states in different countries', () => {
    const loc1 = makeLocation({ city: undefined, state: 'Ontario', country: 'US', octet: '1' });
    const loc2 = makeLocation({ city: undefined, state: 'Ontario', country: 'CA', octet: '2' });
    expect(getMatchConfidence(loc1, loc2).confidence).toBe('no_match');
  });
});

describe('detectVPN', () => {
  it('returns true for IPinfo vpn flag', () => {
    expect(detectVPN({ ip: '1.2.3.4', vpn: true })).toBe(true);
  });

  it('returns true for IPinfo hosting flag', () => {
    expect(detectVPN({ ip: '1.2.3.4', hosting: true })).toBe(true);
  });

  it('returns true for IPinfo tor flag', () => {
    expect(detectVPN({ ip: '1.2.3.4', tor: true })).toBe(true);
  });

  it('returns true for Tailscale/CGNAT range', () => {
    expect(detectVPN({ ip: '100.64.1.1' })).toBe(true);
    expect(detectVPN({ ip: '100.127.0.1' })).toBe(true);
  });

  it('returns false for non-CGNAT 100.x range', () => {
    expect(detectVPN({ ip: '100.63.0.1' })).toBe(false);
    expect(detectVPN({ ip: '100.128.0.1' })).toBe(false);
  });

  it('returns true for bogon IPs', () => {
    expect(detectVPN({ ip: '10.0.0.1', bogon: true })).toBe(true);
  });

  it('detects cloudflare in org name', () => {
    expect(detectVPN({ ip: '1.2.3.4', org: 'AS13335 Cloudflare Inc' })).toBe(true);
  });

  it('detects vpn in org name', () => {
    expect(detectVPN({ ip: '1.2.3.4', org: 'NordVPN Service' })).toBe(true);
  });

  it('detects digital ocean in org name', () => {
    expect(detectVPN({ ip: '1.2.3.4', org: 'AS14061 Digital Ocean LLC' })).toBe(true);
  });

  it('returns false for regular ISP', () => {
    expect(detectVPN({ ip: '1.2.3.4', org: 'AS7922 Comcast Cable' })).toBe(false);
  });

  it('returns false when no flags or org', () => {
    expect(detectVPN({ ip: '1.2.3.4' })).toBe(false);
  });
});

describe('processLocationData', () => {
  it('assigns city confidence when city and region present', () => {
    const data: IPLocationData = { ip: '1.2.3.4', city: 'NYC', region: 'NY', country: 'US' };
    const result = processLocationData(data);
    expect(result.confidence).toBe('city');
    expect(result.city).toBe('NYC');
    expect(result.state).toBe('NY');
    expect(result.isVPN).toBe(false);
  });

  it('assigns state confidence when only region present', () => {
    const data: IPLocationData = { ip: '1.2.3.4', region: 'NY', country: 'US' };
    const result = processLocationData(data);
    expect(result.confidence).toBe('state');
  });

  it('assigns octet confidence when no location data', () => {
    const data: IPLocationData = { ip: '1.2.3.4' };
    const result = processLocationData(data);
    expect(result.confidence).toBe('octet');
    expect(result.octet).toBe('1');
  });

  it('assigns vpn confidence when VPN detected', () => {
    const data: IPLocationData = { ip: '1.2.3.4', vpn: true, city: 'NYC', region: 'NY' };
    const result = processLocationData(data);
    expect(result.confidence).toBe('vpn');
    expect(result.isVPN).toBe(true);
  });

  it('extracts first octet from IP', () => {
    const data: IPLocationData = { ip: '203.0.113.1' };
    expect(processLocationData(data).octet).toBe('203');
  });
});
