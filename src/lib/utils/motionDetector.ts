import { MotionDetectionResult } from '@/types/contactExchange';
import { getServerNow } from '../services/client/clockSyncService';

// Dual threshold system - either condition can trigger detection
const DETECTION_PROFILES = {
  // Profile 1: Strong bump - high magnitude, moderate jerk
  strongBump: {
    magnitude: 10, // m/s²
    jerk: 125      // m/s³
  },
  // Profile 2: Sharp tap - lower magnitude, high jerk  
  sharpTap: {
    magnitude: 5,  // m/s²
    jerk: 250      // m/s³
  }
};

// Sequential detection system - tracks conditions across multiple events
const SEQUENTIAL_DETECTION = {
  // If magnitude 5 is hit in any previous event, jerk 200 in future event triggers
  magnitudePrime: {
    magnitude: 5,    // m/s² - threshold to enter "magnitude primed" state
    jerk: 200        // m/s³ - jerk threshold when magnitude primed
  },
  // If jerk 100 is hit in any previous event, magnitude 10 in future event triggers
  jerkPrime: {
    jerk: 100,       // m/s³ - threshold to enter "jerk primed" state
    magnitude: 10    // m/s² - magnitude threshold when jerk primed
  }
};

const SPIKE_DURATION_MS = 500;

export class MotionDetector {
  // Persistent sequential detection state - now properly managed per session
  private static sequentialState = {
    magnitudePrimed: false,
    jerkPrimed: false,
    sessionStartTime: 0,
    lastResetTime: 0
  };

  // External cancellation control
  private static isCancelled = false;

  /**
   * Start a new motion detection session - clears priming state and prepares for detection
   */
  static startNewSession(): void {
    this.sequentialState = {
      magnitudePrimed: false,
      jerkPrimed: false,
      sessionStartTime: Date.now(),
      lastResetTime: Date.now()
    };
    this.isCancelled = false;
    console.log('🔄 Motion session started');
  }

  /**
   * End session - cancels detection and clears all state
   */
  static endSession(): void {
    this.isCancelled = true;
    this.sequentialState = {
      magnitudePrimed: false,
      jerkPrimed: false,
      sessionStartTime: 0,
      lastResetTime: Date.now()
    };
    console.log('🧹 Motion session ended');
  }

  /**
   * Get current sequential detection state
   */
  static getSequentialState(): typeof MotionDetector.sequentialState {
    return { ...this.sequentialState };
  }

  // Pattern analysis removed - was disabled and added complexity

  // Simplified - just use the strong bump profile as default thresholds
  private static calculateAdaptiveThresholds(browserInfo: any, recentMagnitudes: Array<{magnitude: number, timestamp: number}>): {magnitude: number, jerk: number} {
    // Use strong bump profile as the base threshold (standardized across all devices)
    return {
      magnitude: DETECTION_PROFILES.strongBump.magnitude,
      jerk: DETECTION_PROFILES.strongBump.jerk
    };
  }

  private static getBrowserInfo() {
    const userAgent = navigator.userAgent;
    
    // Detect iOS (including Chrome on iOS)
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    // Detect Chrome on iOS (Chrome on iOS uses Safari's WebKit but identifies as Chrome)
    const isChromeOnIOS = isIOS && /CriOS/.test(userAgent);
    
    // Detect Safari on iOS 
    const isSafariOnIOS = isIOS && !isChromeOnIOS && /Safari/.test(userAgent);
    
    // Detect desktop Safari
    const isDesktopSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent) && !isIOS;
    
    // Detect Android
    const isAndroid = /Android/.test(userAgent);
    
    // Detect Chrome on Android
    const isChromeOnAndroid = isAndroid && /Chrome/.test(userAgent);
    
