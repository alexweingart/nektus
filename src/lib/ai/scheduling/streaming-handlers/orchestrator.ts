import { createCompletion, AI_MODELS } from '@/lib/ai/scheduling/openai-client';
import { SCHEDULING_SYSTEM_PROMPT } from '@/lib/ai/system-prompts';
import { generateEventTemplateFunction } from '@/lib/ai/functions/generate-event-template';
import { navigateToBookingLinkFunction } from '@/lib/ai/functions/navigate-to-booking';
import { editEventFunction } from '@/lib/ai/functions/edit-event';
import { enqueueAcknowledgment, enqueueProgress, enqueueError } from './streaming-utils';
import type { AISchedulingRequest, Message, OpenAIToolCall } from '@/types/ai-scheduling';
import type { TimeSlot } from '@/types';

export async function streamSchedulingResponse(
  body: AISchedulingRequest,
  conversationHistory: Message[],
  contextMessage: string,
  availableTimeSlots: TimeSlot[],
  handleGenerateEvent: (toolCall: OpenAIToolCall, body: AISchedulingRequest, conversationHistory: Message[], contextMessage: string, availableTimeSlots: TimeSlot[], controller: ReadableStreamDefaultController, encoder: TextEncoder, slotsProvided: boolean) => Promise<void>,
  handleEditEvent: (toolCall: OpenAIToolCall, body: AISchedulingRequest, conversationHistory: Message[], contextMessage: string, availableTimeSlots: TimeSlot[], controller: ReadableStreamDefaultController, encoder: TextEncoder, slotsProvided: boolean) => Promise<void>,
  handleNavigateBooking: (toolCall: OpenAIToolCall, body: AISchedulingRequest, controller: ReadableStreamDefaultController, encoder: TextEncoder) => Promise<void>,
  handleSuggestActivities: (body: AISchedulingRequest, conversationHistory: Message[], contextMessage: string, controller: ReadableStreamDefaultController, encoder: TextEncoder) => Promise<void>,
  handleShowMoreEvents: (controller: ReadableStreamDefaultController, encoder: TextEncoder) => Promise<void>
): Promise<Response> {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        // IMMEDIATE: Generate natural language acknowledgment + determine action
        console.log('⚡ Generating natural acknowledgment and determining action...');

        const targetName = body.user2Name || 'them';

        // NANO determines intent AND generates response in one call
        const acknowledgmentCompletion = await createCompletion({
          model: AI_MODELS.GPT5_NANO,
          reasoning_effort: 'minimal',
          verbosity: 'low',
          messages: [
            { role: 'system', content: `You help people schedule time with ${targetName}. Output JSON with "message" and "intent".

Intent classification rules (DECIDE INTENT FIRST):
1. "show_more_events" = User wants to see MORE events from a previous search (CHECK THIS FIRST!)
   - Explicit requests: "show me more", "what else is there?", "show more events", "more options", "show the rest"
   - Questions: "what else?", "anything else?", "what else is happening?", "more?"
   - With numbers: "show me the other 7 events", "can you show the other 5", "show remaining events"
   - CRITICAL: If the previous message said "I found X more events - would you like to see them?", ANY affirmative response = show_more_events
   - Affirmative responses after being asked about more events: "yes", "yes please", "sure", "yeah", "yea", "ok", "show them", "send them"
   - Look for keywords: "other", "more", "rest", "remaining" combined with "events"

2. "handle_event" = User explicitly requests scheduling with SPECIFIC activity/time OR confirms/edits previous suggestion
   - Direct requests: "schedule dinner", "book tennis", "find time for coffee"
   - Action phrases: "can you schedule [activity]", "let's [activity]", "I want to [activity]"
   - **Looking/wanting to do specific activity: "looking to play pickleball", "want to play tennis", "hoping to grab coffee"**
   - Confirmation for event scheduling: "yes", "sure", "sounds good", "perfect", "that works", "ok" (UNLESS asking about more events)
   - Edit requests: Mentions specific day/time ("friday instead", "saturday", "different time", "another place")
   - **Alternative time requests: "are there any earlier times?", "do we have later options?", "any other times?"**
   - **Alternative day requests: "what about other days?", "can we do a different day?", "other day options?"**

3. "suggest_activities" = User wants to schedule but is ASKING FOR IDEAS about WHAT ACTIVITY to do (vague about the activity itself)
   - Questions: "what should we do?", "any ideas?", "what can we do together?"
   - Timeframe questions: "what should we do this weekend?", "ideas for tomorrow?" (WITHOUT specific activity)
   - Activity exploration: "what's fun to do?", "suggestions for activities?"
   - **NOT for time/day alternatives when event already exists**
   - **NOT when user already mentions a specific activity like "pickleball", "tennis", "dinner", etc.**

4. "confirm_scheduling" = Unrelated statement or tangential topic
   - Unrelated topics: "what printer is best?", "how's the weather?"
   - Vague statements: "I'm tired", "I like tennis" (without asking to schedule)
   - NOT asking about scheduling or activities

CRITICAL: Questions about ALTERNATIVE TIMES/DAYS for an existing event = handle_event. Questions about WHAT ACTIVITY to do = suggest_activities. "Show me more events" = show_more_events.

Message writing rules:
- For "show_more_events": Confirm and indicate loading more events (e.g., "Sure — let me show you more options!")
- For "handle_event": Enthusiastic confirmation, NEVER asks a question (e.g., "Sure — let me find time!" or "Got it — updating that now!")
- For "suggest_activities": Acknowledge and indicate you'll provide ideas (e.g., "Great question — let me find some ideas for you!")
- For "confirm_scheduling": Reference their statement, then redirect to scheduling with a question
- Keep to 1-2 sentences, warm and natural

Examples:

Input: "show me more"
{"intent": "show_more_events", "message": "Sure — let me show you more options!"}

Input: "what else is happening?"
{"intent": "show_more_events", "message": "Here are more events!"}

Input: "yes can you show the other 7 events?"
{"intent": "show_more_events", "message": "Sure — let me show you the other 7 options!"}

Input: "show me the rest"
{"intent": "show_more_events", "message": "Here are the remaining events!"}

Context example - Assistant previously said: "I found 6 more events - would you like to see them?"
Input: "yea can you send them?"
{"intent": "show_more_events", "message": "Sure — here are the other events!"}

Context example - Assistant previously said: "I found 6 more events - would you like to see them?"
Input: "yes"
{"intent": "show_more_events", "message": "Here you go!"}

Context example - Assistant previously said: "I found 7 more events - would you like to see them?"
Input: "yes please"
{"intent": "show_more_events", "message": "Sure — here are the rest!"}

Input: "can you schedule dinner for me"
{"intent": "handle_event", "message": "Sure — let me find dinner time for you and ${targetName}!"}

Input: "let's play tennis"
{"intent": "handle_event", "message": "Sure — let me find time for you and ${targetName} to play tennis!"}

Input: "looking to play pickleball! what time is best?"
{"intent": "handle_event", "message": "I'll find the best time for you and ${targetName} to play pickleball!"}

Input: "actually, can we do on friday?"
{"intent": "handle_event", "message": "Got it — updating to Friday!"}

Input: "are there any earlier times?"
{"intent": "handle_event", "message": "Sure — let me check for earlier times!"}

Input: "what about other days?"
{"intent": "handle_event", "message": "Absolutely — I'll find other day options for you!"}

Input: "what should we do this weekend?"
{"intent": "suggest_activities", "message": "Great question — let me find some ideas for you and ${targetName} this weekend!"}

Input: "any ideas for activities tomorrow?"
{"intent": "suggest_activities", "message": "I'll find some great options for you and ${targetName} tomorrow!"}

Input: "what can we do together?"
{"intent": "suggest_activities", "message": "Let me suggest some activities for you and ${targetName}!"}

Input: "I like pop music"
{"intent": "confirm_scheduling", "message": "That's cool that you like pop music! Want me to schedule time with ${targetName} to enjoy it together?"}

Input: "what printer is best?"
{"intent": "confirm_scheduling", "message": "I'm not great with printer recommendations, but I can help you schedule time with ${targetName} if you'd like!"}

Input: "I'm tired"
{"intent": "confirm_scheduling", "message": "Sounds like you need a break! Want me to schedule some downtime with ${targetName}?"}

IMPORTANT: You will receive conversation history to understand context.

CRITICAL CONTEXT CHECK:
- Look at the LAST assistant message (the one immediately before the user's current message)
- If the LAST assistant message contains phrases like:
  * "I found X more events - would you like to see them?"
  * "Would you like to see them?"
  * "would you like to see more?"
  AND the user responds with ANY affirmative ("yes", "yes!", "sure", "ok", "yeah", "send them", etc.)
  THEN classify as show_more_events (NOT handle_event!)

This takes priority over other classifications.` },
            ...conversationHistory,
            { role: 'user', content: body.userMessage },
          ],
          response_format: { type: 'json_object' },
        });

        // Parse NANO's response (message + intent)
        const nanoResponse = JSON.parse(acknowledgmentCompletion.choices[0].message.content || '{"message": "Let me help you!", "intent": "confirm_scheduling"}');
        const acknowledgment = nanoResponse.message;
        const nanoIntent = nanoResponse.intent;

        console.log('📝 NANO response:', { acknowledgment, intent: nanoIntent });

        // Send acknowledgment
        enqueueAcknowledgment(controller, encoder, acknowledgment);

        // If NANO determined this is show_more_events, show more cached events
        if (nanoIntent === 'show_more_events') {
          console.log('✅ NANO classified as show_more_events - showing more events');
          await handleShowMoreEvents(controller, encoder);
          controller.close();
          return;
        }

        // If NANO determined this is suggest_activities, generate suggestions with MINI
        if (nanoIntent === 'suggest_activities') {
          console.log('✅ NANO classified as suggest_activities - generating suggestions');
          await handleSuggestActivities(body, conversationHistory, contextMessage, controller, encoder);
          controller.close();
          return;
        }

        // If NANO determined this is confirm_scheduling (unrelated), just close - NANO already responded
        if (nanoIntent === 'confirm_scheduling') {
          console.log('✅ NANO classified as confirm_scheduling - already responded with redirect');
          controller.close();
          return;
        }

        // For handle_event intent, show loading based on whether slots are available
        console.log('🎯 NANO classified as handle_event - proceeding with event handling');
        const slotsProvided = availableTimeSlots.length > 0;
        if (!slotsProvided) {
          enqueueProgress(controller, encoder, 'Getting schedules...');
        } else {
          enqueueProgress(controller, encoder, 'Thinking...');
        }

        // Now call MINI to generate event template
        // If no conversation history, force generateEventTemplate (new event)
        // Otherwise, let LLM choose between edit/navigate/new event
        const isNewEvent = conversationHistory.length === 0;

        const extraction = await createCompletion({
          model: AI_MODELS.GPT5_MINI,
          reasoning_effort: 'low',
          verbosity: 'low',
          messages: [
            { role: 'system', content: SCHEDULING_SYSTEM_PROMPT },
            { role: 'system', content: contextMessage },
            ...conversationHistory,
            { role: 'user', content: body.userMessage },
          ],
          tools: [
            { type: 'function', function: generateEventTemplateFunction },
            { type: 'function', function: navigateToBookingLinkFunction },
            { type: 'function', function: editEventFunction },
          ],
          tool_choice: isNewEvent
            ? { type: 'function', function: { name: 'generateEventTemplate' } }
            : 'auto', // Force generateEventTemplate for new events, let LLM choose for edits
        });
        const toolCall = extraction.choices[0].message.tool_calls?.[0];
        if (!toolCall || toolCall.type !== 'function') {
          console.error('❌ No tool call found. Full response:', JSON.stringify(extraction.choices[0].message));
          throw new Error('No function called by LLM');
        }

        console.log(`✅ LLM called function: ${toolCall.function.name}`);

        // Route based on which specific function was called
        switch (toolCall.function.name) {
          case 'generateEventTemplate':
            await handleGenerateEvent(toolCall, body, conversationHistory, contextMessage, availableTimeSlots, controller, encoder, slotsProvided);
            break;

          case 'navigateToBookingLink':
            // Only allow navigateToBookingLink if there's a previous event in conversation
            if (conversationHistory.length === 0) {
              console.warn('⚠️ navigateToBookingLink called with no conversation history - treating as generateEventTemplate');
              // Treat as a new event request instead
              await handleGenerateEvent(toolCall, body, conversationHistory, contextMessage, availableTimeSlots, controller, encoder, slotsProvided);
            } else {
              await handleNavigateBooking(toolCall, body, controller, encoder);
            }
            break;

          case 'editEvent':
            // Only allow editEvent if there's conversation history (not a fresh page load)
            if (conversationHistory.length === 0) {
              console.warn('⚠️ editEvent called with no conversation history - treating as generateEventTemplate');
              // Treat as a new event request instead
              await handleGenerateEvent(toolCall, body, conversationHistory, contextMessage, availableTimeSlots, controller, encoder, slotsProvided);
            } else {
              await handleEditEvent(toolCall, body, conversationHistory, contextMessage, availableTimeSlots, controller, encoder, slotsProvided);
            }
            break;

          default:
            throw new Error(`Unknown function called: ${toolCall.function.name}`);
        }

        controller.close();

      } catch (_error) {
        console.error('Streaming error:', _error);
        try {
          enqueueError(controller, encoder, 'Failed to process request');
        } catch (_encodeError) {
          console.error('Failed to send error message (controller already closed):', _encodeError);
        }
        try {
          controller.close();
        } catch (_closeError) {
          console.error('Failed to close controller:', _closeError);
        }
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
