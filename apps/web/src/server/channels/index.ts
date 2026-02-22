/**
 * Multi-Channel Agent — Module Barrel Export
 *
 * Import from '@/server/channels' to access the channel infrastructure.
 */

// Types
export type {
  ChannelId,
  NormalizedInboundMessage,
  OutboundMessage,
  OutboundMessagePart,
  OutboundTextPart,
  OutboundEventCardPart,
  OutboundProgressPart,
  OutboundActionPart,
  OutboundErrorPart,
  ConversationState,
  ConversationMessage,
  ConversationContext,
  ChannelIdentity,
  ChannelCapabilities,
  InboundWebhookMeta,
  WebhookVerificationResult,
  MessageAttachment,
} from './types';

// Adapter base
export { BaseChannelAdapter } from './adapter';
export type { ChannelAdapter } from './adapter';

// Registry
export { channelRegistry } from './registry';

// Conversation store
export { conversationStore } from './conversation-store';

// Router
export { routeInboundMessage, sendChannelResponse } from './router';
export type { RouteResult } from './router';

// Formatters
export {
  renderPlainText,
  renderMarkdown,
  renderSSEEvents,
  renderForCapabilities,
  stripMarkdown,
} from './format';

// Adapters
export { webChannelAdapter } from './adapters/web';

// Security
export {
  verifyTwilioSignature,
  verifyTelegramSecret,
  verifyMetaSignature,
  isTimestampFresh,
  checkRateLimit,
} from './security/verify';

// ---------------------------------------------------------------------------
// Channel initialization
// ---------------------------------------------------------------------------

import { channelRegistry } from './registry';
import { webChannelAdapter } from './adapters/web';

/**
 * Register all available channel adapters.
 * Call this once at application startup.
 *
 * Phase 0: Only the web adapter is registered.
 * Phase 1+: SMS, WhatsApp, Telegram adapters will be added here.
 */
export function initializeChannels(): void {
  // Always register web (existing functionality)
  channelRegistry.register(webChannelAdapter);

  // Future channels will be conditionally registered based on env vars:
  //
  // if (process.env.TWILIO_AUTH_TOKEN) {
  //   channelRegistry.register(smsChannelAdapter);
  //   channelRegistry.register(whatsappChannelAdapter);
  // }
  //
  // if (process.env.TELEGRAM_BOT_TOKEN) {
  //   channelRegistry.register(telegramChannelAdapter);
  // }
  //
  // if (process.env.SENDGRID_INBOUND_KEY) {
  //   channelRegistry.register(emailChannelAdapter);
  // }
  //
  // if (process.env.IMESSAGE_RELAY_URL) {
  //   channelRegistry.register(imessageChannelAdapter);
  // }

  console.log(`📡 Channels initialized: [${channelRegistry.listChannels().join(', ')}]`);
}
