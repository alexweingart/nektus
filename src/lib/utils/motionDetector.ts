import { MotionDetectionResult } from '@/types/contactExchange';
import { getServerNow } from './clockSync';

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

// Motion detection configuration
const MOTION_TIMEOUT = 15000; // 15 seconds (longer than exchange timeout to avoid conflicts)
const SPIKE_DURATION_MS = 500; // Look for spikes within 500ms

export class MotionDetector {
  // Persistent sequential detection state across multiple motion detections
  private static sequentialState = {
    magnitudePrimed: false,
    jerkPrimed: false,
    sessionStartTime: 0,
    lastResetTime: 0
  };

  /**
   * Reset sequential detection state for a new exchange session
   */
  static resetSequentialState(): void {
    this.sequentialState = {
      magnitudePrimed: false,
      jerkPrimed: false,
      sessionStartTime: Date.now(),
      lastResetTime: Date.now()
    };
    console.log('🔄 Sequential detection state reset for new session');
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

    console.log('🔍 Browser Info:', browserInfo);

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
        console.log('📱 iOS Safari detected - requesting motion permission...');
        
        const permission = await (DeviceMotionEvent as any).requestPermission();
        console.log('📱 iOS Safari permission result:', permission);
        
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
      console.log('🤖 Android detected - motion should work without permission');
      
      // Simplified logging
      
      return { success: true };
    }
    
    // Fallback for other browsers
    console.log('❓ Unknown browser/device - attempting without permission');
    
