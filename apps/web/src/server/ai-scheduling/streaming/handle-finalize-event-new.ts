import { createCompleteCalendarEvent, calculateCalendarBlockTimes } from '@/server/calendar/events';
import { processingStateManager } from '@/server/ai-scheduling/processing';
import { AdminProfileService } from '@/server/profile/firebase-admin';
import { enqueueProgress, enqueueContent, enqueueEvent } from './streaming-utils';
import type { AISchedulingRequest, GenerateEventResult } from '@/types/ai-scheduling';
import type { Event } from '@/types';
import type { Place } from '@/types/places';
import { CACHE_TTL, getFieldValue, buildCalendarEventDescription } from '@nektus/shared-client';

/**
 * Simplified event finalization handler for new 5-stage pipeline.
 * Receives already-selected event result from Stage 5.
 *
 * Responsibilities:
 * - Validate personal calendar constraints
 * - Create calendar event
 * - Stream event to client
 * - Cache template and places
 */
export async function handleFinalizeEvent(
  eventResult: GenerateEventResult,
  template: Partial<Event>,
  body: AISchedulingRequest,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  places?: Place[]
): Promise<void> {
  console.log('🎬 handleFinalizeEvent called with places:', places?.length || 0);
  console.log('✅ Finalizing event creation...');

  enqueueProgress(controller, encoder, 'Creating calendar event...');

  // Note: Places are already enriched with Google Place IDs by the orchestrator
  // before being sent to the LLM. No need to enrich again here.
  console.log('📍 Using pre-enriched places:', {
    hasEventResultPlace: !!eventResult.place,
    placesLength: places?.length || 0,
    selectedPlaceURL: eventResult.place?.google_maps_url?.substring(0, 100) || 'N/A'
  });

  // Look up organizer profile for shortCode and name
  const organizerProfile = await AdminProfileService.getProfile(body.user1Id);
  const organizerShortCode = organizerProfile?.shortCode;
  const organizerName = organizerProfile
    ? getFieldValue(organizerProfile.contactEntries, 'name')
    : undefined;

  // Resolve attendee email: prefer passed email, fall back to profile lookup
  let attendeeEmail = body.user2Email || '';
  if (!attendeeEmail) {
    const attendeeProfile = await AdminProfileService.getProfile(body.user2Id);
    if (attendeeProfile) {
      attendeeEmail = getFieldValue(attendeeProfile.contactEntries, 'email')
        || attendeeProfile.authEmail
        || '';
    }
  }

  // Build location string
  const location = eventResult.place
    ? `${eventResult.place.name}${eventResult.place.address ? `, ${eventResult.place.address}` : ''}`
    : '';

  // Convert ISO strings to Date objects
  const eventStartDate = new Date(eventResult.startTime);
  const eventEndDate = new Date(eventResult.endTime);

  // Build standardized description using shared builder
  const description = buildCalendarEventDescription({
    eventType: (template.eventType || 'in-person') as 'video' | 'in-person',
    contactName: body.user2Name || 'contact',
    travelBuffer: template.travelBuffer,
    actualStart: eventStartDate,
    actualEnd: eventEndDate,
    placeName: eventResult.place?.name,
    organizerName: organizerName || undefined,
    shortCode: organizerShortCode,
    timezone: body.timezone,
  });

  // Calculate actual calendar block times (including buffers)
  const { calendarBlockStart, calendarBlockEnd } = calculateCalendarBlockTimes(
    eventStartDate,
    eventEndDate,
    template.travelBuffer
  );

  // Create calendar event with buffers
  const calendarEvent = {
    title: template.title || 'Event',
    description,
    location,
    startTime: calendarBlockStart,
    endTime: calendarBlockEnd,
    eventType: (template.eventType || 'in-person') as 'video' | 'in-person',
    travelBuffer: template.travelBuffer,
    preferredPlaces: eventResult.place ? [eventResult.place] : undefined,
  };

  // Generate calendar URLs with actual attendee email (not Firebase UID)
  const { calendar_urls } = createCompleteCalendarEvent(
    calendarEvent,
    { email: attendeeEmail },
    body.timezone
  );

  // Build final event object
  const finalEvent: Event = {
    id: `event-${Date.now()}`,
    organizerId: body.user1Id,
    attendeeId: body.user2Id,
    title: template.title || 'Event',
    description,
    location,
    startTime: eventStartDate,
    endTime: eventEndDate,
    duration: template.duration || 60,
    calendar_urls,
    eventType: (template.eventType || 'in-person') as 'video' | 'in-person',
    intent: (template.intent || 'custom') as Event['intent'],
    preferredPlaces: eventResult.place ? [eventResult.place] : undefined,
    travelBuffer: template.travelBuffer,
    status: 'scheduled' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  console.log('📅 Calendar event created:', {
    title: finalEvent.title,
    start: finalEvent.startTime,
    end: finalEvent.endTime,
    place: finalEvent.preferredPlaces?.[0]?.name,
  });

  // Stream the message (if LLM generated one) or use default
  const message = eventResult.message || `I've scheduled **${template.title}** for you and ${body.user2Name || 'your contact'}!`;
  enqueueContent(controller, encoder, message);

  // Stream the final event
  enqueueEvent(controller, encoder, finalEvent);

  // Cache template, places, and final event for future edits and navigation (30 min TTL)
  const cacheKey = `places:${body.user1Id}:${body.user2Id}`;
  console.log(`💾 Caching event template with key: ${cacheKey}`);
  console.log(`💾 Cache data:`, {
    placesCount: places?.length || 0,
    templateTitle: template.title,
    hasEventResult: !!eventResult,
    user1Id: body.user1Id,
    user2Id: body.user2Id
  });

  await processingStateManager.set(
    cacheKey,
    {
      places: places || [],
      eventTemplate: template,
      eventResult: {
        startTime: eventResult.startTime,
        endTime: eventResult.endTime,
        place: eventResult.place,
      },
      finalEvent, // Cache the complete event with calendar URLs for navigation
    },
    CACHE_TTL.LONG_S // 1 hour
  );

  console.log(`✅ Cached template, final event, and ${places?.length || 0} places for future edits with TTL ${CACHE_TTL.LONG_S}s`);
}
