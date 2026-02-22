/**
 * Multi-Channel Agent — Web Channel Adapter
 *
 * Wraps the existing SSE-based web chat flow. This adapter is special because:
 *   - Inbound messages come from authenticated Next.js API routes (not webhooks)
 *   - Outbound messages are SSE streams (not fire-and-forget sends)
 *   - Conversation history is maintained client-side (existing behavior)
 *
 * The web adapter primarily exists so the inbound router can treat web messages
 * the same as any other channel. The actual SSE streaming continues to work
 * through the existing /api/scheduling/ai route.
 */

import { BaseChannelAdapter } from '../adapter';
import type {
  ChannelCapabilities,
  NormalizedInboundMessage,
  OutboundMessage,
  InboundWebhookMeta,
  WebhookVerificationResult,
} from '../types';

export class WebChannelAdapter extends BaseChannelAdapter {
  readonly channelId = 'web' as const;
  readonly displayName = 'Web Chat';

  readonly capabilities: ChannelCapabilities = {
    richText: true,
    buttons: true,
    cards: true,
    inboundMedia: false,
    outboundMedia: true,
    streaming: true,
    maxMessageLength: 0, // Unlimited
    typingIndicator: true,
    readReceipts: false,
  };

  /**
   * Web requests are authenticated via NextAuth session — no webhook signature needed.
   * This always returns valid since auth is handled at the API route level.
   */
  async verifyWebhook(_meta: InboundWebhookMeta, _request: Request): Promise<WebhookVerificationResult> {
    return { valid: true };
  }

  /**
   * Normalize a web chat message.
   * For the web channel, the request body IS the AISchedulingRequest,
   * so we extract the relevant fields.
   */
  async normalizeInbound(request: Request, meta: InboundWebhookMeta): Promise<NormalizedInboundMessage> {
    const body = await request.json();

    return {
      id: `web_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      channel: 'web',
      receivedAt: new Date(),
      senderAddress: body.user1Id || '',
      senderUserId: body.user1Id,
      recipientUserId: body.user2Id,
      text: body.userMessage || '',
      channelMeta: {
        conversationHistory: body.conversationHistory,
        calendarType: body.calendarType,
        availableTimeSlots: body.availableTimeSlots,
        timezone: body.timezone,
        user1Location: body.user1Location,
        user2Location: body.user2Location,
        user1Coordinates: body.user1Coordinates,
        user2Coordinates: body.user2Coordinates,
        user2Name: body.user2Name,
        user2Email: body.user2Email,
        userIp: meta.sourceIp,
      },
    };
  }

  /**
   * Web outbound is handled via SSE streaming in the existing route.
   * This method is a no-op since the web channel streams directly.
   */
  async sendOutbound(_message: OutboundMessage): Promise<boolean> {
    // Web channel doesn't use fire-and-forget sending —
    // it streams via SSE in the API route handler.
    // This exists for interface compliance.
    console.warn('WebChannelAdapter.sendOutbound called — web uses SSE streaming instead');
    return true;
  }
}

/** Singleton instance */
export const webChannelAdapter = new WebChannelAdapter();