    return {
      userAgent,
      isIOS,
      isChromeOnIOS,
      isSafariOnIOS,
      isDesktopSafari,
      isAndroid,
      isChromeOnAndroid,
      hasDeviceMotionEvent: typeof DeviceMotionEvent !== 'undefined',
      hasRequestPermission: typeof DeviceMotionEvent !== 'undefined' && 
                           typeof (DeviceMotionEvent as any).requestPermission === 'function'
    };
  }

  static async requestPermission(): Promise<{ success: boolean; message?: string }> {
    const browserInfo = this.getBrowserInfo();
    
    // Simplified browser detection - just console logging

    // Handle different browser cases
    if (browserInfo.isChromeOnIOS) {
      console.log('🚫 Chrome on iOS detected - DeviceMotionEvent.requestPermission not supported');
      return { 
        success: false, 
        message: 'Chrome on iOS doesn\'t support motion detection. Please use Safari on iOS instead.' 
      };
    }
    
    if (browserInfo.isDesktopSafari) {
      console.log('🚫 Desktop Safari detected - DeviceMotionEvent.requestPermission not available');
      return { 
        success: false, 
        message: 'Motion detection is only available on mobile devices. Please use a mobile phone.' 
      };
    }

    if (browserInfo.isSafariOnIOS && browserInfo.hasRequestPermission) {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        
        if (permission === 'granted') {
          return { success: true };
        } else {
          return { 
            success: false, 
            message: 'Motion permission denied. Please allow motion access for this website in Safari.' 
          };
        }
      } catch (error) {
        console.warn('❌ iOS Safari permission request failed:', error);
        
        // Simplified error logging
        
        return { 
          success: false, 
          message: 'Failed to request motion permission. Try refreshing and allowing motion access.' 
        };
      }
    }
    
    if (browserInfo.isSafariOnIOS && !browserInfo.hasRequestPermission) {
      console.log('🚫 iOS Safari without requestPermission - possibly private browsing or older iOS');
      return { 
        success: false, 
        message: 'Motion permission not available. Please disable private browsing or update iOS.' 
      };
    }
    
    if (browserInfo.isChromeOnAndroid || browserInfo.isAndroid) {
      return { success: true };
    }
    
    // Fallback for other browsers
    return { success: true };
  }

  private static async requestMotionPermission(): Promise<boolean> {
    // This method is kept for backwards compatibility but now just calls the public method
    const result = await this.requestPermission();
    return result.success;
  }

  static async detectMotion(): Promise<MotionDetectionResult> {
    // Check if DeviceMotionEvent is supported
    if (!window.DeviceMotionEvent) {
      console.log('❌ DeviceMotionEvent not supported');
      return {
        hasMotion: false,
        magnitude: 0
      };
    }

    // Reset cancellation for new detection
    this.isCancelled = false;

    // Determine the appropriate threshold based on device (initial)
    const browserInfo = this.getBrowserInfo();
    let currentThresholds = this.calculateAdaptiveThresholds(browserInfo, []);
    
    console.log(`📱 Motion detection active (${browserInfo.isIOS ? 'iOS' : browserInfo.isAndroid ? 'Android' : 'Other'})`);

    return new Promise((resolve) => {
      let resolved = false;
      let motionEventCount = 0;
      let recentMagnitudes: Array<{magnitude: number, timestamp: number}> = [];
      let previousMagnitude = 0;
      let previousTimestamp = 0;
      let allMotionEvents: any[] = []; // Store all motion events for analytics
      const sessionStartTime = getServerNow();
      
      // Track peak events for debugging
      let peakMagnitudeEvent: any = null;
      let peakJerkEvent: any = null;
      
      // Use persistent sequential detection state (maintains across multiple detectMotion calls within session)
      let magnitudePrimed = this.sequentialState.magnitudePrimed;
      let jerkPrimed = this.sequentialState.jerkPrimed;
      
      const handleMotion = (event: DeviceMotionEvent) => {
        if (resolved || this.isCancelled) return;
        
        motionEventCount++;
        
        // Prefer acceleration WITHOUT gravity, fall back to including gravity if null
        const accel = event.acceleration ?? event.accelerationIncludingGravity;
        
        if (!accel || accel.x === null || accel.y === null || accel.z === null) {
          if (motionEventCount <= 5) {
            console.log(`📊 Motion event ${motionEventCount}: no acceleration data`);
          }
          return;
        }

        const magnitude = Math.hypot(accel.x, accel.y, accel.z);
        const now = getServerNow();
        
        // Calculate jerk (rate of change of acceleration)
        let jerk = 0;
        if (previousTimestamp > 0) {
          const deltaTime = (now - previousTimestamp) / 1000; // Convert to seconds
          const deltaMagnitude = magnitude - previousMagnitude;
          jerk = Math.abs(deltaMagnitude / deltaTime); // m/s³
        }
        
        // Keep track of recent magnitudes for spike detection
        recentMagnitudes.push({ magnitude, timestamp: now });
        recentMagnitudes = recentMagnitudes.filter(m => now - m.timestamp <= SPIKE_DURATION_MS);
        
        // Recalculate adaptive thresholds periodically based on recent motion
        if (motionEventCount % 10 === 0) { // Every 10 events, recalculate
          currentThresholds = this.calculateAdaptiveThresholds(browserInfo, recentMagnitudes);
        }
        
        // Track peak events for debugging
        if (!peakMagnitudeEvent || magnitude > peakMagnitudeEvent.magnitude) {
          peakMagnitudeEvent = {
            eventNumber: motionEventCount,
            magnitude: magnitude,
            jerk: jerk,
            acceleration: { x: accel.x, y: accel.y, z: accel.z },
            timestamp: now,
            thresholds: { ...currentThresholds },
            metMagnitudeThreshold: magnitude >= currentThresholds.magnitude,
            metJerkThreshold: jerk >= currentThresholds.jerk,
            metBothThresholds: magnitude >= currentThresholds.magnitude && jerk >= currentThresholds.jerk,
            // Dual threshold analysis
            metStrongBump: magnitude >= DETECTION_PROFILES.strongBump.magnitude && jerk >= DETECTION_PROFILES.strongBump.jerk,
            metSharpTap: magnitude >= DETECTION_PROFILES.sharpTap.magnitude && jerk >= DETECTION_PROFILES.sharpTap.jerk,
            metEitherProfile: (magnitude >= DETECTION_PROFILES.strongBump.magnitude && jerk >= DETECTION_PROFILES.strongBump.jerk) || 
                             (magnitude >= DETECTION_PROFILES.sharpTap.magnitude && jerk >= DETECTION_PROFILES.sharpTap.jerk),
            // Sequential detection analysis
            metMagnitudePrimed: magnitudePrimed && jerk >= SEQUENTIAL_DETECTION.magnitudePrime.jerk,
            metJerkPrimed: jerkPrimed && magnitude >= SEQUENTIAL_DETECTION.jerkPrime.magnitude,
            metSequential: (magnitudePrimed && jerk >= SEQUENTIAL_DETECTION.magnitudePrime.jerk) || 
                          (jerkPrimed && magnitude >= SEQUENTIAL_DETECTION.jerkPrime.magnitude),
            sequentialState: { magnitudePrimed, jerkPrimed }
          };
        }
        
        if (!peakJerkEvent || jerk > peakJerkEvent.jerk) {
          peakJerkEvent = {
            eventNumber: motionEventCount,
            magnitude: magnitude,
            jerk: jerk,
            acceleration: { x: accel.x, y: accel.y, z: accel.z },
            timestamp: now,
            thresholds: { ...currentThresholds },
            metMagnitudeThreshold: magnitude >= currentThresholds.magnitude,
            metJerkThreshold: jerk >= currentThresholds.jerk,
            metBothThresholds: magnitude >= currentThresholds.magnitude && jerk >= currentThresholds.jerk,
            // Dual threshold analysis
            metStrongBump: magnitude >= DETECTION_PROFILES.strongBump.magnitude && jerk >= DETECTION_PROFILES.strongBump.jerk,
            metSharpTap: magnitude >= DETECTION_PROFILES.sharpTap.magnitude && jerk >= DETECTION_PROFILES.sharpTap.jerk,
            metEitherProfile: (magnitude >= DETECTION_PROFILES.strongBump.magnitude && jerk >= DETECTION_PROFILES.strongBump.jerk) || 
                             (magnitude >= DETECTION_PROFILES.sharpTap.magnitude && jerk >= DETECTION_PROFILES.sharpTap.jerk),
            // Sequential detection analysis
            metMagnitudePrimed: magnitudePrimed && jerk >= SEQUENTIAL_DETECTION.magnitudePrime.jerk,
            metJerkPrimed: jerkPrimed && magnitude >= SEQUENTIAL_DETECTION.jerkPrime.magnitude,
            metSequential: (magnitudePrimed && jerk >= SEQUENTIAL_DETECTION.magnitudePrime.jerk) || 
                          (jerkPrimed && magnitude >= SEQUENTIAL_DETECTION.jerkPrime.magnitude),
            sequentialState: { magnitudePrimed, jerkPrimed }
          };
        }
        
        // Store all motion events for analytics
        allMotionEvents.push({
          timestamp: now,
          magnitude: magnitude,
          jerk: jerk,
          acceleration: { x: accel.x, y: accel.y, z: accel.z }
        });
        
        // Update sequential detection state (both local and persistent)
        if (magnitude >= SEQUENTIAL_DETECTION.magnitudePrime.magnitude && !magnitudePrimed) {
          magnitudePrimed = true;
          this.sequentialState.magnitudePrimed = true;
          console.log(`📈 Magnitude primed: ${magnitude.toFixed(2)} ≥ ${SEQUENTIAL_DETECTION.magnitudePrime.magnitude}`);
        }
        if (jerk >= SEQUENTIAL_DETECTION.jerkPrime.jerk && !jerkPrimed) {
          jerkPrimed = true;
          this.sequentialState.jerkPrimed = true;
          console.log(`📊 Jerk primed: ${jerk.toFixed(1)} ≥ ${SEQUENTIAL_DETECTION.jerkPrime.jerk}`);
        }
        
        // Check for sequential detection: primed conditions from previous events
        const magnitudePrimedDetection = magnitudePrimed && jerk >= SEQUENTIAL_DETECTION.magnitudePrime.jerk;
        const jerkPrimedDetection = jerkPrimed && magnitude >= SEQUENTIAL_DETECTION.jerkPrime.magnitude;
        const sequentialDetection = magnitudePrimedDetection || jerkPrimedDetection;
        
        // Check for dual threshold detection: either profile can trigger
        const strongBumpDetection = magnitude >= DETECTION_PROFILES.strongBump.magnitude && jerk >= DETECTION_PROFILES.strongBump.jerk;
        const sharpTapDetection = magnitude >= DETECTION_PROFILES.sharpTap.magnitude && jerk >= DETECTION_PROFILES.sharpTap.jerk;
        const dualThresholdDetection = strongBumpDetection || sharpTapDetection;
        
        // Check for detection: dual threshold or sequential detection
        if (dualThresholdDetection || sequentialDetection) {
          let detectionType = 'unknown';
          let confidence = 1.0;
          
          if (strongBumpDetection) {
            detectionType = 'strong_bump';
          } else if (sharpTapDetection) {
            detectionType = 'sharp_tap';
          } else if (magnitudePrimedDetection) {
            detectionType = 'magnitude_primed';
          } else if (jerkPrimedDetection) {
            detectionType = 'jerk_primed';
          }
          
          if (strongBumpDetection) {
            console.log(`🎯 Strong bump detected: mag=${magnitude.toFixed(2)}, jerk=${jerk.toFixed(1)}`);
          } else if (sharpTapDetection) {
            console.log(`🎯 Sharp tap detected: mag=${magnitude.toFixed(2)}, jerk=${jerk.toFixed(1)}`);
          } else if (magnitudePrimedDetection) {
            console.log(`🎯 Magnitude-primed detection: jerk=${jerk.toFixed(1)} ≥ ${SEQUENTIAL_DETECTION.magnitudePrime.jerk}`);
          } else if (jerkPrimedDetection) {
            console.log(`🎯 Jerk-primed detection: mag=${magnitude.toFixed(2)} ≥ ${SEQUENTIAL_DETECTION.jerkPrime.magnitude}`);
          }
          
          resolved = true;
          clearInterval(cancellationInterval);
          window.removeEventListener('devicemotion', handleMotion);
          resolve({
            hasMotion: true,
            acceleration: {
              x: accel.x,
              y: accel.y,
              z: accel.z
            },
            magnitude,
            timestamp: now
          });
        }
        
        // Store for next jerk calculation
        previousMagnitude = magnitude;
        previousTimestamp = now;
      };

      // Check for cancellation periodically
      const checkCancellation = () => {
        if (this.isCancelled && !resolved) {
          // Log timeout debugging info
          console.log(`⏰ Motion detection timeout after ${motionEventCount} events`);
          
          // Show peak events to help debug why detection didn't trigger
          if (peakMagnitudeEvent) {
            console.log(`🔥 Peak magnitude: ${peakMagnitudeEvent.magnitude.toFixed(2)} (jerk: ${peakMagnitudeEvent.jerk.toFixed(1)})`);
          }
          
          if (peakJerkEvent && peakJerkEvent.eventNumber !== peakMagnitudeEvent?.eventNumber) {
            console.log(`⚡ Peak jerk: ${peakJerkEvent.jerk.toFixed(1)} (magnitude: ${peakJerkEvent.magnitude.toFixed(2)})`);
          }
          
          if (!peakMagnitudeEvent && !peakJerkEvent) {
            console.log(`📊 No significant motion detected`);
          }
          
          resolved = true;
          clearInterval(cancellationInterval);
          window.removeEventListener('devicemotion', handleMotion);
          resolve({
            hasMotion: false,
            magnitude: 0,
            timestamp: getServerNow()
          });
        }
      };

      // Check for cancellation every 100ms
      const cancellationInterval = setInterval(checkCancellation, 100);

      window.addEventListener('devicemotion', handleMotion);
    });
  }

  static async hashAcceleration(acceleration: { x: number; y: number; z: number }): Promise<string> {
    const vectorString = [
      Math.round(acceleration.x),
      Math.round(acceleration.y), 
      Math.round(acceleration.z)
    ].join(',');
    
    // Simple hash implementation without crypto dependency
    let hash = 0;
    for (let i = 0; i < vectorString.length; i++) {
      const char = vectorString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to hex string
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
