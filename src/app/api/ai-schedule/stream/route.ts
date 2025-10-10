import { NextRequest, NextResponse } from 'next/server';
import { buildContextMessage } from '@/lib/ai/scheduling/system-prompts';
import { buildFinalEvent as buildFinalEventUtil } from '@/lib/events/event-utils';
import { streamSchedulingResponse } from '@/lib/ai/scheduling/streaming-handlers/orchestrator';
import { handleGenerateEvent } from '@/lib/ai/scheduling/streaming-handlers/handle-generate-event';
import { handleEditEvent } from '@/lib/ai/scheduling/streaming-handlers/handle-edit-event';
import { handleNavigateBooking } from '@/lib/ai/scheduling/streaming-handlers/handle-navigate-booking';
import { handleSuggestActivities } from '@/lib/ai/scheduling/streaming-handlers/handle-suggest-activities';
import type { OpenAIToolCall } from '@/types/ai-scheduling';
import { handleSearchEvents, handleSearchEventsEnhancement } from '@/lib/ai/scheduling/streaming-handlers/handle-search-events';
import { handleShowMoreEvents } from '@/lib/ai/scheduling/streaming-handlers/handle-show-more-events';
import type { AISchedulingRequest, Message, TimeSlot } from '@/types/ai-scheduling';
import type { Event } from '@/types/profile';
import type { Place } from '@/types/places';

export async function POST(request: NextRequest) {
  try {
    const body: AISchedulingRequest = await request.json();
    console.log('🔍 AI Scheduling Request Body:', {
      hasUserMessage: !!body.userMessage,
      conversationHistoryLength: body.conversationHistory?.length || 0,
      user1Id: body.user1Id,
      user2Id: body.user2Id,
      contactType: body.calendarType,
    });

    const {
      conversationHistory = [],
      availableTimeSlots: frontendSlots,
    } = body;

    // Use slots from frontend if provided, otherwise fetch from server
    let availableTimeSlots: TimeSlot[] = [];

    if (frontendSlots && frontendSlots.length > 0) {
      availableTimeSlots = frontendSlots;
      console.log(`✅ Using ${availableTimeSlots.length} pre-fetched time slots from frontend`);
    } else {
      // Fallback: fetch common times for both users
      try {
        console.log('🔄 Fetching common times from server...');

        // Construct the full URL for the API call
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const host = request.headers.get('host');
        const baseUrl = `${protocol}://${host}`;

        const response = await fetch(`${baseUrl}/api/scheduling/combined-common-times`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user1Id: body.user1Id,
            user2Id: body.user2Id,
            contactType: body.calendarType,
            duration: 60, // Default duration for initial fetch
          }),
        });

        if (response.ok) {
          const data = await response.json();
          availableTimeSlots = data.slots || [];
          console.log(`✅ Fetched ${availableTimeSlots.length} common time slots from server`);

          if (availableTimeSlots.length === 0) {
            console.warn('⚠️ Server returned 0 time slots');
          }
        } else {
          console.error(`❌ Failed to fetch common times: ${response.status} ${response.statusText}`);
        }
      } catch (fetchError) {
        console.error('❌ Error fetching common times from server:', fetchError);
      }

      // Log final slot count
      console.log(`📅 Using ${availableTimeSlots.length} time slots`);
    }

    // Build context message
    const contextMessage = buildContextMessage({
      user1Location: body.user1Location || '',
      user2Location: body.user2Location || '',
      calendarType: body.calendarType,
      availableTimeSlots,
    });

    // Start streaming response
    console.log('🚀 Starting streaming response...');

    // Create wrapper functions with helper dependencies injected
    const wrappedHandleGenerateEvent = (
      toolCall: OpenAIToolCall,
      body: AISchedulingRequest,
      conversationHistory: Message[],
      contextMessage: string,
      availableTimeSlots: TimeSlot[],
      controller: ReadableStreamDefaultController,
      encoder: TextEncoder,
      slotsProvided: boolean
    ) => handleGenerateEvent(
      toolCall,
      body,
      conversationHistory,
      contextMessage,
      availableTimeSlots,
      controller,
      encoder,
      getTargetName,
      buildFinalEvent,
      buildTimeSelectionPrompt,
      handleSearchEventsEnhancement,
      slotsProvided
    );

    const wrappedHandleEditEvent = (
      toolCall: OpenAIToolCall,
      body: AISchedulingRequest,
      conversationHistory: Message[],
      contextMessage: string,
      availableTimeSlots: TimeSlot[],
      controller: ReadableStreamDefaultController,
      encoder: TextEncoder,
      slotsProvided: boolean
    ) => handleEditEvent(
      toolCall,
      body,
      conversationHistory,
      contextMessage,
      availableTimeSlots,
      controller,
      encoder,
      getTargetName,
      buildFinalEvent,
      buildTimeSelectionPrompt,
      slotsProvided,
      body.timezone
    );

    const wrappedHandleSuggestActivities = (
      body: AISchedulingRequest,
      conversationHistory: Message[],
      contextMessage: string,
      controller: ReadableStreamDefaultController,
      encoder: TextEncoder
    ) => handleSuggestActivities(
      body,
      conversationHistory,
      contextMessage,
      controller,
      encoder,
      getTargetName,
      handleSearchEvents
    );

    return streamSchedulingResponse(
      body,
      conversationHistory,
      contextMessage,
      availableTimeSlots,
      wrappedHandleGenerateEvent,
      wrappedHandleEditEvent,
      handleNavigateBooking,
      wrappedHandleSuggestActivities,
      handleShowMoreEvents
    );
  } catch (_error) {
    console.error('AI Scheduling error:', _error);
    return NextResponse.json(
      { error: 'Failed to process scheduling request', details: _error instanceof Error ? _error.message : String(_error) },
      { status: 500 }
    );
  }
}


