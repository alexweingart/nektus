/**
 * iOS Motion Detection - using expo-sensors Accelerometer
 * Implements the same dual threshold + sequential detection algorithm as web
 */

import { Accelerometer, AccelerometerMeasurement } from 'expo-sensors';
import { MotionDetectionResult } from '@nektus/shared-types';

// Dual threshold system - either condition can trigger detection
const DETECTION_PROFILES = {
  // Profile 1: Strong bump - high magnitude with moderate jerk
  strongBump: {
    magnitude: 10, // m/s²
    jerk: 100      // m/s³
  },
  // Profile 2: Strong tap - lower magnitude with high jerk
  strongTap: {
    magnitude: 5,  // m/s²
    jerk: 200      // m/s³
  }
};

// Sequential detection system - tracks conditions across multiple events
const SEQUENTIAL_DETECTION = {
  magnitudePrime: {
    magnitude: 5,
    jerk: 100
  },
  strongMagnitudePrime: {
    magnitude: 10,
    jerk: 100
  },
  jerkPrime: {
    jerk: 100,
    magnitude: 10
  },
  strongJerkPrime: {
    jerk: 200,
    magnitude: 5
  }
};

// Accelerometer update interval in ms (higher frequency = better detection)
const UPDATE_INTERVAL = 16; // ~60Hz

interface SequentialState {
  magnitudePrimed: boolean;
  strongMagnitudePrimed: boolean;
  jerkPrimed: boolean;
  strongJerkPrimed: boolean;
  sessionStartTime: number;
  lastResetTime: number;
}

export class MotionDetector {
  private static sequentialState: SequentialState = MotionDetector.createCleanState();
  private static isCancelled = false;
  private static subscription: ReturnType<typeof Accelerometer.addListener> | null = null;

  /**
   * Start a new motion detection session - clears priming state
   */
  static startNewSession(): void {
    this.sequentialState = this.createCleanState();
    this.isCancelled = false;
  }

  /**
   * End session - cancels detection and clears all state
   */
  static endSession(): void {
    this.isCancelled = true;

    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }

    this.sequentialState = this.createCleanState();
    this.sequentialState.sessionStartTime = 0;
  }

  private static createCleanState(): SequentialState {
    return {
      magnitudePrimed: false,
      strongMagnitudePrimed: false,
      jerkPrimed: false,
      strongJerkPrimed: false,
      sessionStartTime: Date.now(),
      lastResetTime: Date.now()
    };
  }

  /**
   * Request motion permission - expo-sensors handles this automatically
   * but we check if accelerometer is available
   */
  static async requestPermission(): Promise<{ success: boolean; message?: string }> {
    try {
      const isAvailable = await Accelerometer.isAvailableAsync();

      if (!isAvailable) {
        return {
          success: false,
          message: 'Accelerometer not available on this device'
        };
      }

      // Expo sensors handle permissions automatically on iOS
      return { success: true };
    } catch (error) {
      console.warn('[iOS] Accelerometer permission check failed:', error);
      return {
        success: false,
        message: 'Failed to check accelerometer availability'
      };
    }
  }

  /**
   * Detect motion using accelerometer
   */
  static async detectMotion(): Promise<MotionDetectionResult> {
    // Check availability - wrapped in try/catch for simulator compatibility
    try {
      const isAvailable = await Accelerometer.isAvailableAsync();
      if (!isAvailable) {
        return { hasMotion: false, magnitude: 0 };
      }
    } catch (error) {
      console.warn('[iOS] Accelerometer check failed (simulator?):', error);
      return { hasMotion: false, magnitude: 0 };
    }

    // Reset cancellation for new detection
    this.isCancelled = false;

    // Reset primed states at start of each detectMotion call
    this.sequentialState.magnitudePrimed = false;
    this.sequentialState.strongMagnitudePrimed = false;
    this.sequentialState.jerkPrimed = false;
    this.sequentialState.strongJerkPrimed = false;

    // Set update interval for higher frequency sampling
    Accelerometer.setUpdateInterval(UPDATE_INTERVAL);

    return new Promise((resolve) => {
      let resolved = false;
      let eventCount = 0;
      let previousMagnitude = 0;
      let previousTimestamp = 0;

      // Warmup events to skip (similar to iOS Safari behavior)
      const WARMUP_EVENTS = 3;

      const handleAccelerometer = ({ x, y, z }: AccelerometerMeasurement) => {
        if (resolved || this.isCancelled) return;

        eventCount++;

        // Skip warmup events
        if (eventCount <= WARMUP_EVENTS) {
          previousMagnitude = Math.hypot(x, y, z);
          previousTimestamp = Date.now();
          return;
        }

        // Expo accelerometer returns values in G (1G = 9.81 m/s²)
        // Convert to m/s² to match web implementation
        const accelX = x * 9.81;
        const accelY = y * 9.81;
        const accelZ = z * 9.81;

        const magnitude = Math.hypot(accelX, accelY, accelZ);
        const eventTime = Date.now();

        // Calculate jerk
        let jerk = 0;
        if (previousTimestamp > 0) {
          const deltaTime = (eventTime - previousTimestamp) / 1000;
          const deltaMagnitude = magnitude - previousMagnitude;
          jerk = Math.abs(deltaMagnitude / deltaTime);
        }

        // Update sequential detection state
        if (magnitude >= SEQUENTIAL_DETECTION.magnitudePrime.magnitude && !this.sequentialState.magnitudePrimed) {
          this.sequentialState.magnitudePrimed = true;
        }
        if (magnitude >= SEQUENTIAL_DETECTION.strongMagnitudePrime.magnitude && !this.sequentialState.strongMagnitudePrimed) {
          this.sequentialState.strongMagnitudePrimed = true;
        }
        if (jerk >= SEQUENTIAL_DETECTION.jerkPrime.jerk && !this.sequentialState.jerkPrimed) {
          this.sequentialState.jerkPrimed = true;
        }
        if (jerk >= SEQUENTIAL_DETECTION.strongJerkPrime.jerk && !this.sequentialState.strongJerkPrimed) {
          this.sequentialState.strongJerkPrimed = true;
        }

        // Check for sequential detection
        const magnitudePrimedDetection = this.sequentialState.magnitudePrimed && jerk >= SEQUENTIAL_DETECTION.magnitudePrime.jerk;
        const strongMagnitudePrimedDetection = this.sequentialState.strongMagnitudePrimed && jerk >= SEQUENTIAL_DETECTION.strongMagnitudePrime.jerk;
        const jerkPrimedDetection = this.sequentialState.jerkPrimed && magnitude >= SEQUENTIAL_DETECTION.jerkPrime.magnitude;
        const strongJerkPrimedDetection = this.sequentialState.strongJerkPrimed && magnitude >= SEQUENTIAL_DETECTION.strongJerkPrime.magnitude;
        const sequentialDetection = magnitudePrimedDetection || strongMagnitudePrimedDetection || jerkPrimedDetection || strongJerkPrimedDetection;

        // Check for dual threshold detection
        const strongBumpDetection = magnitude >= DETECTION_PROFILES.strongBump.magnitude && jerk >= DETECTION_PROFILES.strongBump.jerk;
        const strongTapDetection = magnitude >= DETECTION_PROFILES.strongTap.magnitude && jerk >= DETECTION_PROFILES.strongTap.jerk;
        const dualThresholdDetection = strongBumpDetection || strongTapDetection;

        // Check for detection
        if (dualThresholdDetection || sequentialDetection) {
          resolved = true;
          this.cleanup();

          resolve({
            hasMotion: true,
            acceleration: {
              x: accelX,
              y: accelY,
              z: accelZ
            },
            magnitude,
            timestamp: Date.now()
          });
        }

        previousMagnitude = magnitude;
        previousTimestamp = eventTime;
      };

      // Subscribe to accelerometer
      this.subscription = Accelerometer.addListener(handleAccelerometer);

      // Cancellation check interval
      const cancellationInterval = setInterval(() => {
        if (this.isCancelled && !resolved) {
          resolved = true;
          clearInterval(cancellationInterval);
          this.cleanup();
          resolve({
            hasMotion: false,
            magnitude: 0,
            timestamp: Date.now()
          });
        }
      }, 100);
    });
  }

  private static cleanup(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
  }

  /**
   * Hash acceleration vector for matching
   */
  static async hashAcceleration(acceleration: { x: number; y: number; z: number }): Promise<string> {
    const vectorString = [
      Math.round(acceleration.x),
      Math.round(acceleration.y),
      Math.round(acceleration.z)
    ].join(',');

    // Simple hash implementation
    let hash = 0;
    for (let i = 0; i < vectorString.length; i++) {
      const char = vectorString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
