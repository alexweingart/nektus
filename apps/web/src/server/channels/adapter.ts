/**
 * Multi-Channel Agent — Channel Adapter Interface
 *
 * Every channel (web, SMS, WhatsApp, etc.) implements this interface.
 * The adapter is responsible for:
 *   1. Verifying inbound webhooks (signature, replay prevention)
 *   2. Normalizing raw payloads into NormalizedInboundMessage
 *   3. Rendering OutboundMessages into channel-native format and sending them
 */

import type {
  ChannelId,
  ChannelCapabilities,
  NormalizedInboundMessage,
  OutboundMessage,
  InboundWebhookMeta,
  WebhookVerificationResult,
} from './types';

export interface ChannelAdapter {
  /** Unique channel identifier */
  readonly channelId: ChannelId;

  /** Human-readable channel name */
  readonly displayName: string;

  /** What this channel supports */
  readonly capabilities: ChannelCapabilities;

  /**
   * Verify an inbound webhook request.
   * Returns { valid: true } if the request is authentic.
   * Adapters should verify signatures, check timestamps for replay attacks, etc.
   */
  verifyWebhook(meta: InboundWebhookMeta, request: Request): Promise<WebhookVerificationResult>;

  /**
   * Parse a verified webhook payload into a normalized inbound message.
   * Called AFTER verifyWebhook returns valid: true.
   */
  normalizeInbound(request: Request, meta: InboundWebhookMeta): Promise<NormalizedInboundMessage>;

  /**
   * Send an outbound message through this channel.
   * The adapter renders OutboundMessage parts into channel-native format.
   * Returns true if the message was sent successfully.
   */
  sendOutbound(message: OutboundMessage): Promise<boolean>;

  /**
   * Optional: Send a typing indicator / "is typing" signal.
   * Not all channels support this.
   */
  sendTypingIndicator?(recipientAddress: string): Promise<void>;

  /**
   * Optional: Handle channel-specific webhook verification challenges.
   * For example, Telegram sends a verification request when you set up a webhook,
   * and Meta/WhatsApp sends a hub.challenge for webhook verification.
   */
  handleVerificationChallenge?(request: Request): Promise<Response | null>;
}

/**
 * Base class with sensible defaults for optional methods.
 * Channel adapters can extend this instead of implementing the full interface.
 */
export abstract class BaseChannelAdapter implements ChannelAdapter {
  abstract readonly channelId: ChannelId;
  abstract readonly displayName: string;
  abstract readonly capabilities: ChannelCapabilities;

  abstract verifyWebhook(meta: InboundWebhookMeta, request: Request): Promise<WebhookVerificationResult>;
  abstract normalizeInbound(request: Request, meta: InboundWebhookMeta): Promise<NormalizedInboundMessage>;
  abstract sendOutbound(message: OutboundMessage): Promise<boolean>;

  async sendTypingIndicator(_recipientAddress: string): Promise<void> {
    // No-op by default — channels that support typing indicators override this
  }

  async handleVerificationChallenge(_request: Request): Promise<Response | null> {
    // No verification challenge by default
    return null;
  }
}
