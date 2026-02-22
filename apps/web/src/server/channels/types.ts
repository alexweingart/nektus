/**
 * Multi-Channel Agent — Core Types
 *
 * Channel-agnostic message types that normalize inbound messages from any
 * channel (web, SMS, WhatsApp, iMessage, email, Telegram) into a common
 * format the AI scheduling pipeline can consume, and define the outbound
 * response format that channel adapters render into channel-specific payloads.
 */

// ---------------------------------------------------------------------------
// Channel identifiers
// ---------------------------------------------------------------------------

export type ChannelId =
  | 'web'        // Existing Next.js SSE chat
  | 'sms'        // Twilio / carrier gateway
  | 'whatsapp'   // WhatsApp Business API (via Twilio or Meta Cloud API)
  | 'imessage'   // Apple Business Chat or Mac mini relay
  | 'email'      // SendGrid / Mailgun inbound parse
  | 'telegram';  // Telegram Bot API

// ---------------------------------------------------------------------------
// Inbound: Raw webhook payloads (channel-specific, pre-normalization)
// ---------------------------------------------------------------------------

/** Metadata extracted from the inbound webhook for verification & routing. */
export interface InboundWebhookMeta {
  /** Which channel this came from */
  channel: ChannelId;
  /** Raw webhook signature header (e.g. X-Twilio-Signature, X-Telegram-Bot-Api-Secret-Token) */
  signature?: string;
  /** Timestamp from the webhook (for replay-attack prevention) */
  timestamp?: string;
  /** The raw request body (for signature verification) */
  rawBody?: string;
  /** Source IP for rate limiting */
  sourceIp?: string;
}

// ---------------------------------------------------------------------------
// Inbound: Normalized message (channel-agnostic)
// ---------------------------------------------------------------------------

export interface NormalizedInboundMessage {
  /** Unique message ID (generated or from channel) */
  id: string;
  /** Which channel originated this message */
  channel: ChannelId;
  /** Timestamp when the message was received */
  receivedAt: Date;

  /** The sender's identity on this channel (phone number, email, telegram ID, etc.) */
  senderAddress: string;
  /** Resolved Nektus user ID (populated after identity resolution) */
  senderUserId?: string;
  /** Display name if available from the channel */
  senderDisplayName?: string;

  /** The target contact's identity on this channel */
  recipientAddress?: string;
  /** Resolved Nektus contact user ID */
  recipientUserId?: string;

  /** The text content of the message */
  text: string;

  /** Media attachments (images, voice notes, etc.) */
  attachments?: MessageAttachment[];

  /** Channel-specific metadata we might need downstream */
  channelMeta?: Record<string, unknown>;

  /** Conversation ID for threading (channel-native or generated) */
  conversationId?: string;
}

export interface MessageAttachment {
  type: 'image' | 'audio' | 'video' | 'document' | 'location';
  url?: string;
  mimeType?: string;
  /** For location attachments */
  coordinates?: { lat: number; lng: number };
}

// ---------------------------------------------------------------------------
// Outbound: Structured response (channel-agnostic)
// ---------------------------------------------------------------------------

/**
 * The AI agent produces OutboundMessages. Each channel adapter is responsible
 * for rendering these into the channel's native format (SMS text, WhatsApp
 * template, email HTML, Telegram markdown, etc.).
 */
export interface OutboundMessage {
  /** Target channel */
  channel: ChannelId;
  /** The recipient's address on this channel */
  recipientAddress: string;
  /** Resolved Nektus user ID of recipient */
  recipientUserId?: string;
  /** Conversation ID for threading */
  conversationId?: string;

  /** The structured response parts (rendered in order) */
  parts: OutboundMessagePart[];
}

export type OutboundMessagePart =
  | OutboundTextPart
  | OutboundEventCardPart
  | OutboundProgressPart
  | OutboundActionPart
  | OutboundErrorPart;

