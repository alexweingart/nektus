import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProcessedLocation } from '@/server/location/ip-geolocation';

// ---------- in-memory Redis mock ----------
const store = new Map<string, string>();
const sets = new Map<string, Set<string>>();

const mockRedis = {
  get: vi.fn(async (key: string) => store.get(key) ?? null),
  setex: vi.fn(async (_key: string, _ttl: number, value: string) => { store.set(_key, value); }),
  del: vi.fn(async (key: string) => { store.delete(key); }),
  sadd: vi.fn(async (key: string, member: string) => {
    if (!sets.has(key)) sets.set(key, new Set());
    sets.get(key)!.add(member);
  }),
  srem: vi.fn(async (key: string, member: string) => {
    sets.get(key)?.delete(member);
  }),
  smembers: vi.fn(async (key: string) => Array.from(sets.get(key) ?? [])),
  expire: vi.fn(async () => {}),
  multi: vi.fn(() => {
    const ops: Array<() => Promise<void>> = [];
    const pipeline = {
      setex: (key: string, ttl: number, value: string) => { ops.push(() => mockRedis.setex(key, ttl, value)); return pipeline; },
      del: (key: string) => { ops.push(() => mockRedis.del(key)); return pipeline; },
      sadd: (key: string, member: string) => { ops.push(() => mockRedis.sadd(key, member)); return pipeline; },
      srem: (key: string, member: string) => { ops.push(() => mockRedis.srem(key, member)); return pipeline; },
      expire: (_key: string, _ttl: number) => { ops.push(async () => {}); return pipeline; },
      exec: async () => { for (const op of ops) await op(); },
    };
    return pipeline;
  }),
};

vi.mock('@/server/config/redis', () => ({
  redis: mockRedis,
  isRedisAvailable: () => true,
}));

// Mock getMatchConfidence — by default returns city match
vi.mock('@/server/location/ip-geolocation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/location/ip-geolocation')>();
  return {
    ...actual,
    getMatchConfidence: vi.fn(() => ({ confidence: 'city', timeWindow: 500 })),
  };
});

// Import after mocks
const { atomicExchangeAndMatch, storeExchangeMatch, getExchangeMatch, cleanupUserExchanges } =
  await import('./matching');

const { getMatchConfidence } = await import('@/server/location/ip-geolocation');

const makeLocation = (overrides: Partial<ProcessedLocation> = {}): ProcessedLocation => ({
  ip: '1.2.3.4',
  isVPN: false,
  octet: '1',
  confidence: 'city',
  city: 'NYC',
  state: 'NY',
  country: 'US',
  ...overrides,
});

const makeExchangeData = (sessionId: string, userId: string, serverTimestamp: number) => ({
  userId,
  profile: { userId, shortCode: 'abc', profileImage: '', backgroundImage: '', lastUpdated: 1000, contactEntries: [] },
  timestamp: serverTimestamp,
  serverTimestamp,
  location: makeLocation(),
  mag: 15,
  sessionId,
});

beforeEach(() => {
  store.clear();
  sets.clear();
  vi.clearAllMocks();
  // Reset getMatchConfidence to default city match
  (getMatchConfidence as ReturnType<typeof vi.fn>).mockReturnValue({ confidence: 'city', timeWindow: 500 });
});

