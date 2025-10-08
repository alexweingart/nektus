/**
 * Streaming utilities for Server-Sent Events (SSE) in AI scheduling
 */

export type StreamController = ReadableStreamDefaultController;
export type StreamEncoder = TextEncoder;

/**
 * Helper to send a progress message with loading indicator
 */
export function enqueueProgress(
  controller: StreamController,
  encoder: StreamEncoder,
  text: string
): void {
  controller.enqueue(encoder.encode(
    `data: ${JSON.stringify({ type: 'progress', text, isLoading: true })}\n\n`
  ));
}

/**
 * Helper to send a content message (text response)
 */
export function enqueueContent(
  controller: StreamController,
  encoder: StreamEncoder,
  text: string
): void {
  controller.enqueue(encoder.encode(
    `data: ${JSON.stringify({ type: 'content', text })}\n\n`
  ));
}

/**
 * Helper to send an acknowledgment message
 */
export function enqueueAcknowledgment(
  controller: StreamController,
  encoder: StreamEncoder,
  text: string
): void {
  controller.enqueue(encoder.encode(
    `data: ${JSON.stringify({ type: 'acknowledgment', text })}\n\n`
  ));
}

/**
 * Helper to send an error message
 */
export function enqueueError(
  controller: StreamController,
  encoder: StreamEncoder,
  message: string
): void {
  controller.enqueue(encoder.encode(
    `data: ${JSON.stringify({ type: 'error', message })}\n\n`
  ));
}

/**
 * Helper to send an event object
 */
export function enqueueEvent(
  controller: StreamController,
  encoder: StreamEncoder,
  event: any
): void {
  controller.enqueue(encoder.encode(
    `data: ${JSON.stringify({ type: 'event', event })}\n\n`
  ));
}

/**
 * Helper to show/hide calendar button
 */
export function enqueueShowCalendarButton(
  controller: StreamController,
  encoder: StreamEncoder,
  value: boolean
): void {
  controller.enqueue(encoder.encode(
    `data: ${JSON.stringify({ type: 'show_calendar_button', value })}\n\n`
  ));
}

/**
 * Helper to clear loading state
 */
export function enqueueClearLoading(
  controller: StreamController,
  encoder: StreamEncoder
): void {
  controller.enqueue(encoder.encode(
    `data: ${JSON.stringify({ type: 'clear_loading' })}\n\n`
  ));
}

/**
 * Helper to send enhancement_pending event with processingId
 */
export function enqueueEnhancementPending(
  controller: StreamController,
  encoder: StreamEncoder,
  processingId: string
): void {
  controller.enqueue(encoder.encode(
    `data: ${JSON.stringify({ type: 'enhancement_pending', processingId })}\n\n`
  ));
}
