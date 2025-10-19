import { createCompleteCalendarEvent, createTravelBufferDescription, calculateCalendarBlockTimes } from '@/lib/events/event-utils';
import { processingStateManager } from '@/lib/services/server/aiProcessingService';
import { enqueueProgress, enqueueContent, enqueueEvent } from './streaming-utils';
import type { AISchedulingRequest, GenerateEventResult } from '@/types/ai-scheduling';
import type { Event, CalendarUrls } from '@/types';
import type { Place } from '@/types/places';

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
  console.log('✅ Finalizing event creation...');

  enqueueProgress(controller, encoder, 'Creating calendar event...');

  // Build event description and location
  const baseDescription = template.description || `${template.title || 'Event'} with ${body.user2Name || 'contact'}`;
  const location = eventResult.place
    ? `${eventResult.place.name}${eventResult.place.address ? `, ${eventResult.place.address}` : ''}`
    : '';

  // Build travel buffer description
  const description = createTravelBufferDescription(
    baseDescription,
    eventResult,
    template,
    body.timezone
  );

  // Convert ISO strings to Date objects
  const eventStartDate = new Date(eventResult.startTime);
  const eventEndDate = new Date(eventResult.endTime);

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

  // Generate calendar URLs
  const { calendar_urls } = createCompleteCalendarEvent(
    calendarEvent,
    { email: body.user2Id },
    undefined,
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
    intent: (template.intent || 'custom') as any,
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
  const message = (eventResult as any).message || `I've scheduled **${template.title}** for you and ${body.user2Name || 'your contact'}!`;
  enqueueContent(controller, encoder, message);

  // Stream the final event
  enqueueEvent(controller, encoder, finalEvent);

  // Cache template and places for future edits (30 min TTL)
  const cacheKey = `places:${body.user1Id}:${body.user2Id}`;
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
    },
    1800 // 30 minutes
  );

  console.log(`✅ Cached template and ${places?.length || 0} places for future edits`);
}
