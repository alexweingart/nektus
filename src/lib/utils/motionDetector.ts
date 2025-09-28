import { MotionDetectionResult } from '@/types/contactExchange';
import { getServerNow } from '../services/client/clockSyncService';

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
  // If magnitude 5 is hit in any previous event, jerk 100 in future event triggers
  magnitudePrime: {
    magnitude: 5,    // m/s² - threshold to enter "magnitude primed" state
    jerk: 100        // m/s³ - jerk threshold when magnitude primed
  },
  // If magnitude 10 is hit in any previous event, jerk 100 in future event triggers
  strongMagnitudePrime: {
    magnitude: 10,   // m/s² - threshold to enter "strong magnitude primed" state
    jerk: 100        // m/s³ - jerk threshold when strong magnitude primed
  },
  // If jerk 100 is hit in any previous event, magnitude 10 in future event triggers
  jerkPrime: {
    jerk: 100,       // m/s³ - threshold to enter "jerk primed" state
    magnitude: 10    // m/s² - magnitude threshold when jerk primed
  },
  // If jerk 200 is hit in any previous event, magnitude 5 in future event triggers
  strongJerkPrime: {
    jerk: 200,       // m/s³ - threshold to enter "strong jerk primed" state
    magnitude: 5     // m/s² - magnitude threshold when strong jerk primed
  }
};


export class MotionDetector {
  // Persistent sequential detection state - now properly managed per session
  private static sequentialState = {
    magnitudePrimed: false,
    strongMagnitudePrimed: false,
    jerkPrimed: false,
    strongJerkPrimed: false,
    sessionStartTime: 0,
    lastResetTime: 0
  };

  // External cancellation control
  private static isCancelled = false;