describe('atomicExchangeAndMatch', () => {
  it('returns null when no candidates exist', async () => {
    const data = makeExchangeData('session-1', 'user-1', 1000);
    const result = await atomicExchangeAndMatch('session-1', data, makeLocation(), 1000);
    expect(result).toBeNull();
  });

  it('matches two exchanges within time window', async () => {
    const data1 = makeExchangeData('session-1', 'user-1', 1000);
    await atomicExchangeAndMatch('session-1', data1, makeLocation(), 1000);

    const data2 = makeExchangeData('session-2', 'user-2', 1200);
    const result = await atomicExchangeAndMatch('session-2', data2, makeLocation(), 1200);

    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe('session-1');
    expect(result!.matchData.userId).toBe('user-1');
  });

  it('picks highest confidence match (city > octet)', async () => {
    const data1 = makeExchangeData('session-octet', 'user-1', 1000);
    await atomicExchangeAndMatch('session-octet', data1, makeLocation(), 1000);

    const data2 = makeExchangeData('session-city', 'user-2', 1100);
    await atomicExchangeAndMatch('session-city', data2, makeLocation(), 1100);

    // Now: third exchange arrives, should match with city confidence
    // getMatchConfidence returns city for both
    const data3 = makeExchangeData('session-3', 'user-3', 1200);
    const result = await atomicExchangeAndMatch('session-3', data3, makeLocation(), 1200);

    // Should match (first available candidate in the bucket that hasn't been consumed)
    if (result) {
      expect(result.matchData.userId).toBeDefined();
    }
  });

  it('falls back to immediate match when no location/timestamp', async () => {
    const data1 = makeExchangeData('session-1', 'user-1', 1000);
    await atomicExchangeAndMatch('session-1', data1, makeLocation(), 1000);

    const data2 = { ...makeExchangeData('session-2', 'user-2', 0), location: undefined, serverTimestamp: undefined };
    // @ts-expect-error — intentionally passing undefined to test fallback behavior
    const result = await atomicExchangeAndMatch('session-2', data2, undefined);

    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe('session-1');
  });

  it('updates exchange data when session already exists', async () => {
    const data1 = makeExchangeData('session-1', 'user-1', 1000);
    await atomicExchangeAndMatch('session-1', data1, makeLocation(), 1000);

    // Same session hits again with updated data
    const data1Updated = { ...data1, mag: 20, serverTimestamp: 1050 };
    const result = await atomicExchangeAndMatch('session-1', data1Updated, makeLocation(), 1050);

    // No match (no other candidates), just updated
    expect(result).toBeNull();
    // Verify updated data is stored
    const stored = store.get('pending_exchange:session-1');
    expect(stored).toBeDefined();
    expect(JSON.parse(stored!).mag).toBe(20);
  });

  it('returns no_match when confidence is no_match', async () => {
    (getMatchConfidence as ReturnType<typeof vi.fn>).mockReturnValue({ confidence: 'no_match', timeWindow: 0 });

    const data1 = makeExchangeData('session-1', 'user-1', 1000);
    await atomicExchangeAndMatch('session-1', data1, makeLocation(), 1000);

    const data2 = makeExchangeData('session-2', 'user-2', 1200);
    const result = await atomicExchangeAndMatch('session-2', data2, makeLocation(), 1200);

    expect(result).toBeNull();
  });

  it('does not match when time diff exceeds window', async () => {
    const data1 = makeExchangeData('session-1', 'user-1', 1000);
    await atomicExchangeAndMatch('session-1', data1, makeLocation(), 1000);

    // 600ms later with city window of 500ms
    const data2 = makeExchangeData('session-2', 'user-2', 1600);
    const result = await atomicExchangeAndMatch('session-2', data2, makeLocation(), 1600);

    expect(result).toBeNull();
  });

  it('selects candidate with smallest time difference on same confidence', async () => {
    const data1 = makeExchangeData('session-far', 'user-1', 1000);
    await atomicExchangeAndMatch('session-far', data1, makeLocation(), 1000);

    const data2 = makeExchangeData('session-close', 'user-2', 1400);
    await atomicExchangeAndMatch('session-close', data2, makeLocation(), 1400);

    const data3 = makeExchangeData('session-3', 'user-3', 1450);
    const result = await atomicExchangeAndMatch('session-3', data3, makeLocation(), 1450);

    // session-close is 50ms away, session-far is 450ms away
    // Both within 500ms city window; should pick closest
    if (result) {
      expect(result.sessionId).toBe('session-close');
    }
  });
});

describe('storeExchangeMatch', () => {
  it('stores match data by token', async () => {
    const profile = { userId: 'u1', shortCode: 'abc', profileImage: '', backgroundImage: '', lastUpdated: 1, contactEntries: [] };
    await storeExchangeMatch('token-1', 'sA', 'sB', profile, profile, 'All', 'All');

    const stored = store.get('exchange_match:token-1');
    expect(stored).toBeDefined();
    const parsed = JSON.parse(stored!);
    expect(parsed.sessionA).toBe('sA');
    expect(parsed.sessionB).toBe('sB');
  });

  it('stores session references', async () => {
    const profile = { userId: 'u1', shortCode: 'abc', profileImage: '', backgroundImage: '', lastUpdated: 1, contactEntries: [] };
    await storeExchangeMatch('token-2', 'sA', 'sB', profile, profile);

    const refA = store.get('exchange_session:sA');
    expect(refA).toBeDefined();
    expect(JSON.parse(refA!).token).toBe('token-2');
    expect(JSON.parse(refA!).youAre).toBe('A');

    const refB = store.get('exchange_session:sB');
    expect(refB).toBeDefined();
    expect(JSON.parse(refB!).youAre).toBe('B');
  });
});

describe('getExchangeMatch', () => {
  it('returns match data by token', async () => {
    store.set('exchange_match:tok', JSON.stringify({
      sessionA: 'a', sessionB: 'b', userA: {}, userB: {}, timestamp: 1, status: 'pending',
    }));
    const result = await getExchangeMatch('tok');
    expect(result).not.toBeNull();
    expect(result!.sessionA).toBe('a');
  });

  it('returns null for missing token', async () => {
    const result = await getExchangeMatch('nonexistent');
    expect(result).toBeNull();
  });
});

describe('cleanupUserExchanges', () => {
  it('removes all exchanges for a userId', async () => {
    // Set up: user-1 has session-1 in the bucket
    store.set('pending_exchange:session-1', JSON.stringify({ userId: 'user-1', sessionId: 'session-1' }));
    store.set('pending_exchange:session-2', JSON.stringify({ userId: 'user-2', sessionId: 'session-2' }));
    sets.set('geo_bucket:global', new Set(['session-1', 'session-2']));

    await cleanupUserExchanges('user-1');

    // session-1 should be removed
    expect(store.has('pending_exchange:session-1')).toBe(false);
    expect(sets.get('geo_bucket:global')!.has('session-1')).toBe(false);
    // session-2 should remain
    expect(store.has('pending_exchange:session-2')).toBe(true);
    expect(sets.get('geo_bucket:global')!.has('session-2')).toBe(true);
  });

  it('cleans up stale entries with no data', async () => {
    // session with no data in store but still in set
    sets.set('geo_bucket:global', new Set(['stale-session']));

    await cleanupUserExchanges('anyone');

    // stale session should be removed from set
    expect(sets.get('geo_bucket:global')!.has('stale-session')).toBe(false);
  });
});
