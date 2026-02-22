/**
 * Multi-Channel Agent — Inbound Message Router
 *
 * The router is the central orchestration point for all inbound messages.
 * It performs:
 *   1. Channel identification & adapter lookup
 *   2. Webhook verification (signature, replay prevention)
 *   3. Message normalization
 *   4. Identity resolution (channel address → Nektus user)
 *   5. Conversation state management (load/create server-side history)
 *   6. Dispatch to the AI scheduling pipeline
 *   7. Send the response back through the originating channel
 *
 * For the web channel, steps 5-7 are handled by the existing SSE route —
 * the router simply normalizes and returns the message for the route to process.
 */

import { channelRegistry } from './registry';
import { conversationStore } from './conversation-store';
import { checkRateLimit, isTimestampFresh } from './security/verify';
import type {
  ChannelId,
  NormalizedInboundMessage,
  InboundWebhookMeta,
  OutboundMessage,
  OutboundMessagePart,
  ConversationContext,
} from './types';

// ---------------------------------------------------------------------------
// Router result types
// ---------------------------------------------------------------------------

export interface RouteResult {
  success: boolean;
  /** The normalized message (available even if routing fails downstream) */
  normalizedMessage?: NormalizedInboundMessage;
  /** Error message if routing failed */
  error?: string;
  /** HTTP status code to return to the webhook provider */
  statusCode: number;
}

// ---------------------------------------------------------------------------
// Identity resolution (stub — will be backed by Firestore in Phase 1)
// ---------------------------------------------------------------------------

/**
 * Resolve a channel-specific address to a Nektus user ID.
 *
 * Phase 0: Returns undefined (identity resolution not yet implemented).
 * Phase 1: Will query Firestore `profiles` collection for matching
 *           phone number, email, or linked channel identity.
 */
async function resolveUserByAddress(
  _address: string,
  _channel: ChannelId
): Promise<{ userId: string; contactName?: string } | null> {
  // TODO Phase 1: Query Firestore profiles by phone/email/telegram handle
  // For now, return null — the webhook route will need userId in the payload
  // or we'll match by phone number from the user's profile
  return null;
}

/**
 * Resolve the contact the user wants to schedule with.
 *
 * Phase 0: Returns undefined.
 * Phase 1: Will use recent contact exchange history, explicit mention parsing,
 *           or the most recent scheduling conversation partner.
 */