  /**
   * Start a new motion detection session - clears priming state and prepares for detection
   */
  static startNewSession(): void {
    const isIOS = this.isIOSDevice();

    // Log current state before reset
    const beforeState = {
      magnitudePrimed: this.sequentialState.magnitudePrimed,
      strongMagnitudePrimed: this.sequentialState.strongMagnitudePrimed,
      jerkPrimed: this.sequentialState.jerkPrimed,
      strongJerkPrimed: this.sequentialState.strongJerkPrimed
    };

    const msg = `startNewSession() called - Before: mag=${beforeState.magnitudePrimed}, strongMag=${beforeState.strongMagnitudePrimed}, jerk=${beforeState.jerkPrimed}, strongJerk=${beforeState.strongJerkPrimed}`;
    console.log(`🔄 ${msg}`);

    // Send to remote logs
    fetch('/api/debug/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'session_start',
        message: msg,
        timestamp: new Date().toISOString()
      })
    }).catch(() => {});

    // Force complete state reset - iOS Safari can persist static state across browser contexts
    this.sequentialState = {
      magnitudePrimed: false,
      strongMagnitudePrimed: false,
      jerkPrimed: false,
      strongJerkPrimed: false,
      sessionStartTime: Date.now(),
      lastResetTime: Date.now()
    };
    this.isCancelled = false;
    
    // Additional iOS-specific state cleanup with multiple strategies
    if (isIOS) {
      const hasAnyPrimedState = this.sequentialState.magnitudePrimed || 
                               this.sequentialState.strongMagnitudePrimed || 
                               this.sequentialState.jerkPrimed || 
                               this.sequentialState.strongJerkPrimed;

      // Strategy 1: Force garbage collection of any lingering state references
      this.sequentialState = Object.assign({}, this.sequentialState);
      
      // Strategy 2: Explicit property overwrite to combat persistent references
      this.sequentialState.magnitudePrimed = false;
      this.sequentialState.strongMagnitudePrimed = false; 
      this.sequentialState.jerkPrimed = false;
      this.sequentialState.strongJerkPrimed = false;
      
      // Strategy 3: Force a new object reference
      const cleanState = {
        magnitudePrimed: false,
        strongMagnitudePrimed: false,
        jerkPrimed: false,
        strongJerkPrimed: false,
        sessionStartTime: Date.now(),
        lastResetTime: Date.now()
      };
      this.sequentialState = cleanState;
      
      // Strategy 4: Nuclear option for persistent state - delete and recreate
      if (hasAnyPrimedState) {
        delete (this as unknown as { sequentialState?: typeof MotionDetector.sequentialState }).sequentialState;
        this.sequentialState = cleanState;
        console.log('🍎 iOS: Nuclear state reset applied due to persistent state');
      }
      
      console.log('🍎 iOS-specific aggressive state cleanup applied');
    }

    // Log state after reset
    const afterMsg = `After reset: mag=${this.sequentialState.magnitudePrimed}, strongMag=${this.sequentialState.strongMagnitudePrimed}, jerk=${this.sequentialState.jerkPrimed}, strongJerk=${this.sequentialState.strongJerkPrimed}`;
    console.log(`✅ ${afterMsg}`);

    // Send to remote logs
    fetch('/api/debug/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'session_reset',
        message: afterMsg,
        timestamp: new Date().toISOString()
      })
    }).catch(() => {});
  }

  // Track active motion listener for proper cleanup
  private static activeMotionListener: ((event: DeviceMotionEvent) => void) | null = null;

  /**
   * End session - cancels detection and clears all state
   */
  static endSession(): void {
    this.isCancelled = true;
    
    // Immediately remove active motion listener to prevent race conditions
    if (this.activeMotionListener && typeof window !== 'undefined') {
      window.removeEventListener('devicemotion', this.activeMotionListener);
      this.activeMotionListener = null;
      console.log('🧹 Immediately removed motion listener');
    }
    
    this.sequentialState = {
      magnitudePrimed: false,
      strongMagnitudePrimed: false,
      jerkPrimed: false,
      strongJerkPrimed: false,
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

  /**
   * Check if current device is iOS
   */
  private static isIOSDevice(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  /**
   * Clean up motion listener and clear references
   */
  private static cleanupMotionListener(handler: (event: DeviceMotionEvent) => void): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('devicemotion', handler);
    }
    this.activeMotionListener = null;
  }

  /**
   * Log the specific type of motion detection that occurred
   */
  private static logDetectionResult(
    strongBumpDetection: boolean,
    strongTapDetection: boolean, 
    magnitudePrimedDetection: boolean,
    strongMagnitudePrimedDetection: boolean,
    jerkPrimedDetection: boolean,
    strongJerkPrimedDetection: boolean,
    magnitude: number,
    jerk: number
  ): void {
    if (strongBumpDetection) {
      console.log(`🎯 Strong bump detected: mag=${magnitude.toFixed(2)}, jerk=${jerk.toFixed(1)}`);
    } else if (strongTapDetection) {
      console.log(`🎯 Strong tap detected: mag=${magnitude.toFixed(2)}, jerk=${jerk.toFixed(1)}`);
    } else if (magnitudePrimedDetection) {
      console.log(`🎯 Magnitude-primed detection: jerk=${jerk.toFixed(1)} ≥ ${SEQUENTIAL_DETECTION.magnitudePrime.jerk}`);
    } else if (strongMagnitudePrimedDetection) {
      console.log(`🎯 Strong magnitude-primed detection: jerk=${jerk.toFixed(1)} ≥ ${SEQUENTIAL_DETECTION.strongMagnitudePrime.jerk}`);
    } else if (jerkPrimedDetection) {
      console.log(`🎯 Jerk-primed detection: mag=${magnitude.toFixed(2)} ≥ ${SEQUENTIAL_DETECTION.jerkPrime.magnitude}`);
    } else if (strongJerkPrimedDetection) {
      console.log(`🎯 Strong jerk-primed detection: mag=${magnitude.toFixed(2)} ≥ ${SEQUENTIAL_DETECTION.strongJerkPrime.magnitude}`);
    }
  }



  private static getBrowserInfo() {
    const userAgent = navigator.userAgent;
    
    // Detect iOS (including Chrome on iOS)  
    const isIOS = this.isIOSDevice();
    
    // Detect Chrome on iOS (Chrome on iOS uses Safari's WebKit but identifies as Chrome)
    const isChromeOnIOS = isIOS && /CriOS/.test(userAgent);
    
    // Detect Safari on iOS or other iOS browsers that support motion (like Google app)
    const isSafariOnIOS = isIOS && !isChromeOnIOS && (/Safari/.test(userAgent) || 
                         (typeof DeviceMotionEvent !== 'undefined' && 
                          typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function'));
    
    // Detect desktop Safari
    const isDesktopSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent) && !isIOS;
    
    // Detect Android
    const isAndroid = /Android/.test(userAgent);
    
    // Detect Chrome on Android
    const isChromeOnAndroid = isAndroid && /Chrome/.test(userAgent);
    
    return {
      isIOS,
      isChromeOnIOS,
      isSafariOnIOS,
      isDesktopSafari,
      isAndroid,
      isChromeOnAndroid,
      hasRequestPermission: typeof DeviceMotionEvent !== 'undefined' && 
                           typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function'
    };
  }

  static async requestPermission(): Promise<{ success: boolean; message?: string }> {
    const browserInfo = this.getBrowserInfo();
    
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
        const permission = await (DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
        
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

    // Use strong bump profile as default thresholds (standardized across all devices)
    const browserInfo = this.getBrowserInfo();

    // Generate unique call ID to track overlapping calls
    const callId = Math.random().toString(36).substring(2, 8);

    // DEBUG: Log when detectMotion is called and current state
    const debugMsg = `detectMotion() called [${callId}] - Current state: mag=${this.sequentialState.magnitudePrimed}, strongMag=${this.sequentialState.strongMagnitudePrimed}, jerk=${this.sequentialState.jerkPrimed}, strongJerk=${this.sequentialState.strongJerkPrimed}`;
    console.log(`📱 ${debugMsg}`);

    // Send to remote debug logs
    fetch('/api/debug/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'motion_start',
        message: debugMsg,
        timestamp: new Date().toISOString()
      })
    }).catch(() => {});

    // CRITICAL FIX: Reset primed states for each detectMotion call
    // This prevents false positives from previous detectMotion calls in the same session
    this.sequentialState.magnitudePrimed = false;
    this.sequentialState.strongMagnitudePrimed = false;
    this.sequentialState.jerkPrimed = false;
    this.sequentialState.strongJerkPrimed = false;

    // Log the reset
    const resetMsg = `detectMotion() reset primed states to false [${callId}]`;
    console.log(`🔄 ${resetMsg}`);
    fetch('/api/debug/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'motion_reset',
        message: resetMsg,
        timestamp: new Date().toISOString()
      })
    }).catch(() => {});

    return new Promise((resolve) => {
      let resolved = false;
      let motionEventCount = 0;
      let previousMagnitude = 0;
      let previousTimestamp = 0;
      // Use persistent sequential detection state (maintains across multiple detectMotion calls within session)
      let magnitudePrimed = this.sequentialState.magnitudePrimed;
      let strongMagnitudePrimed = this.sequentialState.strongMagnitudePrimed;
      let jerkPrimed = this.sequentialState.jerkPrimed;
      let strongJerkPrimed = this.sequentialState.strongJerkPrimed;
      
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
        const eventTime = getServerNow(); // For jerk calculations and filtering

        // Calculate jerk (rate of change of acceleration)
        let jerk = 0;
        if (previousTimestamp > 0) {
          const deltaTime = (eventTime - previousTimestamp) / 1000; // Convert to seconds
          const deltaMagnitude = magnitude - previousMagnitude;
          jerk = Math.abs(deltaMagnitude / deltaTime); // m/s³
        }
        // Note: Using fixed thresholds (no adaptive recalculation needed)
        
        // Update sequential detection state (both local and persistent)
        if (magnitude >= SEQUENTIAL_DETECTION.magnitudePrime.magnitude && !magnitudePrimed) {
          magnitudePrimed = true;
          this.sequentialState.magnitudePrimed = true;
          const msg = `Magnitude primed: ${magnitude.toFixed(2)} ≥ ${SEQUENTIAL_DETECTION.magnitudePrime.magnitude} (eventCount=${motionEventCount})`;
          console.log(`📈 ${msg}`);
          fetch('/api/debug/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'motion_priming', message: msg, timestamp: new Date().toISOString() })
          }).catch(() => {});
        }
        if (magnitude >= SEQUENTIAL_DETECTION.strongMagnitudePrime.magnitude && !strongMagnitudePrimed) {
          strongMagnitudePrimed = true;
          this.sequentialState.strongMagnitudePrimed = true;
          const msg = `Strong magnitude primed: ${magnitude.toFixed(2)} ≥ ${SEQUENTIAL_DETECTION.strongMagnitudePrime.magnitude}`;
          console.log(`📈 ${msg}`);
          fetch('/api/debug/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'motion_priming', message: msg, timestamp: new Date().toISOString() })
          }).catch(() => {});
        }
        if (jerk >= SEQUENTIAL_DETECTION.jerkPrime.jerk && !jerkPrimed) {
          jerkPrimed = true;
          this.sequentialState.jerkPrimed = true;
          const msg = `Jerk primed: ${jerk.toFixed(1)} ≥ ${SEQUENTIAL_DETECTION.jerkPrime.jerk}`;
          console.log(`📊 ${msg}`);
          fetch('/api/debug/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'motion_priming', message: msg, timestamp: new Date().toISOString() })
          }).catch(() => {});
        }
        if (jerk >= SEQUENTIAL_DETECTION.strongJerkPrime.jerk && !strongJerkPrimed) {
          strongJerkPrimed = true;
          this.sequentialState.strongJerkPrimed = true;
          const msg = `Strong jerk primed: ${jerk.toFixed(1)} ≥ ${SEQUENTIAL_DETECTION.strongJerkPrime.jerk}`;
          console.log(`📊 ${msg}`);
          fetch('/api/debug/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'motion_priming', message: msg, timestamp: new Date().toISOString() })
          }).catch(() => {});
        }
        
        // Check for sequential detection: primed conditions from previous events
        const magnitudePrimedDetection = magnitudePrimed && jerk >= SEQUENTIAL_DETECTION.magnitudePrime.jerk;
        const strongMagnitudePrimedDetection = strongMagnitudePrimed && jerk >= SEQUENTIAL_DETECTION.strongMagnitudePrime.jerk;
        const jerkPrimedDetection = jerkPrimed && magnitude >= SEQUENTIAL_DETECTION.jerkPrime.magnitude;
        const strongJerkPrimedDetection = strongJerkPrimed && magnitude >= SEQUENTIAL_DETECTION.strongJerkPrime.magnitude;
        const sequentialDetection = magnitudePrimedDetection || strongMagnitudePrimedDetection || jerkPrimedDetection || strongJerkPrimedDetection;
        
        // Check for dual threshold detection: either profile can trigger
        const strongBumpDetection = magnitude >= DETECTION_PROFILES.strongBump.magnitude && jerk >= DETECTION_PROFILES.strongBump.jerk;
        const strongTapDetection = magnitude >= DETECTION_PROFILES.strongTap.magnitude && jerk >= DETECTION_PROFILES.strongTap.jerk;
        const dualThresholdDetection = strongBumpDetection || strongTapDetection;
        
        // Check for detection: dual threshold or sequential detection
        if (dualThresholdDetection || sequentialDetection) {
          // DEBUG: Log which specific detection triggered
          const debugMsg = `DETECTION TRIGGERED: mag=${magnitude.toFixed(3)}, jerk=${jerk.toFixed(1)} | Primed: mag=${magnitudePrimed}, strongMag=${strongMagnitudePrimed}, jerk=${jerkPrimed}, strongJerk=${strongJerkPrimed} | Types: bump=${strongBumpDetection}, tap=${strongTapDetection}, magPrimed=${magnitudePrimedDetection}, strongMagPrimed=${strongMagnitudePrimedDetection}, jerkPrimed=${jerkPrimedDetection}, strongJerkPrimed=${strongJerkPrimedDetection}`;

          console.log(`🔍 ${debugMsg}`);

          // Send to remote debug logs
          fetch('/api/debug/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'motion_detection',
              message: debugMsg,
              timestamp: new Date().toISOString()
            })
          }).catch(() => {});

          this.logDetectionResult(
            strongBumpDetection, strongTapDetection, magnitudePrimedDetection,
            strongMagnitudePrimedDetection, jerkPrimedDetection, strongJerkPrimedDetection,
            magnitude, jerk
          );
          
          resolved = true;
          clearInterval(cancellationInterval);
          this.cleanupMotionListener(handleMotion);
          
          // Capture fresh timestamp AFTER all motion detection processing completes
          const detectionCompleteTime = getServerNow();
          
          resolve({
            hasMotion: true,
            acceleration: {
              x: accel.x,
              y: accel.y,
              z: accel.z
            },
            magnitude,
            timestamp: detectionCompleteTime
          });
        }
        
        // Store for next jerk calculation
        previousMagnitude = magnitude;
        previousTimestamp = eventTime;
      };

      // Check for cancellation periodically
      const checkCancellation = () => {
        if (this.isCancelled && !resolved) {
          console.log(`⏰ Motion detection timeout after ${motionEventCount} events`);
          
          resolved = true;
          clearInterval(cancellationInterval);
          this.cleanupMotionListener(handleMotion);
          resolve({
            hasMotion: false,
            magnitude: 0,
            timestamp: getServerNow()
          });
        }
      };

      // Check for cancellation every 100ms
      const cancellationInterval = setInterval(checkCancellation, 100);

      // Store listener reference for synchronous cleanup
      this.activeMotionListener = handleMotion;
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
