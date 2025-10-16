import { processNavigateToBookingResult } from '@/lib/ai/functions/navigate-to-booking';
import { enqueueContent, enqueueShowCalendarButton } from './streaming-utils';
import type { AISchedulingRequest } from '@/types/ai-scheduling';

export async function handleNavigateBooking(
  toolCall: { function: { arguments: string } },
  body: AISchedulingRequest,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<void> {
  const result = processNavigateToBookingResult(toolCall.function.arguments);
  console.log('🔗 Navigation confirmed');

  // Send confirmation with calendar button
  enqueueContent(controller, encoder, result.message);

  enqueueShowCalendarButton(controller, encoder, true);
}
