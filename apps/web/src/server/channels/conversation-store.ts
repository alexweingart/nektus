/**
 * Multi-Channel Agent — Server-Side Conversation Store
 *
 * For non-web channels (SMS, WhatsApp, etc.), conversation history must be
 * stored server-side since there's no client to maintain state.
 *
 * Uses the same Redis + in-memory fallback pattern as ProcessingStateManager.
 *
 * Conversations are keyed by (userId, contactId, channel) and expire after
 * a configurable idle timeout.
 */

import { Redis } from '@upstash/redis';
import type { ChannelId, ConversationState, ConversationMessage, ConversationContext } from './types';
import type { Message } from '@/types/ai-scheduling';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How long a conversation stays alive after the last message (2 hours) */
const CONVERSATION_TTL_SECONDS = 2 * 60 * 60;

/** Maximum messages to keep per conversation (prevent unbounded growth) */
const MAX_CONVERSATION_MESSAGES = 50;

/** Redis key prefix */
const KEY_PREFIX = 'conv';

// ---------------------------------------------------------------------------
// Conversation Store
// ---------------------------------------------------------------------------

class ConversationStore {
  private redis: Redis | null = null;
  private memoryStore = new Map<string, ConversationState>();

  constructor() {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

    if (redisUrl && redisToken) {
      try {
        this.redis = new Redis({ url: redisUrl, token: redisToken });
      } catch (error) {
        console.error('❌ ConversationStore: Failed to init Redis:', error);
      }
    }
  }

  /**
   * Build a deterministic key for a 1:1 conversation.
   * Sorted user IDs ensure the same conversation regardless of who initiates.
   */
  private buildKey(userId: string, contactId: string, channel: ChannelId): string {
    const sorted = [userId, contactId].sort();
    return `${KEY_PREFIX}:${channel}:${sorted[0]}:${sorted[1]}`;
  }

  /**
   * Build a deterministic key for a group conversation (3+ participants).
   * All participant IDs are sorted so order doesn't matter.
   */
  private buildGroupKey(participantIds: string[], channel: ChannelId): string {
    const sorted = [...participantIds].sort();
    return `${KEY_PREFIX}:${channel}:group:${sorted.join(':')}`;
  }

  /**
   * Get or create a conversation between two users on a channel.
   */
  async getOrCreate(
    userId: string,
    contactId: string,
    channel: ChannelId,
    context?: Partial<ConversationContext>
  ): Promise<ConversationState> {
    const key = this.buildKey(userId, contactId, channel);
    const existing = await this.get(key);

    if (existing) {
      return existing;
    }

    // Create new conversation
    const conversation: ConversationState = {
      id: key,
      channel,
      userId,
      contactId,
      participantIds: [userId, contactId].filter(id => id !== 'pending'),
      messages: [],
      createdAt: new Date(),
      lastActiveAt: new Date(),
      context: {
        calendarType: context?.calendarType || 'personal',
        timezone: context?.timezone || 'America/Los_Angeles',
        userLocation: context?.userLocation,
        userCoordinates: context?.userCoordinates,
        contactLocation: context?.contactLocation,
        contactCoordinates: context?.contactCoordinates,
        contactEmail: context?.contactEmail,
      },
      status: 'active',
    };

    await this.save(key, conversation);
    return conversation;
  }

  /**
   * Append a message to a conversation and update the TTL.
   */
  async addMessage(
    userId: string,
    contactId: string,
    channel: ChannelId,
    message: ConversationMessage
  ): Promise<ConversationState> {
    const key = this.buildKey(userId, contactId, channel);
    const conversation = await this.get(key);

    if (!conversation) {
      throw new Error(`No conversation found: ${key}`);
    }

    conversation.messages.push(message);
    conversation.lastActiveAt = new Date();
    conversation.status = 'active';

    // Trim to max messages (keep most recent)
    if (conversation.messages.length > MAX_CONVERSATION_MESSAGES) {
      conversation.messages = conversation.messages.slice(-MAX_CONVERSATION_MESSAGES);
    }

    await this.save(key, conversation);
    return conversation;
  }

