/**
 * Multi-Channel Agent — Outbound Message Formatter
 *
 * Converts OutboundMessage parts into channel-appropriate formats.
 * Each channel adapter calls these helpers to render responses.
 */

import type {
  OutboundMessage,
  OutboundMessagePart,
  OutboundTextPart,
  OutboundEventCardPart,
  ChannelCapabilities,
} from './types';

// ---------------------------------------------------------------------------
// Plain text rendering (SMS, basic channels)
// ---------------------------------------------------------------------------

/**
 * Strip markdown to plain text for channels that don't support rich formatting.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')   // bold
    .replace(/\*(.*?)\*/g, '$1')        // italic
    .replace(/~~(.*?)~~/g, '$1')        // strikethrough
    .replace(/`(.*?)`/g, '$1')          // inline code
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // links → just the text
    .replace(/^#{1,6}\s+/gm, '')        // headings
    .replace(/^[-*+]\s+/gm, '• ')      // list items → bullet
    .trim();
}

/**
 * Render all outbound parts as a single plain-text string.
 * Used by SMS and other text-only channels.
 */
export function renderPlainText(message: OutboundMessage): string {
  const lines: string[] = [];

  for (const part of message.parts) {
    switch (part.type) {
      case 'text':
        lines.push(stripMarkdown(part.text));
        break;

      case 'event_card':
        lines.push(formatEventCardPlainText(part));
        break;

      case 'progress':
        // Skip progress updates for async channels — they get the final result
        break;

      case 'action':
        // Actions are channel-specific, skip in plain text
        break;

      case 'error':
        lines.push(`Error: ${part.message}`);
        break;
    }
  }

  return lines.filter(Boolean).join('\n\n');
}

/**
 * Format an event card as plain text.
 */
function formatEventCardPlainText(part: OutboundEventCardPart): string {
  const event = part.event;
  const lines: string[] = [];

  if (event.title) lines.push(String(event.title));

  if (event.startTime) {
    const start = new Date(String(event.startTime));
    const dateStr = start.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    const timeStr = start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    const durationStr = event.duration ? ` (${event.duration} min)` : '';
    lines.push(`${dateStr} at ${timeStr}${durationStr}`);
  }

  if (event.location) {
    lines.push(`Location: ${String(event.location)}`);
  }

  // Add calendar link (prefer Google for text channels)
  if (part.calendarUrls?.google) {
    lines.push(`Add to calendar: ${part.calendarUrls.google}`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Markdown rendering (WhatsApp, Telegram, web)
// ---------------------------------------------------------------------------

/**
 * Render all outbound parts as markdown.
 * Used by channels that support rich text (WhatsApp, Telegram, web).
 */
export function renderMarkdown(message: OutboundMessage): string {
  const lines: string[] = [];

  for (const part of message.parts) {
    switch (part.type) {
      case 'text':
        lines.push(part.text);
        break;

      case 'event_card':
        lines.push(formatEventCardMarkdown(part));
        break;

      case 'progress':
        // Skip for async delivery
        break;

      case 'action':
        break;

      case 'error':
        lines.push(`**Error:** ${part.message}`);
        break;
    }
  }

  return lines.filter(Boolean).join('\n\n');
}

/**
 * Format an event card as markdown.
 */
function formatEventCardMarkdown(part: OutboundEventCardPart): string {
  const event = part.event;
  const lines: string[] = [];

  if (event.title) lines.push(`**${String(event.title)}**`);

  if (event.startTime) {
    const start = new Date(String(event.startTime));
    const dateStr = start.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    const timeStr = start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    const durationStr = event.duration ? ` (${event.duration} min)` : '';
    lines.push(`${dateStr} at ${timeStr}${durationStr}`);
  }

  if (event.location) {
    lines.push(`📍 ${String(event.location)}`);
  }

  if (part.calendarUrls?.google) {
    lines.push(`[Add to Google Calendar](${part.calendarUrls.google})`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// SSE rendering (web channel)
// ---------------------------------------------------------------------------

/**
 * Convert outbound message parts into SSE events matching the existing
 * streaming format used by the web chat.
 * Returns an array of SSE event data objects.
 */
export function renderSSEEvents(message: OutboundMessage): Array<{ type: string; [key: string]: unknown }> {
  const events: Array<{ type: string; [key: string]: unknown }> = [];

  for (const part of message.parts) {
    switch (part.type) {
      case 'text': {
        const textPart = part as OutboundTextPart;
        events.push({ type: textPart.role, text: textPart.text });
        break;
      }

      case 'event_card':
        events.push({ type: 'event', event: part.event });
        break;

      case 'progress':
        events.push({ type: 'progress', text: part.text, isLoading: part.isLoading });
        break;

      case 'action':
        if (part.action === 'clear_loading') {
          events.push({ type: 'clear_loading' });
        } else if (part.action === 'navigate_to_calendar') {
          events.push({ type: 'navigate_to_calendar', calendarUrl: part.payload?.calendarUrl });
        } else if (part.action === 'show_calendar_button') {
          events.push({ type: 'show_calendar_button', value: part.payload?.value });
        }
        break;

      case 'error':
        events.push({ type: 'error', message: part.message });
        break;
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Capability-aware rendering
// ---------------------------------------------------------------------------

/**
 * Choose the appropriate rendering strategy based on channel capabilities.
 */
export function renderForCapabilities(
  message: OutboundMessage,
  capabilities: ChannelCapabilities
): string {
  if (capabilities.streaming) {
    // Streaming channels (web) use SSE — this is handled separately
    return renderMarkdown(message);
  }

  if (capabilities.richText) {
    const rendered = renderMarkdown(message);
    // Truncate if channel has a max length
    if (capabilities.maxMessageLength > 0 && rendered.length > capabilities.maxMessageLength) {
      return rendered.slice(0, capabilities.maxMessageLength - 3) + '...';
    }
    return rendered;
  }

  const rendered = renderPlainText(message);
  if (capabilities.maxMessageLength > 0 && rendered.length > capabilities.maxMessageLength) {
    return rendered.slice(0, capabilities.maxMessageLength - 3) + '...';
  }
  return rendered;
}
