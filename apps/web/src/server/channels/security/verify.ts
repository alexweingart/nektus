/**
 * Multi-Channel Agent — Webhook Verification
 *
 * Channel-specific webhook signature verification functions.
 * Each channel provider signs webhooks differently:
 *
 *   - Twilio (SMS/WhatsApp): HMAC-SHA1 of URL + sorted params, compared to X-Twilio-Signature
 *   - Telegram: Secret token in X-Telegram-Bot-Api-Secret-Token header
 *   - Meta WhatsApp Cloud API: HMAC-SHA256 of body with app secret
 *   - Resend (Email): SVIX webhook signatures (HMAC-SHA256)
 *   - Slack: HMAC-SHA256 of "v0:{timestamp}:{body}" with signing secret
 *   - Teams (Azure Bot Framework): JWT verification against Microsoft's public keys
 *   - Apple Business Chat (iMessage): JWT-based verification
 *
 * IMPORTANT: These are stubs for Phase 0. Each channel adapter calls its own
 * verifyWebhook() method — these helpers are shared utilities that adapters use.
 */

import { createHmac, timingSafeEqual } from 'crypto';

// ---------------------------------------------------------------------------
// Twilio (SMS + WhatsApp via Twilio)
// ---------------------------------------------------------------------------

/**
 * Verify a Twilio webhook signature.
 * @see https://www.twilio.com/docs/usage/security#validating-requests
 */
export function verifyTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  // Sort the POST parameters alphabetically by key
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  const expectedSignature = createHmac('sha1', authToken)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64');

  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Telegram
// ---------------------------------------------------------------------------

/**
 * Verify a Telegram webhook by checking the secret token header.
 * @see https://core.telegram.org/bots/api#setwebhook
 */
export function verifyTelegramSecret(
  expectedSecret: string,
  receivedSecret: string
): boolean {
  try {
    return timingSafeEqual(
      Buffer.from(expectedSecret),
      Buffer.from(receivedSecret)
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Meta WhatsApp Cloud API
// ---------------------------------------------------------------------------

/**
 * Verify a Meta WhatsApp Cloud API webhook signature.
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
export function verifyMetaSignature(
  appSecret: string,
  signature: string,
  rawBody: string
): boolean {
  // Meta sends X-Hub-Signature-256: sha256=<hash>
  const expectedHash = createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  const expectedSignature = `sha256=${expectedHash}`;

  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Slack
// ---------------------------------------------------------------------------

/**
 * Verify a Slack webhook signature.
 * Slack sends X-Slack-Signature: v0=<HMAC-SHA256 hash>
 * The signed content is: "v0:{timestamp}:{rawBody}"
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  rawBody: string
): boolean {
  // Slack signatures always start with "v0="
  const baseString = `v0:${timestamp}:${rawBody}`;

  const expectedHash = createHmac('sha256', signingSecret)
    .update(baseString)
    .digest('hex');

  const expectedSignature = `v0=${expectedHash}`;

  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Microsoft Teams (Azure Bot Framework)
// ---------------------------------------------------------------------------

/**
 * Verify a Teams Bot Framework webhook.
 *
 * Teams sends a JWT Bearer token in the Authorization header. Full verification
 * requires fetching Microsoft's OpenID configuration and validating the JWT
 * against their public keys.
 *
 * Phase 0: Stub that checks the Authorization header format.
 * Phase 1: Will validate the JWT against Microsoft's JWKS endpoint:
 *   https://login.botframework.com/v1/.well-known/openidconfiguration
 *
 * @see https://learn.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-connector-authentication
 */
export function verifyTeamsToken(
  authorizationHeader: string,
  _expectedAudience: string
): { valid: boolean; error?: string } {
  // Authorization header should be "Bearer <jwt>"
  if (!authorizationHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing Bearer token' };
  }

  const token = authorizationHeader.slice(7);
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Invalid JWT format' };
  }

  // TODO Phase 1: Validate JWT signature against Microsoft's JWKS
  // - Fetch OpenID config from https://login.botframework.com/v1/.well-known/openidconfiguration
  // - Get JWKS URI from config
  // - Verify JWT signature, issuer, audience, and expiry
  // For now, accept any well-formed JWT (dev mode only)
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Replay attack prevention
// ---------------------------------------------------------------------------

/**
 * Check if a webhook timestamp is within an acceptable window.
 * Rejects requests older than maxAgeSeconds (default 5 minutes).
 */
export function isTimestampFresh(
  timestamp: string | number,
  maxAgeSeconds: number = 300
): boolean {
  const webhookTime = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
  if (isNaN(webhookTime)) return false;

  // Timestamps from webhooks may be in seconds (Unix) or milliseconds
  const webhookMs = webhookTime < 1e12 ? webhookTime * 1000 : webhookTime;
  const age = Date.now() - webhookMs;

  return age >= 0 && age <= maxAgeSeconds * 1000;
}

// ---------------------------------------------------------------------------
// Rate limiting (basic in-memory, upgrade to Redis for production)
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Simple rate limiter per source IP.
 * Returns true if the request is within limits.
 */
export function checkRateLimit(
  sourceIp: string,
  maxRequests: number = 30,
  windowSeconds: number = 60
): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(sourceIp);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(sourceIp, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }

  entry.count++;
  return entry.count <= maxRequests;
}

// Clean up expired rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);