  /**
   * Convert conversation messages to the AISchedulingRequest format
   * that the existing orchestrator expects.
   */
  toSchedulingHistory(conversation: ConversationState): Message[] {
    return conversation.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
    }));
  }

  /**
   * Mark a conversation as completed (e.g., event was created).
   */
  async complete(userId: string, contactId: string, channel: ChannelId): Promise<void> {
    const key = this.buildKey(userId, contactId, channel);
    const conversation = await this.get(key);
    if (conversation) {
      conversation.status = 'completed';
      await this.save(key, conversation);
    }
  }

  /**
   * Get or create a group conversation (3+ participants).
   * The conversation is always initiated by the userId who DMs the bot.
   *
   * When the bot creates the event, calendar invites handle accept/decline
   * natively — no custom RSVP flow needed.
   *
   * Note: when web group chat ships, this method will need to be aware of
   * group-context so the AI knows which participants are in the conversation
   * and doesn't leak cross-conversation context.
   */
  async getOrCreateGroup(
    userId: string,
    participantIds: string[],
    channel: ChannelId,
    context?: Partial<ConversationContext>,
    participantNames?: Record<string, string>
  ): Promise<ConversationState> {
    const allIds = [userId, ...participantIds.filter(id => id !== userId)];
    const key = this.buildGroupKey(allIds, channel);
    const existing = await this.get(key);

    if (existing) {
      return existing;
    }

    const conversation: ConversationState = {
      id: key,
      channel,
      userId,
      contactId: participantIds[0] || 'pending',
      participantIds: allIds,
      participantNames,
      messages: [],
      createdAt: new Date(),
      lastActiveAt: new Date(),
      context: {
        calendarType: context?.calendarType || 'personal',
        timezone: context?.timezone || 'America/Los_Angeles',
        userLocation: context?.userLocation,
        userCoordinates: context?.userCoordinates,
        contactLocation: context?.contactLocation,
        contactCoordinates: context?.contactCoordinates,
        contactEmail: context?.contactEmail,
      },
      status: 'active',
    };

    await this.save(key, conversation);
    return conversation;
  }

  /**
   * Delete a conversation.
   */
  async delete(userId: string, contactId: string, channel: ChannelId): Promise<void> {
    const key = this.buildKey(userId, contactId, channel);
    if (this.redis) {
      await this.redis.del(key);
    } else {
      this.memoryStore.delete(key);
    }
  }

  // -------------------------------------------------------------------------
  // Internal storage operations
  // -------------------------------------------------------------------------

  private async get(key: string): Promise<ConversationState | null> {
    try {
      if (this.redis) {
        const data = await this.redis.get(key);
        if (!data) return null;
        const state = (typeof data === 'string' ? JSON.parse(data) : data) as ConversationState;
        state.createdAt = new Date(state.createdAt);
        state.lastActiveAt = new Date(state.lastActiveAt);
        state.messages = state.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
        return state;
      }

      return this.memoryStore.get(key) || null;
    } catch (error) {
      console.error(`ConversationStore: Error getting ${key}:`, error);
      return this.memoryStore.get(key) || null;
    }
  }

  private async save(key: string, state: ConversationState): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.set(key, JSON.stringify(state), { ex: CONVERSATION_TTL_SECONDS });
      } else {
        this.memoryStore.set(key, state);
        // Auto-cleanup for in-memory
        setTimeout(() => {
          this.memoryStore.delete(key);
        }, CONVERSATION_TTL_SECONDS * 1000);
      }
    } catch (error) {
      console.error(`ConversationStore: Error saving ${key}:`, error);
      this.memoryStore.set(key, state);
    }
  }
}

/** Singleton conversation store */
export const conversationStore = new ConversationStore();
