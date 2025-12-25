import { MotionDetectionResult } from '@/types/contactExchange';

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
  // Sequential detection state - tracks priming across motion events
  // Lifecycle:
  //   - Reset by startNewSession() between exchanges
  //   - Reset by detectMotion() at start of each detection attempt
  //   - Updated during motion event processing to track priming
  //   - Reset by pageshow event on bfcache restoration (Safari back/forward)
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
    console.log('🔄 startNewSession() called');
    this.sequentialState = this.createCleanState();
    this.isCancelled = false;
    console.log('✅ Motion state reset complete');
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

    this.sequentialState = this.createCleanState();
    this.sequentialState.sessionStartTime = 0; // Mark as ended
    console.log('🧹 Motion session ended');
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
   * Log debug message to console and remote logs
   */
  private static logDebug(event: string, message: string): void {
    console.log(message);
    fetch('/api/debug/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, message, timestamp: new Date().toISOString() })
    }).catch(() => {});
  }

  /**
   * Create a clean state object with all priming flags set to false
   */
  private static createCleanState() {
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
    const detections = [
      [strongBumpDetection, `Strong bump detected: mag=${magnitude.toFixed(2)}, jerk=${jerk.toFixed(1)}`],
      [strongTapDetection, `Strong tap detected: mag=${magnitude.toFixed(2)}, jerk=${jerk.toFixed(1)}`],
      [magnitudePrimedDetection, `Magnitude-primed detection: jerk=${jerk.toFixed(1)} ≥ ${SEQUENTIAL_DETECTION.magnitudePrime.jerk}`],
      [strongMagnitudePrimedDetection, `Strong magnitude-primed detection: jerk=${jerk.toFixed(1)} ≥ ${SEQUENTIAL_DETECTION.strongMagnitudePrime.jerk}`],
      [jerkPrimedDetection, `Jerk-primed detection: mag=${magnitude.toFixed(2)} ≥ ${SEQUENTIAL_DETECTION.jerkPrime.magnitude}`],
      [strongJerkPrimedDetection, `Strong jerk-primed detection: mag=${magnitude.toFixed(2)} ≥ ${SEQUENTIAL_DETECTION.strongJerkPrime.magnitude}`]
    ] as const;

    const detected = detections.find(([condition]) => condition);
    if (detected) console.log(`🎯 ${detected[1]}`);
  }



  private static getBrowserInfo() {
    const userAgent = navigator.userAgent;
    const isIOS = this.isIOSDevice();
    const hasRequestPermission = typeof DeviceMotionEvent !== 'undefined' &&
      typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function';

    return {
      isIOS,
      isChromeOnIOS: isIOS && /CriOS/.test(userAgent),
      isSafariOnIOS: isIOS && !/CriOS/.test(userAgent) && (/Safari/.test(userAgent) || hasRequestPermission),
      isDesktopSafari: /Safari/.test(userAgent) && !/Chrome/.test(userAgent) && !isIOS,
      isAndroid: /Android/.test(userAgent),
      hasRequestPermission
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

    // Android and other browsers don't require permission
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

    // Generate unique call ID to track overlapping calls
    const callId = Math.random().toString(36).substring(2, 8);

    // DEBUG: Log when detectMotion is called and current state
    const debugMsg = `📱 detectMotion() called [${callId}] - Current state: mag=${this.sequentialState.magnitudePrimed}, strongMag=${this.sequentialState.strongMagnitudePrimed}, jerk=${this.sequentialState.jerkPrimed}, strongJerk=${this.sequentialState.strongJerkPrimed}`;
    this.logDebug('motion_start', debugMsg);

    // CRITICAL: Reset primed states at start of each detectMotion call
    // This is essential for the multi-hit loop in realTimeContactExchangeService
    // Without this, primed states from first hit contaminate subsequent hits causing false positives
    // Sequential detection still works within a single detectMotion call (across motion events)
    this.sequentialState.magnitudePrimed = false;
    this.sequentialState.strongMagnitudePrimed = false;
    this.sequentialState.jerkPrimed = false;
    this.sequentialState.strongJerkPrimed = false;

    // Log the reset
    this.logDebug('motion_reset', `🔄 detectMotion() reset primed states to false [${callId}]`);

    return new Promise((resolve) => {
      let resolved = false;
      let motionEventCount = 0;
      let previousMagnitude = 0;
      let previousTimestamp = 0;

      const handleMotion = (event: DeviceMotionEvent) => {
        if (resolved || this.isCancelled) return;

        motionEventCount++;

        // iOS Safari caches motion values. When a new listener is added, the first events
        // may contain stale data from the previous session. Skip them to avoid false positives.
        // This is an iOS Safari quirk - we cannot clear their internal motion cache.
        const WARMUP_EVENTS = MotionDetector.isIOSDevice() ? 3 : 0;

        if (motionEventCount <= WARMUP_EVENTS) {
          // Still update previous values so jerk calculation is correct after warmup
          const accel = event.acceleration ?? event.accelerationIncludingGravity;
          if (accel && accel.x !== null && accel.y !== null && accel.z !== null) {
            previousMagnitude = Math.hypot(accel.x, accel.y, accel.z);
            previousTimestamp = Date.now();
          }
          return; // Skip detection during warmup
        }

        // Prefer acceleration WITHOUT gravity, fall back to including gravity if null
        const accel = event.acceleration ?? event.accelerationIncludingGravity;
        
        if (!accel || accel.x === null || accel.y === null || accel.z === null) {
          if (motionEventCount <= 5) {
            console.log(`📊 Motion event ${motionEventCount}: no acceleration data`);
          }
          return;
        }

        const magnitude = Math.hypot(accel.x, accel.y, accel.z);
        const eventTime = Date.now(); // For jerk calculations and filtering

        // Calculate jerk (rate of change of acceleration)
        let jerk = 0;
        if (previousTimestamp > 0) {
          const deltaTime = (eventTime - previousTimestamp) / 1000; // Convert to seconds
          const deltaMagnitude = magnitude - previousMagnitude;
          jerk = Math.abs(deltaMagnitude / deltaTime); // m/s³
        }

        // Update sequential detection state
        if (magnitude >= SEQUENTIAL_DETECTION.magnitudePrime.magnitude && !this.sequentialState.magnitudePrimed) {
          this.sequentialState.magnitudePrimed = true;
          this.logDebug('motion_priming', `📈 Magnitude primed: ${magnitude.toFixed(2)} ≥ ${SEQUENTIAL_DETECTION.magnitudePrime.magnitude} (eventCount=${motionEventCount})`);
        }
        if (magnitude >= SEQUENTIAL_DETECTION.strongMagnitudePrime.magnitude && !this.sequentialState.strongMagnitudePrimed) {
          this.sequentialState.strongMagnitudePrimed = true;
          this.logDebug('motion_priming', `📈 Strong magnitude primed: ${magnitude.toFixed(2)} ≥ ${SEQUENTIAL_DETECTION.strongMagnitudePrime.magnitude}`);
        }
        if (jerk >= SEQUENTIAL_DETECTION.jerkPrime.jerk && !this.sequentialState.jerkPrimed) {
          this.sequentialState.jerkPrimed = true;
          this.logDebug('motion_priming', `📊 Jerk primed: ${jerk.toFixed(1)} ≥ ${SEQUENTIAL_DETECTION.jerkPrime.jerk}`);
        }
        if (jerk >= SEQUENTIAL_DETECTION.strongJerkPrime.jerk && !this.sequentialState.strongJerkPrimed) {
          this.sequentialState.strongJerkPrimed = true;
          this.logDebug('motion_priming', `📊 Strong jerk primed: ${jerk.toFixed(1)} ≥ ${SEQUENTIAL_DETECTION.strongJerkPrime.jerk}`);
        }
        
        // Check for sequential detection: primed conditions from previous events
        const magnitudePrimedDetection = this.sequentialState.magnitudePrimed && jerk >= SEQUENTIAL_DETECTION.magnitudePrime.jerk;
        const strongMagnitudePrimedDetection = this.sequentialState.strongMagnitudePrimed && jerk >= SEQUENTIAL_DETECTION.strongMagnitudePrime.jerk;
        const jerkPrimedDetection = this.sequentialState.jerkPrimed && magnitude >= SEQUENTIAL_DETECTION.jerkPrime.magnitude;
        const strongJerkPrimedDetection = this.sequentialState.strongJerkPrimed && magnitude >= SEQUENTIAL_DETECTION.strongJerkPrime.magnitude;
        const sequentialDetection = magnitudePrimedDetection || strongMagnitudePrimedDetection || jerkPrimedDetection || strongJerkPrimedDetection;
        
        // Check for dual threshold detection: either profile can trigger
        const strongBumpDetection = magnitude >= DETECTION_PROFILES.strongBump.magnitude && jerk >= DETECTION_PROFILES.strongBump.jerk;
        const strongTapDetection = magnitude >= DETECTION_PROFILES.strongTap.magnitude && jerk >= DETECTION_PROFILES.strongTap.jerk;
        const dualThresholdDetection = strongBumpDetection || strongTapDetection;
        
        // Check for detection: dual threshold or sequential detection
        if (dualThresholdDetection || sequentialDetection) {
          // DEBUG: Log which specific detection triggered
          const debugMsg = `🔍 DETECTION TRIGGERED: mag=${magnitude.toFixed(3)}, jerk=${jerk.toFixed(1)} | Primed: mag=${this.sequentialState.magnitudePrimed}, strongMag=${this.sequentialState.strongMagnitudePrimed}, jerk=${this.sequentialState.jerkPrimed}, strongJerk=${this.sequentialState.strongJerkPrimed} | Types: bump=${strongBumpDetection}, tap=${strongTapDetection}, magPrimed=${magnitudePrimedDetection}, strongMagPrimed=${strongMagnitudePrimedDetection}, jerkPrimed=${jerkPrimedDetection}, strongJerkPrimed=${strongJerkPrimedDetection}`;
          this.logDebug('motion_detection', debugMsg);

          this.logDetectionResult(
            strongBumpDetection, strongTapDetection, magnitudePrimedDetection,
            strongMagnitudePrimedDetection, jerkPrimedDetection, strongJerkPrimedDetection,
            magnitude, jerk
          );
          
          resolved = true;
          clearInterval(cancellationInterval);
          this.cleanupMotionListener(handleMotion);
          
          // Capture fresh timestamp AFTER all motion detection processing completes
          const detectionCompleteTime = Date.now();
          
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
            timestamp: Date.now()
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

// Handle Safari bfcache restoration - reset state when page restored from cache
// bfcache preserves the JavaScript heap including static variables, so we must reset on restoration
if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      // Page restored from bfcache - static variables preserved, must reset
      console.log('🔄 bfcache restoration detected - resetting motion state');
      MotionDetector.startNewSession();
    }
  });
}