async function resolveContact(
  _userId: string,
  _messageText: string,
  _channel: ChannelId
): Promise<{ contactId: string; contactName?: string; contactEmail?: string } | null> {
  // TODO Phase 1: Implement contact resolution strategies:
  //   1. Explicit mention ("schedule coffee with Alex")
  //   2. Reply-to context (replying to a contact exchange notification)
  //   3. Most recent contact exchange partner
  //   4. Active conversation partner on this channel
  return null;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/**
 * Route an inbound webhook request to the appropriate channel adapter.
 *
 * This is the main entry point for all non-web inbound messages.
 * Web messages continue to use the existing /api/scheduling/ai route directly.
 */
export async function routeInboundMessage(
  channelId: ChannelId,
  request: Request,
  meta: InboundWebhookMeta
): Promise<RouteResult> {
  // Step 1: Look up the channel adapter
  const adapter = channelRegistry.get(channelId);
  if (!adapter) {
    return {
      success: false,
      error: `Unknown channel: ${channelId}`,
      statusCode: 404,
    };
  }

  // Step 2: Rate limiting
  if (meta.sourceIp && !checkRateLimit(meta.sourceIp)) {
    return {
      success: false,
      error: 'Rate limit exceeded',
      statusCode: 429,
    };
  }

  // Step 3: Replay attack prevention
  if (meta.timestamp && !isTimestampFresh(meta.timestamp)) {
    return {
      success: false,
      error: 'Request timestamp too old',
      statusCode: 403,
    };
  }

  // Step 4: Verify webhook signature
  const verification = await adapter.verifyWebhook(meta, request);
  if (!verification.valid) {
    console.error(`❌ Webhook verification failed for ${channelId}: ${verification.error}`);
    return {
      success: false,
      error: verification.error || 'Webhook verification failed',
      statusCode: 403,
    };
  }

  // Step 5: Normalize the inbound message
  let normalizedMessage: NormalizedInboundMessage;
  try {
    normalizedMessage = await adapter.normalizeInbound(request, meta);
  } catch (error) {
    console.error(`❌ Failed to normalize inbound from ${channelId}:`, error);
    return {
      success: false,
      error: 'Failed to parse inbound message',
      statusCode: 400,
    };
  }

  // Step 6: Identity resolution
  if (!normalizedMessage.senderUserId) {
    const resolved = await resolveUserByAddress(normalizedMessage.senderAddress, channelId);
    if (resolved) {
      normalizedMessage.senderUserId = resolved.userId;
      normalizedMessage.senderDisplayName = resolved.contactName;
    } else {
      // Can't process without a known user
      console.warn(`⚠️ Unknown sender on ${channelId}: ${normalizedMessage.senderAddress}`);
      return {
        success: false,
        normalizedMessage,
        error: 'Unknown sender — user not registered',
        statusCode: 200, // Return 200 to acknowledge webhook (don't retry)
      };
    }
  }

  // Step 7: Contact resolution
  if (!normalizedMessage.recipientUserId) {
    const contact = await resolveContact(
      normalizedMessage.senderUserId,
      normalizedMessage.text,
      channelId
    );
    if (contact) {
      normalizedMessage.recipientUserId = contact.contactId;
    }
    // It's OK if we don't resolve a contact yet — the AI can ask
  }

  // Step 8: Load/create conversation state
  if (normalizedMessage.senderUserId) {
    const contactId = normalizedMessage.recipientUserId || 'pending';
    const context: Partial<ConversationContext> = {};

    const conversation = await conversationStore.getOrCreate(
      normalizedMessage.senderUserId,
      contactId,
      channelId,
      context
    );

    // Add the inbound message to the conversation
    await conversationStore.addMessage(
      normalizedMessage.senderUserId,
      contactId,
      channelId,
      {
        role: 'user',
        content: normalizedMessage.text,
        timestamp: normalizedMessage.receivedAt,
        channel: channelId,
      }
    );

    normalizedMessage.conversationId = conversation.id;
  }

  // Step 9: Send typing indicator (if supported)
  if (adapter.sendTypingIndicator) {
    adapter.sendTypingIndicator(normalizedMessage.senderAddress).catch(() => {
      // Non-critical — ignore errors
    });
  }

  // Return the normalized message for the route handler to dispatch to the AI pipeline
  // Phase 0: The actual AI pipeline dispatch is handled by the route
  // Phase 1+: The router will dispatch to the pipeline and send the response
  return {
    success: true,
    normalizedMessage,
    statusCode: 200,
  };
}

// ---------------------------------------------------------------------------
// Outbound helper
// ---------------------------------------------------------------------------

/**
 * Send a response back through the channel that originated the conversation.
 * Used by the AI pipeline to send results back to non-web channels.
 */
export async function sendChannelResponse(
  channelId: ChannelId,
  recipientAddress: string,
  parts: OutboundMessagePart[],
  conversationId?: string,
  recipientUserId?: string
): Promise<boolean> {
  const adapter = channelRegistry.get(channelId);
  if (!adapter) {
    console.error(`❌ No adapter for channel: ${channelId}`);
    return false;
  }

  const outbound: OutboundMessage = {
    channel: channelId,
    recipientAddress,
    recipientUserId,
    conversationId,
    parts,
  };

  try {
    return await adapter.sendOutbound(outbound);
  } catch (error) {
    console.error(`❌ Failed to send outbound on ${channelId}:`, error);
    return false;
  }
}