    // Log to server
    try {
      await fetch('/api/system/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          event: 'unknown_device',
          message: 'Unknown device/browser - attempting motion detection',
          timestamp: getServerNow() 
        })
      });
    } catch {}
    
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

    // Determine the appropriate threshold based on device (initial)
    const browserInfo = this.getBrowserInfo();
    let currentThresholds = this.calculateAdaptiveThresholds(browserInfo, []);
    
      // Simplified logging
      
      // Note: Permission should already be granted by the calling service
      console.log('✅ Starting motion detection...');
      console.log(`🎯 Dual threshold detection system:`);
      console.log(`   🥊 Strong Bump: magnitude≥${DETECTION_PROFILES.strongBump.magnitude} + jerk≥${DETECTION_PROFILES.strongBump.jerk}`);
      console.log(`   👆 Sharp Tap: magnitude≥${DETECTION_PROFILES.sharpTap.magnitude} + jerk≥${DETECTION_PROFILES.sharpTap.jerk}`);
      console.log(`🔄 Sequential detection system (persistent across hits):`);
      console.log(`   📈 Magnitude Primed: magnitude≥${SEQUENTIAL_DETECTION.magnitudePrime.magnitude} → jerk≥${SEQUENTIAL_DETECTION.magnitudePrime.jerk}`);
      console.log(`   📊 Jerk Primed: jerk≥${SEQUENTIAL_DETECTION.jerkPrime.jerk} → magnitude≥${SEQUENTIAL_DETECTION.jerkPrime.magnitude}`);
      console.log(`   🔄 Current state: magnitudePrimed=${this.sequentialState.magnitudePrimed}, jerkPrimed=${this.sequentialState.jerkPrimed}`);
      console.log(`   📱 Device: ${browserInfo.isIOS ? 'iOS' : browserInfo.isAndroid ? 'Android' : 'Other'} (standardized thresholds)`);
      console.log(`⏱️ Motion detector timeout: ${MOTION_TIMEOUT}ms (controlled by exchange service timeout)`);

    return new Promise((resolve) => {
      let resolved = false;
      let motionEventCount = 0;
      let recentMagnitudes: Array<{magnitude: number, timestamp: number}> = [];
      let previousMagnitude = 0;
      let previousTimestamp = 0;
      let allMotionEvents: any[] = []; // Store all motion events for analytics
      const sessionStartTime = getServerNow();
      
      // Track peak events for debugging timeouts
      let peakMagnitudeEvent: any = null;
      let peakJerkEvent: any = null;
      
      // Use persistent sequential detection state (maintains across multiple detectMotion calls)
      let magnitudePrimed = this.sequentialState.magnitudePrimed;
      let jerkPrimed = this.sequentialState.jerkPrimed;
      
      const handleMotion = (event: DeviceMotionEvent) => {
        if (resolved) return;
        
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
        
        // Track peak events for timeout debugging
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
        
        // Simplified logging - just track basic motion events for timeout debugging
        allMotionEvents.push({
          timestamp: now,
          magnitude: magnitude,
          jerk: jerk,
          acceleration: { x: accel.x, y: accel.y, z: accel.z }
        });
        
        // Update sequential detection state (both local and persistent)
        if (magnitude >= SEQUENTIAL_DETECTION.magnitudePrime.magnitude) {
          magnitudePrimed = true;
          this.sequentialState.magnitudePrimed = true;
        }
        if (jerk >= SEQUENTIAL_DETECTION.jerkPrime.jerk) {
          jerkPrimed = true;
          this.sequentialState.jerkPrimed = true;
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
          
          console.log(`🎯 MOTION DETECTED! Type: ${detectionType}, Confidence: ${(confidence * 100).toFixed(1)}%`);
          if (strongBumpDetection) {
            console.log(`   Strong Bump: Magnitude: ${magnitude.toFixed(2)} >= ${DETECTION_PROFILES.strongBump.magnitude}, Jerk: ${jerk.toFixed(1)} >= ${DETECTION_PROFILES.strongBump.jerk}`);
          } else if (sharpTapDetection) {
            console.log(`   Sharp Tap: Magnitude: ${magnitude.toFixed(2)} >= ${DETECTION_PROFILES.sharpTap.magnitude}, Jerk: ${jerk.toFixed(1)} >= ${DETECTION_PROFILES.sharpTap.jerk}`);
          } else if (magnitudePrimedDetection) {
            console.log(`   Magnitude Primed: Previous magnitude ≥ ${SEQUENTIAL_DETECTION.magnitudePrime.magnitude}, Current jerk: ${jerk.toFixed(1)} >= ${SEQUENTIAL_DETECTION.magnitudePrime.jerk}`);
          } else if (jerkPrimedDetection) {
            console.log(`   Jerk Primed: Previous jerk ≥ ${SEQUENTIAL_DETECTION.jerkPrime.jerk}, Current magnitude: ${magnitude.toFixed(2)} >= ${SEQUENTIAL_DETECTION.jerkPrime.magnitude}`);
          }
          
          // Log comprehensive session summary on successful detection
          const sessionSummary = {
            outcome: 'success',
            detectionType: detectionType,
            confidence: confidence,
            totalEvents: motionEventCount,
            duration: now - (now - (motionEventCount * 16.67)), // Approximate duration based on 60fps
            deviceInfo: browserInfo,
            thresholds: {
              magnitude: currentThresholds.magnitude,
              jerk: currentThresholds.jerk
            },
            triggerEvent: {
              magnitude: magnitude,
              jerk: jerk,
              acceleration: { x: accel.x, y: accel.y, z: accel.z }
            },
            recentMagnitudes: recentMagnitudes,
            maxMagnitude: recentMagnitudes.length > 0 ? Math.max(...recentMagnitudes.map(m => m.magnitude)) : magnitude,
            avgMagnitude: recentMagnitudes.length > 0 ? recentMagnitudes.reduce((sum, m) => sum + m.magnitude, 0) / recentMagnitudes.length : magnitude
          };
          
          // Simplified logging - just console output for successful detection
          console.log(`✅ Motion detected successfully - ${motionEventCount} events, trigger_mag=${magnitude.toFixed(2)}, trigger_jerk=${jerk.toFixed(1)}`);
          
          resolved = true;
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

      // Analytics removed - was sending to debug endpoint

      const timeout = setTimeout(() => {
        if (!resolved) {
          console.log(`⏰ Motion detection timeout after ${MOTION_TIMEOUT}ms (${motionEventCount} events processed)`);
          
          // Show peak events to help debug why detection didn't trigger
          if (peakMagnitudeEvent) {
            console.log(`🔥 PEAK MAGNITUDE EVENT #${peakMagnitudeEvent.eventNumber}:`);
            console.log(`   Magnitude: ${peakMagnitudeEvent.magnitude.toFixed(2)}, Jerk: ${peakMagnitudeEvent.jerk.toFixed(1)}`);
            console.log(`   Acceleration: x=${peakMagnitudeEvent.acceleration.x.toFixed(2)}, y=${peakMagnitudeEvent.acceleration.y.toFixed(2)}, z=${peakMagnitudeEvent.acceleration.z.toFixed(2)}`);
            console.log(`   🥊 Strong Bump (mag≥10 + jerk≥125): ${peakMagnitudeEvent.metStrongBump ? '✅ YES' : '❌ NO'}`);
            console.log(`   👆 Sharp Tap (mag≥5 + jerk≥250): ${peakMagnitudeEvent.metSharpTap ? '✅ YES' : '❌ NO'}`);
            console.log(`   🎯 Either Profile Met: ${peakMagnitudeEvent.metEitherProfile ? '✅ YES' : '❌ NO'}`);
          }
          
          if (peakJerkEvent && peakJerkEvent.eventNumber !== peakMagnitudeEvent?.eventNumber) {
            console.log(`⚡ PEAK JERK EVENT #${peakJerkEvent.eventNumber}:`);
            console.log(`   Jerk: ${peakJerkEvent.jerk.toFixed(1)}, Magnitude: ${peakJerkEvent.magnitude.toFixed(2)}`);
            console.log(`   Acceleration: x=${peakJerkEvent.acceleration.x.toFixed(2)}, y=${peakJerkEvent.acceleration.y.toFixed(2)}, z=${peakJerkEvent.acceleration.z.toFixed(2)}`);
            console.log(`   🥊 Strong Bump (mag≥10 + jerk≥125): ${peakJerkEvent.metStrongBump ? '✅ YES' : '❌ NO'}`);
            console.log(`   👆 Sharp Tap (mag≥5 + jerk≥250): ${peakJerkEvent.metSharpTap ? '✅ YES' : '❌ NO'}`);
            console.log(`   🎯 Either Profile Met: ${peakJerkEvent.metEitherProfile ? '✅ YES' : '❌ NO'}`);
          }
          
          if (!peakMagnitudeEvent && !peakJerkEvent) {
            console.log(`📊 No significant motion detected - all events were very low magnitude/jerk`);
          }
          
          // Log comprehensive session summary on timeout
          const sessionSummary = {
            outcome: 'timeout',
            totalEvents: motionEventCount,
            duration: MOTION_TIMEOUT,
            deviceInfo: browserInfo,
            thresholds: {
              magnitude: currentThresholds.magnitude,
              jerk: currentThresholds.jerk
            },
            peakMagnitudeEvent: peakMagnitudeEvent,
            peakJerkEvent: peakJerkEvent,
            recentMagnitudes: recentMagnitudes,
            maxMagnitude: recentMagnitudes.length > 0 ? Math.max(...recentMagnitudes.map(m => m.magnitude)) : 0,
            avgMagnitude: recentMagnitudes.length > 0 ? recentMagnitudes.reduce((sum, m) => sum + m.magnitude, 0) / recentMagnitudes.length : 0
          };
          
          // Simplified logging for timeout
          console.log(`⏰ Motion detection session timed out - ${motionEventCount} events, max_mag=${sessionSummary.maxMagnitude.toFixed(2)}, avg_mag=${sessionSummary.avgMagnitude.toFixed(2)}`);
          
          resolved = true;
          window.removeEventListener('devicemotion', handleMotion);
          resolve({
            hasMotion: false,
            magnitude: 0,
            timestamp: getServerNow() // Add timestamp for timeout case too
          });
        }
      }, MOTION_TIMEOUT);

      window.addEventListener('devicemotion', handleMotion);
      console.log('👂 Started listening for devicemotion events...');
      
      // Cleanup function is handled by the timeout
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
