/**
 * Multi-Channel Agent — Inbound Webhook Route
 *
 * Dynamic route: POST /api/channels/inbound/:channel
 *
 * Receives inbound messages from external channel providers (Twilio, Telegram,
 * Meta, etc.) and routes them through the channel abstraction layer.
 *
 * Each provider sends webhooks in a different format — the channel adapter
 * handles normalization. This route handles:
 *   1. Extract channel ID from URL params
 *   2. Build webhook metadata (signature, IP, timestamp)
 *   3. Route through the inbound router (verify → normalize → dispatch)
 *   4. Return appropriate HTTP response to the provider
 *
 * Phase 0: Accepts webhooks, verifies, normalizes, and logs.
 *          Does NOT yet dispatch to the AI pipeline (that's Phase 1).
 *
 * GET handler: Responds to webhook verification challenges (Telegram, Meta).
 */

import { NextRequest, NextResponse } from 'next/server';
import { routeInboundMessage } from '@/server/channels/router';
import { channelRegistry } from '@/server/channels/registry';
import type { ChannelId, InboundWebhookMeta } from '@/server/channels/types';

// Valid channel IDs for type checking
const VALID_CHANNELS = new Set<string>(['web', 'sms', 'whatsapp', 'imessage', 'email', 'telegram']);

/**
 * POST — Receive an inbound message from a channel provider.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channel: string }> }
) {
  const { channel } = await params;

  // Validate channel ID
  if (!VALID_CHANNELS.has(channel)) {
    return NextResponse.json(
      { error: `Unknown channel: ${channel}` },
      { status: 404 }
    );
  }

  const channelId = channel as ChannelId;

  // Check if adapter is registered
  if (!channelRegistry.has(channelId)) {
    return NextResponse.json(
      { error: `Channel not configured: ${channelId}` },
      { status: 501 } // Not Implemented
    );
  }

  // Build webhook metadata
  const meta: InboundWebhookMeta = {
    channel: channelId,
    signature: extractSignature(request, channelId),
    timestamp: request.headers.get('x-twilio-timestamp') ||
               request.headers.get('x-request-timestamp') ||
               undefined,
    sourceIp: request.headers.get('x-forwarded-for')?.split(',')[0] ||
              request.headers.get('x-real-ip') ||
              undefined,
  };

  // For channels that need the raw body for signature verification,
  // we clone the request so the body can be read twice
  if (meta.signature) {
    try {
      const cloned = request.clone();
      meta.rawBody = await cloned.text();
    } catch {
      // Body already consumed or unavailable
    }
  }

  console.log(`📨 Inbound webhook: ${channelId}`, {
    hasSignature: !!meta.signature,
    sourceIp: meta.sourceIp,
  });

  // Route the message
  const result = await routeInboundMessage(channelId, request, meta);

  if (!result.success) {
    console.warn(`⚠️ Inbound routing failed for ${channelId}: ${result.error}`);
  } else {
    console.log(`✅ Inbound message routed from ${channelId}:`, {
      messageId: result.normalizedMessage?.id,
      senderAddress: result.normalizedMessage?.senderAddress,
      senderUserId: result.normalizedMessage?.senderUserId,
      textPreview: result.normalizedMessage?.text.slice(0, 50),
    });
  }

  // Return the status code the provider expects
  // Most providers expect 200 to acknowledge receipt (even for errors)
  return NextResponse.json(
    {
      success: result.success,
      messageId: result.normalizedMessage?.id,
      error: result.error,
    },
    { status: result.statusCode }
  );
}

/**
 * GET — Handle webhook verification challenges.
 * Telegram and Meta WhatsApp send GET requests to verify webhook URLs.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channel: string }> }
) {
  const { channel } = await params;

  if (!VALID_CHANNELS.has(channel)) {
    return NextResponse.json({ error: 'Unknown channel' }, { status: 404 });
  }

  const channelId = channel as ChannelId;
  const adapter = channelRegistry.get(channelId);

  if (!adapter) {
    return NextResponse.json({ error: 'Channel not configured' }, { status: 501 });
  }

  // Let the adapter handle the verification challenge
  if (adapter.handleVerificationChallenge) {
    const challengeResponse = await adapter.handleVerificationChallenge(request);
    if (challengeResponse) {
      return challengeResponse;
    }
  }

  // Default: return 200 with channel status
  return NextResponse.json({
    channel: channelId,
    status: 'active',
    capabilities: adapter.capabilities,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the webhook signature header based on channel conventions.
 */
function extractSignature(request: NextRequest, channel: ChannelId): string | undefined {
  switch (channel) {
    case 'sms':
    case 'whatsapp':
      // Twilio: X-Twilio-Signature
      return request.headers.get('x-twilio-signature') || undefined;

    case 'telegram':
      // Telegram: X-Telegram-Bot-Api-Secret-Token
      return request.headers.get('x-telegram-bot-api-secret-token') || undefined;

    case 'email':
      // SendGrid: X-Twilio-Email-Event-Webhook-Signature
      return request.headers.get('x-twilio-email-event-webhook-signature') || undefined;

    case 'imessage':
      // Apple Business Chat: Authorization header with JWT
      return request.headers.get('authorization') || undefined;

    default:
      return undefined;
  }
}
