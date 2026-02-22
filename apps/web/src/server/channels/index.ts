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
  VerificationToken,
  RSVPToken,
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
  verifySlackSignature,
  verifyTeamsToken,
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
  // Mac mini relay (SMS + iMessage via same device)
  // if (process.env.MAC_RELAY_URL) {
  //   channelRegistry.register(smsChannelAdapter);
  //   channelRegistry.register(imessageChannelAdapter);
  // }
  //
  // if (process.env.WHATSAPP_PHONE_NUMBER_ID) {
  //   channelRegistry.register(whatsappChannelAdapter);
  // }
  //
  // if (process.env.TELEGRAM_BOT_TOKEN) {
  //   channelRegistry.register(telegramChannelAdapter);
  // }
  //
  // if (process.env.RESEND_API_KEY) {
  //   channelRegistry.register(emailChannelAdapter);
  // }
  //
  // if (process.env.SLACK_SIGNING_SECRET) {
  //   channelRegistry.register(slackChannelAdapter);
  // }
  //
  // if (process.env.TEAMS_APP_ID) {
  //   channelRegistry.register(teamsChannelAdapter);
  // }

  console.log(`📡 Channels initialized: [${channelRegistry.listChannels().join(', ')}]`);
}
