import { processNavigateToBookingResult } from '@/lib/server/ai-scheduling/functions/navigate-to-booking';
import { enqueueContent, enqueueNavigateToCalendar } from './streaming-utils';
import { processingStateManager } from '@/lib/server/ai-scheduling/processing';
import type { AISchedulingRequest } from '@/types/ai-scheduling';
import type { Event } from '@/types';
import type { Place } from '@/types/places';

export async function handleNavigateBooking(
  toolCall: { function: { arguments: string } },
  body: AISchedulingRequest,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<void> {
  const result = processNavigateToBookingResult(toolCall.function.arguments);
  console.log('🔗 Navigation confirmed - retrieving calendar URL');

  // Retrieve the cached event to get the calendar URL
  const cacheKey = `places:${body.user1Id}:${body.user2Id}`;
  const cached = await processingStateManager.getCached<{
    eventTemplate?: Partial<Event>;
    eventResult?: { startTime: string; endTime: string; place?: Place };
    finalEvent?: Event;
  }>(cacheKey);

  if (!cached?.finalEvent) {
    console.error('❌ No cached event found for navigation');
    enqueueContent(controller, encoder, "I couldn't find the event details. Please try creating a new event.");
    return;
  }

  // Get the calendar URL from the cached final event
  const calendarUrl = cached.finalEvent.calendar_urls?.google;

  if (!calendarUrl) {
    console.error('❌ No calendar URL found in cached event');
    enqueueContent(controller, encoder, "I couldn't find the calendar link. Please try creating the event again.");
    return;
  }

  console.log('✅ Found calendar URL, navigating...');

  // Send confirmation message
  enqueueContent(controller, encoder, result.message);

  // Send navigate command to automatically open calendar
  enqueueNavigateToCalendar(controller, encoder, calendarUrl);
}
