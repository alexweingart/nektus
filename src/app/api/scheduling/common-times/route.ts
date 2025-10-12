import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase/adminConfig';
import { adminUpdateMicrosoftTokens, adminGetMultipleUserData, adminGetUserTimezoneById } from '@/lib/firebase/firebase-admin-db';
import { getGoogleBusyTimes, refreshGoogleToken } from '@/lib/calendar-providers/google';
import { getMicrosoftBusyTimes, refreshMicrosoftToken } from '@/lib/calendar-providers/microsoft';
import { getAppleBusyTimes } from '@/lib/calendar-providers/apple';
import { findSlotIntersection, generateFreeSlots, mergeBusyTimes, getAvailabilityTimeRange } from '@/lib/events/slot-generator';
import { TimeSlot, Calendar } from '@/types';
import { getDefaultSchedulableHours } from '@/lib/firebase/firebase-db';
import { CalendarTokens } from '@/types';
import { Redis } from '@upstash/redis';

// Initialize Redis for caching common times
let redis: Redis | null = null;
const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

if (redisUrl && redisToken) {
  redis = new Redis({ url: redisUrl, token: redisToken });
  console.log('✅ Redis initialized for common times caching');
}

// Helper to extract token from Authorization header
function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.replace('Bearer ', '');
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const { auth } = await getFirebaseAdmin();
    const authHeader = request.headers.get('Authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify the token
    const decodedToken = await auth.verifyIdToken(token);
    console.log(`🔐 Authenticated request from user: ${decodedToken.email}`);

    const {
      user1Id,
      user2Id,
      duration = 60,
      travelBuffer,
      calendarType = 'personal' // Default to personal if not specified
    } = await request.json();

    // Validate inputs first
    if (!user1Id || !user2Id) {
      return NextResponse.json(
        { error: 'Missing required parameters: user1Id, user2Id' },
        { status: 400 }
      );
    }

    // Get requesting user's timezone for proper "next day" calculation
    // Use user1Id since that's the authenticated user viewing the page
    console.log(`🔍 Fetching timezone for user: ${user1Id}`);
    const requestingUserTimezone = await adminGetUserTimezoneById(user1Id);
    console.log(`🌍 Using timezone: ${requestingUserTimezone || 'UTC (fallback)'} for user ${user1Id}`);

    console.log('🔍 Finding common times:', {
      user1Id,
      user2Id,
      duration,
      travelBuffer
    });

    // Generate cache key with version (bump version to invalidate cache after bug fixes)
    const CACHE_VERSION = 'v23'; // Bumped to v22 - reverted incorrect findSlotIntersection changes, relying on getAllValidSlots
    const cacheKey = `common-times:${CACHE_VERSION}:${user1Id}:${user2Id}:${calendarType}:${duration}`;

    // Try to get from cache first
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log(`✅ Cache hit for common times: ${cacheKey}`);

          // Check if cached result is empty - if so, delete it and recalculate
          const cachedData = typeof cached === 'string' ? JSON.parse(cached) : cached;
          if (cachedData && Array.isArray(cachedData.slots) && cachedData.slots.length === 0) {
            console.warn(`⚠️ Cache contains empty result, deleting and recalculating...`);
            await redis.del(cacheKey);
          } else {
            return NextResponse.json(cached);
          }
        }
        console.log(`⚠️ Cache miss for common times: ${cacheKey}`);
      } catch (cacheError) {
        console.error('Cache read error:', cacheError);
        // Continue with fresh calculation if cache fails
      }
    }

    // Get user data for both users in one batched call
    const usersData = await adminGetMultipleUserData([user1Id, user2Id]);

    // Get free slots for both users in parallel using pre-fetched data
    const [user1Slots, user2Slots] = await Promise.all([
      getUserFreeSlotsWithData(user1Id, usersData[user1Id] || null, calendarType, requestingUserTimezone),
      getUserFreeSlotsWithData(user2Id, usersData[user2Id] || null, calendarType, requestingUserTimezone)
    ]);

    // Find slots that both users have available
    const commonSlots = findSlotIntersection(user1Slots, user2Slots, duration, travelBuffer);

    console.log(`✅ Calculated ${commonSlots.length} common time slots`);
    if (commonSlots.length > 0) {
      const firstSlot = new Date(commonSlots[0].start);
      const lastSlot = new Date(commonSlots[commonSlots.length - 1].start);
      console.log(`   📅 First slot: ${firstSlot.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: requestingUserTimezone || 'UTC' })}`);
      console.log(`   📅 Last slot: ${lastSlot.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: requestingUserTimezone || 'UTC' })}`);
    }

    const response = {
      slots: commonSlots,
      timezone: requestingUserTimezone || 'UTC',
    };

    // Cache the result with 10 minute TTL (only if we have slots)
    if (redis && commonSlots.length > 0) {
      try {
        await redis.set(cacheKey, JSON.stringify(response), { ex: 600 }); // 600 seconds = 10 minutes
        console.log(`💾 Cached common times: ${cacheKey} (TTL: 10min)`);
      } catch (cacheError) {
        console.error('Cache write error:', cacheError);
        // Continue even if caching fails
      }
    } else if (commonSlots.length === 0) {
      console.log(`⚠️ Not caching empty result for ${cacheKey}`);
      // Also delete any existing cache entry with empty slots
      if (redis) {
        try {
          await redis.del(cacheKey);
          console.log(`🗑️ Deleted stale cache entry: ${cacheKey}`);
        } catch (delError) {
          console.error('Cache delete error:', delError);
        }
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error finding common times:', error);
    return NextResponse.json(
      { error: 'Failed to find common times', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

async function getUserFreeSlotsWithData(
  userId: string,
  userData: { email: string; tokens: CalendarTokens[]; providers: Calendar[] } | null,
  calendarType: 'personal' | 'work' = 'personal',
  userTimezone?: string | null
): Promise<TimeSlot[]> {
  try {
    console.log(`🕒 Getting availability for user: ${userId}`);

    if (!userData) {
      console.log(`❌ User with ID ${userId} not found in batched data`);
      // Generate 24/7 availability as fallback
      const { startTime, endTime } = getAvailabilityTimeRange(userTimezone || undefined);
      return generate24x7Slots(startTime, endTime, userTimezone || undefined);
    }

    const { email: userEmail, tokens: allTokens, providers: userCalendarProviders } = userData;

    // Get time range using user timezone for proper "next day" calculation
    const { startTime, endTime } = getAvailabilityTimeRange(userTimezone || undefined);


    if (allTokens.length === 0) {
      console.log('⚠️ No calendar connections found, assuming 24/7 availability');
      return generate24x7Slots(startTime, endTime, userTimezone || undefined);
    }

    // Get user's schedulable hours based on calendar state and selected type
    // Apply scheduleable times ONLY from calendars matching the selected type
    // But still get busy times from ALL calendars
    let schedulableHours = getDefaultSchedulableHours(calendarType);

    if (userCalendarProviders.length > 0) {
      // Check if there's a universal calendar
      const universalCalendar = userCalendarProviders.find(c => c.section === 'universal');
      const personalCalendar = userCalendarProviders.find(c => c.section === 'personal');
      const workCalendar = userCalendarProviders.find(c => c.section === 'work');

      // If universal calendar exists, use its hours for the selected type
      if (universalCalendar) {
        schedulableHours = universalCalendar.schedulableHours;
      } else {
        // Otherwise, use schedulable hours ONLY from the calendar matching the selected type
        if (calendarType === 'personal' && personalCalendar) {
          schedulableHours = personalCalendar.schedulableHours;
        } else if (calendarType === 'work' && workCalendar) {
          schedulableHours = workCalendar.schedulableHours;
        } else {
          // Fallback to default if no matching calendar found
          console.log(`⚠️ No ${calendarType} calendar found for user ${userId}, using default schedulable hours`);
        }
      }

      console.log(`📅 Using schedulable hours for ${calendarType} calendar (universal: ${!!universalCalendar}, has ${calendarType}: ${calendarType === 'personal' ? !!personalCalendar : !!workCalendar})`);
      console.log(`📅 Schedulable hours for user ${userId}:`, JSON.stringify(schedulableHours));
    }


    // Fetch busy times from all calendar providers (OAuth and ICS) in parallel
    const busyTimePromises: Promise<TimeSlot[]>[] = [];

    // Handle OAuth calendars
    allTokens.forEach((tokens) => {
      busyTimePromises.push(
        (async () => {
          try {
            const validTokens = tokens;

            switch (validTokens.provider) {
              case 'google':
                const googleToken = await validateAndRefreshGoogleToken(validTokens, userId);
                if (!googleToken) {
                  console.warn('Google token validation/refresh failed, skipping');
                  return [];
                }

                // Get all owned calendars for this user (automatic - no UI selection needed)
                const { getGoogleCalendarList } = await import('@/lib/calendar-providers/google');
                const availableCalendars = await getGoogleCalendarList(googleToken);
                const calendarIds = availableCalendars.length > 0
                  ? availableCalendars.map(cal => cal.id)
                  : ['primary']; // Fallback to primary if no calendars found

                console.log(`🗓️ Fetching Google busy times from ${calendarIds.length} owned calendars: ${calendarIds.join(', ')}`);

                return await getGoogleBusyTimes(googleToken, startTime, endTime, calendarIds);

              case 'microsoft':
                const microsoftToken = await validateAndRefreshMicrosoftToken(validTokens, userEmail);
                if (!microsoftToken) {
                  console.warn('Microsoft token validation/refresh failed, skipping');
                  return [];
                }
                return await getMicrosoftBusyTimes(microsoftToken, validTokens.email, startTime, endTime);

              case 'apple':
                if (validTokens.appleId && validTokens.appSpecificPassword) {
                  return await getAppleBusyTimes(validTokens.appleId, validTokens.appSpecificPassword, startTime, endTime);
                }
                console.warn('Apple credentials missing');
                return [];

              default:
                console.warn(`Unknown provider: ${validTokens.provider}`);
                return [];
            }
          } catch (error) {
            console.error(`Error fetching busy times for ${tokens.provider}:`, error);
            return [];
          }
        })()
      );
    });

    // Handle ICS calendars
    userCalendarProviders
      .filter(provider => provider.accessMethod === 'ics' && provider.icsUrl)
      .forEach((provider) => {
        busyTimePromises.push(
          (async () => {
            try {
              console.log(`📡 Fetching ICS busy times for ${provider.provider} calendar`);

              const icsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/scheduling/fetch-ics`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  icsUrl: provider.icsUrl,
                  startDate: startTime,
                  endDate: endTime,
                }),
              });

              if (!icsResponse.ok) {
                console.error(`ICS fetch failed for ${provider.provider}: ${icsResponse.status}`);
                return [];
              }

              const icsData = await icsResponse.json();

              if (icsData.success && icsData.busyTimes) {
                console.log(`✅ Fetched ${icsData.busyTimes.length} busy times from ICS feed`);
                return icsData.busyTimes.map((bt: { start: Date; end: Date }) => ({
                  start: bt.start,
                  end: bt.end
                }));
              } else {
                console.warn(`ICS fetch returned no data for ${provider.provider}`);
                return [];
              }
            } catch (error) {
              console.error(`Error fetching ICS busy times for ${provider.provider}:`, error);
              return [];
            }
          })()
        );
      });

    // Wait for all providers to return busy times
    const allBusyTimeArrays = await Promise.all(busyTimePromises);

    // Merge busy times from all providers
    const allBusyTimes = mergeBusyTimes(allBusyTimeArrays);

    // Generate free 30-minute slots with user timezone for proper "next day" calculation
    const freeSlots = generateFreeSlots(
      allBusyTimes,
      schedulableHours,
      new Date(startTime),
      new Date(endTime),
      userTimezone || undefined
    );

    console.log(`✅ Generated ${freeSlots.length} free slots for user: ${userId}`);
    return freeSlots;

  } catch (error) {
    console.error(`Error fetching slots for user ${userId}:`, error);
    return [];
  }
}


// Generate 24/7 availability slots dynamically using user timezone
function generate24x7Slots(startTime: string, endTime: string, userTimezone?: string): TimeSlot[] {
  const slots: TimeSlot[] = [];

  // Parse the provided time range (already timezone-aware from getAvailabilityTimeRange)
  const start = new Date(startTime);
  const end = new Date(endTime);

  // Round start time to next 30-minute boundary
  const minutes = start.getMinutes();
  const roundedMinutes = Math.ceil(minutes / 30) * 30;
  start.setMinutes(roundedMinutes, 0, 0);

  if (start.getMinutes() === 60) {
    start.setHours(start.getHours() + 1, 0, 0, 0);
  }

  const current = new Date(start);

  // Generate 30-minute slots 24/7 for the entire time range
  while (current < end) {
    const slotStart = new Date(current);
    const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

    slots.push({
      start: slotStart.toISOString(),
      end: slotEnd.toISOString(),
    });

    // Move to next 30-minute slot
    current.setTime(current.getTime() + 30 * 60 * 1000);
  }

  console.log(`Generated ${slots.length} 24/7 availability slots using timezone: ${userTimezone || 'UTC'} (range: ${startTime} to ${endTime})`);
  return slots;
}

// Validate Microsoft token expiration and refresh if needed
async function validateAndRefreshMicrosoftToken(tokens: CalendarTokens, userEmail: string): Promise<string | null> {
  try {
    const accessToken = tokens.accessToken;
    const expiresAt = tokens.expiresAt;

    if (!accessToken || typeof accessToken !== 'string') {
      console.warn('Microsoft access token is missing, attempting refresh...');

      if (!tokens.refreshToken) {
        console.error('No refresh token available for Microsoft token refresh');
        return null;
      }

      // Attempt to refresh token
      const refreshedData = await refreshMicrosoftToken(tokens.refreshToken);

      // Update tokens in database
      await adminUpdateMicrosoftTokens(userEmail, refreshedData.accessToken, refreshedData.expiresAt);

      return refreshedData.accessToken;
    }

    // Check if token is expired (with 5-minute buffer)
    if (expiresAt) {
      const now = new Date();
      const expiry = new Date(expiresAt);
      const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds

      if (now.getTime() >= (expiry.getTime() - bufferTime)) {
        console.warn('Microsoft access token is expired or expiring soon, refreshing...');

        if (!tokens.refreshToken) {
          console.error('No refresh token available for Microsoft token refresh');
          return null;
        }

        // Attempt to refresh token
        const refreshedData = await refreshMicrosoftToken(tokens.refreshToken);

        // Update tokens in database
        await adminUpdateMicrosoftTokens(userEmail, refreshedData.accessToken, refreshedData.expiresAt);

        return refreshedData.accessToken;
      }
    }

    // Token appears to be valid
    return accessToken;
  } catch (error) {
    console.error('Error validating/refreshing Microsoft token:', error);
    return null;
  }
}

// Validate Google token expiration and refresh if needed
async function validateAndRefreshGoogleToken(tokens: CalendarTokens, userId: string): Promise<string | null> {
  try {
    const accessToken = tokens.accessToken;
    const expiresAt = tokens.expiresAt;

    if (!accessToken || typeof accessToken !== 'string') {
      console.warn('Google access token is missing, attempting refresh...');

      if (!tokens.refreshToken) {
        console.error('No refresh token available for Google token refresh');
        return null;
      }

      // Attempt to refresh token
      const refreshedData = await refreshGoogleToken(tokens.refreshToken);

      // Update tokens in database
      const { adminUpdateCalendarTokens } = await import('@/lib/firebase/firebase-admin-db');
      await adminUpdateCalendarTokens(userId, 'google', refreshedData.accessToken, refreshedData.expiresAt);

      return refreshedData.accessToken;
    }

    // Check if token is expired (with 5-minute buffer)
    if (expiresAt) {
      const now = new Date();
      const expiry = new Date(expiresAt);
      const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds

      if (now.getTime() >= (expiry.getTime() - bufferTime)) {
        console.warn('Google access token is expired or expiring soon, refreshing...');

        if (!tokens.refreshToken) {
          console.error('No refresh token available for Google token refresh');
          return null;
        }

        // Attempt to refresh token
        const refreshedData = await refreshGoogleToken(tokens.refreshToken);

        // Update tokens in database
        const { adminUpdateCalendarTokens } = await import('@/lib/firebase/firebase-admin-db');
        await adminUpdateCalendarTokens(userId, 'google', refreshedData.accessToken, refreshedData.expiresAt);

        return refreshedData.accessToken;
      }
    }

    // Token appears to be valid
    return accessToken;
  } catch (error) {
    console.error('Error validating/refreshing Google token:', error);
    return null;
  }
}