function getTargetName(user2Name: string | undefined): string {
  return user2Name || 'them';
}

/**
 * Build final event object - wrapper around utility function
 */
function buildFinalEvent(
  body: AISchedulingRequest,
  eventResult: { title: string; startTime: string; endTime: string; place?: Place },
  updatedEventTemplate: Partial<Event>,
  finalDescription: string,
  locationString: string,
  videoCallLink?: string
): Event {
  return buildFinalEventUtil(
    body.user1Id,
    body.user2Id,
    body.user2Email || '',
    eventResult.title,
    finalDescription,
    eventResult.startTime,
    eventResult.endTime,
    updatedEventTemplate.duration || 60,
    updatedEventTemplate.eventType || 'video',
    updatedEventTemplate.intent || 'custom',
    eventResult.place,
    videoCallLink,
    body.timezone
  );
}

/**
 * Build time selection prompt to help AI choose best time
 */
function buildTimeSelectionPrompt(
  availableTimeSlots: TimeSlot[],
  eventTemplate: Partial<Event>,
  userLocations: string[]
): string {
  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  let prompt = `\n\n## Available Time Slots\n\n`;

  // Group slots by day for better readability
  const slotsByDay: Record<string, TimeSlot[]> = {};

  availableTimeSlots.forEach(slot => {
    const slotDate = new Date(slot.start);
    const dayKey = slotDate.toISOString().split('T')[0]; // YYYY-MM-DD
    if (!slotsByDay[dayKey]) {
      slotsByDay[dayKey] = [];
    }
    slotsByDay[dayKey].push(slot);
  });

  // Display first 14 days with slots
  const sortedDays = Object.keys(slotsByDay).sort().slice(0, 14);

  sortedDays.forEach(dayKey => {
    const slotsForDay = slotsByDay[dayKey];
    const firstSlot = new Date(slotsForDay[0].start);
    const dayName = dayNames[firstSlot.getDay()];
    const dateStr = firstSlot.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    prompt += `\n**${dayName}, ${dateStr}:**\n`;

    slotsForDay.slice(0, 8).forEach(slot => {
      const start = new Date(slot.start);
      const end = new Date(slot.end);
      const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      prompt += `- ${startTime} - ${endTime}\n`;
    });
  });

  if (availableTimeSlots.length === 0) {
    prompt += '\n⚠️ No available time slots found. Both users may need to add calendars or expand their schedulable hours.\n';
  }

  return prompt;
}
