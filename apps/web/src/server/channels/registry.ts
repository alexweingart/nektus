/**
 * Multi-Channel Agent — Channel Registry
 *
 * Central registry that maps ChannelId → ChannelAdapter.
 * The inbound router and outbound sender use this to look up the correct adapter.
 */

import type { ChannelId } from './types';
import type { ChannelAdapter } from './adapter';

class ChannelRegistry {
  private adapters = new Map<ChannelId, ChannelAdapter>();

  /**
   * Register a channel adapter. Typically called at startup.
   */
  register(adapter: ChannelAdapter): void {
    if (this.adapters.has(adapter.channelId)) {
      console.warn(`⚠️ Channel adapter "${adapter.channelId}" is being re-registered`);
    }
    this.adapters.set(adapter.channelId, adapter);
    console.log(`📡 Channel registered: ${adapter.displayName} (${adapter.channelId})`);
  }

  /**
   * Get an adapter by channel ID.
   * Returns undefined if the channel is not registered.
   */
  get(channelId: ChannelId): ChannelAdapter | undefined {
    return this.adapters.get(channelId);
  }

  /**
   * Get an adapter or throw if not found.
   */
  getOrThrow(channelId: ChannelId): ChannelAdapter {
    const adapter = this.adapters.get(channelId);
    if (!adapter) {
      throw new Error(`No adapter registered for channel: ${channelId}`);
    }
    return adapter;
  }

  /**
   * List all registered channel IDs.
   */
  listChannels(): ChannelId[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if a channel is registered.
   */
  has(channelId: ChannelId): boolean {
    return this.adapters.has(channelId);
  }
}

/** Singleton registry instance */
export const channelRegistry = new ChannelRegistry();