export interface OutboundTextPart {
  type: 'text';
  /** Markdown-formatted text (adapters downgrade for channels that don't support it) */
  text: string;
  /** Hint: is this an acknowledgment, progress update, or final content? */
  role: 'acknowledgment' | 'progress' | 'content';
}

export interface OutboundEventCardPart {
  type: 'event_card';
  /** The scheduled event data */
  event: Record<string, unknown>;
  /** Whether to show a "Create Event" action */
  showCreateButton: boolean;
  /** Calendar URLs for the event */
  calendarUrls?: {
    google?: string;
    outlook?: string;
    apple?: string;
  };
}

export interface OutboundProgressPart {
  type: 'progress';
  text: string;
  isLoading: boolean;
}

export interface OutboundActionPart {
  type: 'action';
  action: 'navigate_to_calendar' | 'show_calendar_button' | 'clear_loading';
  payload?: Record<string, unknown>;
}

export interface OutboundErrorPart {
  type: 'error';
  message: string;
}

// ---------------------------------------------------------------------------
// Conversation state (server-side, for non-web channels)
// ---------------------------------------------------------------------------

export interface ConversationState {
  /** Unique conversation ID */
  id: string;
  /** Channel this conversation is on */
  channel: ChannelId;
  /** The Nektus user who initiated (or the user we resolved from sender) */
  userId: string;
  /** The contact they're scheduling with */
  contactId: string;
  /** Contact's display name */
  contactName?: string;
  /** Full message history in OpenAI format */
  messages: ConversationMessage[];
  /** When the conversation started */
  createdAt: Date;
  /** When the conversation was last active */
  lastActiveAt: Date;
  /** Conversation-scoped context (locations, calendar type, timezone, etc.) */
  context: ConversationContext;
  /** Current state of the conversation */
  status: 'active' | 'idle' | 'completed';
}

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
  /** Which channel this specific message came from (for cross-channel conversations) */
  channel?: ChannelId;
}

export interface ConversationContext {
  /** Calendar type being used */
  calendarType: 'personal' | 'work';
  /** User's timezone */
  timezone: string;
  /** User's location */
  userLocation?: string;
  /** User's coordinates */
  userCoordinates?: { lat: number; lng: number };
  /** Contact's location */
  contactLocation?: string;
  /** Contact's coordinates */
  contactCoordinates?: { lat: number; lng: number };
  /** Contact's email (for calendar invites) */
  contactEmail?: string;
}

// ---------------------------------------------------------------------------
// Identity resolution
// ---------------------------------------------------------------------------

/** Maps a channel-specific address to a Nektus user. */
export interface ChannelIdentity {
  /** The channel this identity belongs to */
  channel: ChannelId;
  /** The address on this channel (phone number, email, telegram ID, etc.) */
  address: string;
  /** The Nektus user ID this maps to */
  userId: string;
  /** Whether this identity has been verified */
  verified: boolean;
  /** When this identity was linked */
  linkedAt: Date;
}

// ---------------------------------------------------------------------------
// Webhook verification
// ---------------------------------------------------------------------------

export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
  /** Parsed channel-specific data after verification */
  channelData?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Channel capabilities
// ---------------------------------------------------------------------------

/** Describes what a channel can do — adapters declare their capabilities. */
export interface ChannelCapabilities {
  /** Can send rich text / markdown */
  richText: boolean;
  /** Can display interactive buttons */
  buttons: boolean;
  /** Can display cards / structured content */
  cards: boolean;
  /** Can receive media (images, audio) */
  inboundMedia: boolean;
  /** Can send media */
  outboundMedia: boolean;
  /** Supports real-time streaming (SSE / WebSocket) */
  streaming: boolean;
  /** Maximum message length (0 = unlimited) */
  maxMessageLength: number;
  /** Supports typing indicators */
  typingIndicator: boolean;
  /** Supports read receipts */
  readReceipts: boolean;
}
