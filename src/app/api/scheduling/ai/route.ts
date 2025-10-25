import { NextRequest, NextResponse } from 'next/server';
import { buildContextMessage } from '@/lib/ai/system-prompts';
import { streamSchedulingResponse } from '@/lib/ai/scheduling/streaming-handlers/orchestrator';
import { handleNavigateBooking } from '@/lib/ai/scheduling/streaming-handlers/handle-navigate-booking';
import { handleSuggestActivities } from '@/lib/ai/scheduling/streaming-handlers/handle-suggest-activities';
import { handleSearchEvents } from '@/lib/ai/scheduling/streaming-handlers/handle-search-events';
import { handleShowMoreEvents } from '@/lib/ai/scheduling/streaming-handlers/handle-show-more-events';
import type { AISchedulingRequest, Message } from '@/types/ai-scheduling';
import type { TimeSlot } from '@/types/profile';

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

        // Forward Authorization header from the incoming request to common-times API
        const authHeader = request.headers.get('Authorization');
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };
        if (authHeader) {
          headers['Authorization'] = authHeader;
        }

        const response = await fetch(`${baseUrl}/api/scheduling/common-times`, {
          method: 'POST',
          headers,
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

    // Create wrapper function for suggest activities with helper dependencies
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
