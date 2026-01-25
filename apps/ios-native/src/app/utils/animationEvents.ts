/**
 * Animation Event Emitter
 *
 * Manages animation events between ExchangeButton and ProfileView/ProfileInfo.
 * Replaces web's window.dispatchEvent pattern with a TypeScript event emitter.
 */

type AnimationEventType =
  | 'start-floating'
  | 'stop-floating'
  | 'bump-detected'
  | 'match-found'
  | 'cancel-exchange';

type AnimationEventData = {
  'start-floating': undefined;
  'stop-floating': undefined;
  'bump-detected': undefined;
  'match-found': { backgroundColors?: string[] };
  'cancel-exchange': undefined;
};

type AnimationEventListener<T extends AnimationEventType> = (
  data: AnimationEventData[T]
) => void;

class AnimationEventEmitter {
  private listeners: Map<AnimationEventType, Set<AnimationEventListener<any>>> = new Map();

  /**
   * Subscribe to an animation event
   */
  on<T extends AnimationEventType>(
    event: T,
    listener: AnimationEventListener<T>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  /**
   * Emit an animation event
   */
  emit<T extends AnimationEventType>(event: T, data?: AnimationEventData[T]): void {
    console.log(`[AnimationEvents] Emitting: ${event}`);
    this.listeners.get(event)?.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`[AnimationEvents] Error in listener for ${event}:`, error);
      }
    });
  }

  /**
   * Remove all listeners for an event
   */
  off(event: AnimationEventType): void {
    this.listeners.delete(event);
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear();
  }
}

// Singleton instance
export const animationEvents = new AnimationEventEmitter();

// Track when float animation started for syncing button pulse
export let floatAnimationStart: number | null = null;

// Convenience functions
export const emitStartFloating = () => {
  floatAnimationStart = Date.now();
  animationEvents.emit('start-floating');
};
export const emitStopFloating = () => animationEvents.emit('stop-floating');
export const emitBumpDetected = () => animationEvents.emit('bump-detected');
export const emitMatchFound = (backgroundColors?: string[]) =>
  animationEvents.emit('match-found', { backgroundColors });
export const emitCancelExchange = () => animationEvents.emit('cancel-exchange');
