import { processingStateManager } from '@/server/ai-scheduling/processing';
import { enqueueContent, enqueueClearLoading, enqueueProgress } from './streaming-utils';

interface CachedEvents {
  events: Array<{
    title: string;
    url: string;
    time: string;
    date: string;
    address: string;
    description: string;
  }>;
  location: string;
  timeframe: string;
  shownCount: number;
}

export async function handleShowMoreEvents(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<void> {
  try {
    console.log('🔍 Searching for cached events to show more...');

    // Get all cache keys that match the events pattern
    // We'll need to find the most recent one
    const cacheKeys = await processingStateManager.getKeys('events:*');
    console.log(`📋 Found ${cacheKeys?.length || 0} cache keys:`, cacheKeys);

    if (!cacheKeys || cacheKeys.length === 0) {
      console.log('❌ No cache keys found');
      enqueueContent(
        controller,
        encoder,
        "I couldn't find the previous event search results. Could you tell me what you're looking for again?"
      );
      enqueueClearLoading(controller, encoder);
      return;
    }

    // Sort by timestamp (last part of key) to get most recent
    const sortedKeys = cacheKeys.sort((a, b) => {
      const aTime = parseInt(a.split(':').pop() || '0');
      const bTime = parseInt(b.split(':').pop() || '0');
      return bTime - aTime;
    });

    const mostRecentKey = sortedKeys[0];
    console.log(`✅ Found most recent cache key: ${mostRecentKey}`);

    // Retrieve cached events
    const cached = await processingStateManager.getCached<CachedEvents>(mostRecentKey);
    console.log(`📦 Retrieved cached data:`, cached ? `${cached.events?.length || 0} events, shown: ${cached.shownCount}` : 'null');

    if (!cached || !cached.events) {
      console.log('❌ No cached events found');
      enqueueContent(
        controller,
        encoder,
        "I couldn't find the cached events. Could you tell me what you're looking for again?"
      );
      enqueueClearLoading(controller, encoder);
      return;
    }

    const { events, location, timeframe, shownCount } = cached;
    console.log(`📊 Events data: total=${events.length}, shown=${shownCount}`);

    // Determine next batch of events
    const nextBatchStart = shownCount;
    const nextBatchEnd = Math.min(shownCount + 5, events.length);
    const remainingEvents = events.slice(nextBatchStart, nextBatchEnd);
    console.log(`🎯 Showing events ${nextBatchStart}-${nextBatchEnd} (${remainingEvents.length} events)`);

    if (remainingEvents.length === 0) {
      console.log('⚠️ No remaining events to show');
      enqueueContent(
        controller,
        encoder,
        "That's all the events I found! Would you like me to search for something else?"
      );
      enqueueClearLoading(controller, encoder);
      return;
    }

    // Format the additional events
    const formattedMessage = `Here are more events happening ${timeframe}!\n\n` +
      remainingEvents.map((event: { title: string; url: string; time: string; date: string; address: string; description: string }) =>
        `- **[${event.title}](${event.url})**\n` +
        `  - 📅 ${event.time} on ${event.date}\n` +
        `  - 📍 ${event.address}\n` +
        `  - ${event.description}`
      ).join('\n\n') +
      (nextBatchEnd < events.length
        ? `\n\nI found ${events.length - nextBatchEnd} more events - would you like to see them?`
        : `\n\nThat's all the events I found ${timeframe}!`);

    // Update cache with new shownCount
    await processingStateManager.set(mostRecentKey, {
      events,
      location,
      timeframe,
      shownCount: nextBatchEnd,
    }, 3600); // Keep same TTL

    // Send progress first to create the content message ID
    enqueueProgress(controller, encoder, 'Loading more events...');

    // Send the formatted message
    enqueueContent(controller, encoder, formattedMessage);
    enqueueClearLoading(controller, encoder);

    console.log(`✅ Showed ${remainingEvents.length} more events (${nextBatchStart}-${nextBatchEnd} of ${events.length})`);

  } catch (error) {
    console.error('❌ Error showing more events:', error);
    enqueueContent(
      controller,
      encoder,
      "Sorry, I had trouble finding more events. Could you tell me what you're looking for again?"
    );
    enqueueClearLoading(controller, encoder);
  }
}
