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

// Standardized thresholds for all devices (no more iOS/Android differences)
const DEFAULT_MOTION_THRESHOLD = 10; // m/s² - use strong bump profile as default
const DEFAULT_JERK_THRESHOLD = 125;  // m/s³ - use strong bump profile as default
const MOTION_TIMEOUT = 10000; // 10 seconds
const SPIKE_DURATION_MS = 500; // Look for spikes within 500ms

// Adaptive threshold configuration (simplified since we standardized across devices)
const ADAPTIVE_THRESHOLD_CONFIG = {
  // Device-specific multipliers (removed - now standardized)
  deviceMultipliers: {
    iOS: {
      magnitude: 1.0, // Standardized - no device differences
      jerk: 1.0
    },
    Android: {
      magnitude: 1.0, // Standardized - no device differences
      jerk: 1.0
    },
    chromeOnIOS: {
      magnitude: 1.0, // Standardized - no device differences
      jerk: 1.0
    }
  },
  
  // Adaptive sensitivity based on recent motion levels
  adaptiveSensitivity: {
    enabled: true,
    baselinePeriod: 1000, // 1 second to establish baseline
    sensitivityIncrease: 0.15, // 15% increase in sensitivity if low motion detected
    maxSensitivityBoost: 0.3 // Maximum 30% boost
  }
};

// Motion pattern analysis configuration
const MOTION_PATTERN_CONFIG = {
  // Asymmetric bump detection
  asymmetricBump: {
    enabled: false, // Disabled to reduce sensitivity
    lowMotionThreshold: 0.6, // If motion is 60% below normal threshold
    patternWindow: 2000, // 2 seconds to analyze pattern
    minimumEvents: 15, // Need at least 15 events to analyze pattern
    variabilityThreshold: 0.3, // 30% variation in magnitude suggests asymmetric bump
    
    // Alternative detection criteria for low-motion scenarios
    alternativeDetection: {
      enabled: true,
      sustainedMotionThreshold: 0.7, // 70% of normal threshold
      sustainedDuration: 800, // 800ms of sustained motion
      peakToAverageRatio: 2.0 // Peak motion should be 2x average
    }
  },
  
  // Pattern-based detection for subtle bumps
  subtlePattern: {
    enabled: false, // Disabled to reduce sensitivity
    gradualIncreaseThreshold: 0.4, // 40% gradual increase in motion
    peakWindow: 300, // 300ms window for peak detection
    minimumPeakRatio: 1.5, // Peak should be 1.5x the recent average
    directionChangeThreshold: 0.8 // 80% threshold for direction changes
  }
};

export class MotionDetector {
  private static analyzeMotionPattern(
    recentMagnitudes: Array<{magnitude: number, timestamp: number}>,
    currentThresholds: {magnitude: number, jerk: number},
    browserInfo: any
  ): {detected: boolean, type: string, confidence: number, details: any} {
    if (!MOTION_PATTERN_CONFIG.asymmetricBump.enabled || recentMagnitudes.length < MOTION_PATTERN_CONFIG.asymmetricBump.minimumEvents) {
      return { detected: false, type: 'none', confidence: 0, details: {} };
    }

    const now = Date.now();
    const patternWindow = MOTION_PATTERN_CONFIG.asymmetricBump.patternWindow;
    const recentWindow = recentMagnitudes.filter(m => now - m.timestamp <= patternWindow);
    
    if (recentWindow.length < MOTION_PATTERN_CONFIG.asymmetricBump.minimumEvents) {
      return { detected: false, type: 'none', confidence: 0, details: {} };
    }

    const magnitudes = recentWindow.map(m => m.magnitude);
    const avgMagnitude = magnitudes.reduce((sum, m) => sum + m, 0) / magnitudes.length;
    const maxMagnitude = Math.max(...magnitudes);
    const minMagnitude = Math.min(...magnitudes);
    const stdDev = Math.sqrt(magnitudes.reduce((sum, m) => sum + Math.pow(m - avgMagnitude, 2), 0) / magnitudes.length);
    const variabilityCoeff = stdDev / avgMagnitude;

    // Check for asymmetric bump pattern
    const lowMotionThreshold = currentThresholds.magnitude * MOTION_PATTERN_CONFIG.asymmetricBump.lowMotionThreshold;
    const isLowMotionScenario = avgMagnitude < lowMotionThreshold;
    
    if (isLowMotionScenario && MOTION_PATTERN_CONFIG.asymmetricBump.alternativeDetection.enabled) {
      const sustainedThreshold = currentThresholds.magnitude * MOTION_PATTERN_CONFIG.asymmetricBump.alternativeDetection.sustainedMotionThreshold;
      const sustainedDuration = MOTION_PATTERN_CONFIG.asymmetricBump.alternativeDetection.sustainedDuration;
      const peakToAverageRatio = MOTION_PATTERN_CONFIG.asymmetricBump.alternativeDetection.peakToAverageRatio;
      
      // Check for sustained motion above threshold
      const sustainedEvents = recentWindow.filter(m => 
        m.magnitude >= sustainedThreshold && 
        now - m.timestamp <= sustainedDuration
      );
      
      const hasSustainedMotion = sustainedEvents.length >= 5; // At least 5 events (~83ms worth)
      const hasSignificantPeak = maxMagnitude >= avgMagnitude * peakToAverageRatio;
      
      if (hasSustainedMotion && hasSignificantPeak) {
        return {
          detected: true,
          type: 'asymmetric_sustained',
          confidence: 0.7 + (sustainedEvents.length / recentWindow.length) * 0.3,
          details: {
            avgMagnitude: avgMagnitude,
            maxMagnitude: maxMagnitude,
            sustainedEvents: sustainedEvents.length,
            sustainedRatio: sustainedEvents.length / recentWindow.length,
            peakToAverageRatio: maxMagnitude / avgMagnitude,
            thresholdUsed: sustainedThreshold
          }
        };
      }
    }

    // Check for high variability suggesting asymmetric bump
    if (variabilityCoeff > MOTION_PATTERN_CONFIG.asymmetricBump.variabilityThreshold) {
      const recentPeaks = magnitudes.filter(m => m > avgMagnitude * 1.5);
      const hasMultiplePeaks = recentPeaks.length >= 3;
      
      if (hasMultiplePeaks) {
        return {
          detected: true,
          type: 'asymmetric_variability',
          confidence: Math.min(0.9, 0.5 + variabilityCoeff),
          details: {
            avgMagnitude: avgMagnitude,
            maxMagnitude: maxMagnitude,
            variabilityCoeff: variabilityCoeff,
            peakCount: recentPeaks.length,
            peakRatio: recentPeaks.length / magnitudes.length
          }
        };
      }
    }

    // Check for subtle pattern detection
    if (MOTION_PATTERN_CONFIG.subtlePattern.enabled) {
      const gradualIncreaseThreshold = currentThresholds.magnitude * MOTION_PATTERN_CONFIG.subtlePattern.gradualIncreaseThreshold;
      const peakWindow = MOTION_PATTERN_CONFIG.subtlePattern.peakWindow;
      const recentPeakWindow = recentWindow.filter(m => now - m.timestamp <= peakWindow);
      
      if (recentPeakWindow.length >= 5) {
        const recentAvg = recentPeakWindow.reduce((sum, m) => sum + m.magnitude, 0) / recentPeakWindow.length;
        const recentMax = Math.max(...recentPeakWindow.map(m => m.magnitude));
        const peakRatio = recentMax / recentAvg;
        
        if (recentAvg > gradualIncreaseThreshold && peakRatio >= MOTION_PATTERN_CONFIG.subtlePattern.minimumPeakRatio) {
          return {
            detected: true,
            type: 'subtle_pattern',
            confidence: 0.6 + Math.min(0.4, (peakRatio - 1.0) * 0.2),
            details: {
              recentAvg: recentAvg,
              recentMax: recentMax,
              peakRatio: peakRatio,
              gradualIncreaseThreshold: gradualIncreaseThreshold,
              windowSize: recentPeakWindow.length
            }
          };
        }
      }
    }

    return { detected: false, type: 'none', confidence: 0, details: {} };
  }

  private static calculateAdaptiveThresholds(browserInfo: any, recentMagnitudes: Array<{magnitude: number, timestamp: number}>): {magnitude: number, jerk: number} {
    // Start with standardized base thresholds (same for all devices now)
    let baseMagnitudeThreshold = DEFAULT_MOTION_THRESHOLD;
    let baseJerkThreshold = DEFAULT_JERK_THRESHOLD;
    
    // Apply device-specific multipliers
    let deviceMultiplier = ADAPTIVE_THRESHOLD_CONFIG.deviceMultipliers.Android;
    if (browserInfo.isChromeOnIOS) {
      deviceMultiplier = ADAPTIVE_THRESHOLD_CONFIG.deviceMultipliers.chromeOnIOS;
    } else if (browserInfo.isIOS) {
      deviceMultiplier = ADAPTIVE_THRESHOLD_CONFIG.deviceMultipliers.iOS;
    }
    
    baseMagnitudeThreshold *= deviceMultiplier.magnitude;
    baseJerkThreshold *= deviceMultiplier.jerk;
    
    // Apply adaptive sensitivity if enabled
    if (ADAPTIVE_THRESHOLD_CONFIG.adaptiveSensitivity.enabled && recentMagnitudes.length > 0) {
      const now = Date.now();
      const baselinePeriod = ADAPTIVE_THRESHOLD_CONFIG.adaptiveSensitivity.baselinePeriod;
      const recentBaseline = recentMagnitudes.filter(m => now - m.timestamp <= baselinePeriod);
      
      if (recentBaseline.length > 5) { // Need enough data points
        const avgRecentMagnitude = recentBaseline.reduce((sum, m) => sum + m.magnitude, 0) / recentBaseline.length;
        const maxRecentMagnitude = Math.max(...recentBaseline.map(m => m.magnitude));
        
        // If recent motion is consistently low, increase sensitivity
        if (maxRecentMagnitude < baseMagnitudeThreshold * 0.7) {
          const sensitivityBoost = Math.min(
            ADAPTIVE_THRESHOLD_CONFIG.adaptiveSensitivity.sensitivityIncrease,
            ADAPTIVE_THRESHOLD_CONFIG.adaptiveSensitivity.maxSensitivityBoost
          );
          baseMagnitudeThreshold *= (1 - sensitivityBoost);
          baseJerkThreshold *= (1 - sensitivityBoost);
        }
      }
    }
    
    return {
      magnitude: baseMagnitudeThreshold,
      jerk: baseJerkThreshold
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
    
    // Log the detailed browser environment
    try {
      await fetch('/api/system/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          event: 'browser_detection',
          message: JSON.stringify(browserInfo, null, 2),
          timestamp: getServerNow() 
        })
      });
    } catch {}

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
        
        // Log to server for debugging
        try {
          await fetch('/api/system/ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              event: 'ios_safari_permission_request',
              message: 'Calling DeviceMotionEvent.requestPermission() on iOS Safari',
              timestamp: getServerNow() 
            })
          });
        } catch {}

        const permission = await (DeviceMotionEvent as any).requestPermission();
        console.log('📱 iOS Safari permission result:', permission);
        
        // Log result to server
        try {
          await fetch('/api/system/ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              event: 'ios_safari_permission_result',
              message: `Permission result: ${permission}`,
              timestamp: getServerNow() 
            })
          });
        } catch {}
        
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
        
        // Log error to server
        try {
          await fetch('/api/system/ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              event: 'ios_safari_permission_error',
              message: `Permission request failed: ${error}`,
              timestamp: getServerNow() 
            })
          });
        } catch {}
        
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
      
      // Log to server
      try {
        await fetch('/api/system/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            event: 'android_device',
            message: 'Android device - no permission required',
            timestamp: getServerNow() 
          })
        });
      } catch {}
      
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
    
          // Log device info and threshold to server for debugging
      try {
        await fetch('/api/system/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            event: 'motion_detection_start',
            message: `Starting motion detection - Device: ${browserInfo.isIOS ? 'iOS' : 'Other'}, Mag threshold: ${currentThresholds.magnitude.toFixed(1)} m/s², Jerk threshold: ${currentThresholds.jerk.toFixed(1)} m/s³`,
            deviceInfo: {
              isIOS: browserInfo.isIOS,
              thresholds: currentThresholds,
              userAgent: browserInfo.userAgent
            },
            timestamp: getServerNow() 
          })
        });
      } catch {}
      
      // Note: Permission should already be granted by the calling service
      console.log('✅ Starting motion detection...');
      console.log(`🎯 Dual threshold detection system:`);
      console.log(`   🥊 Strong Bump: magnitude≥${DETECTION_PROFILES.strongBump.magnitude} + jerk≥${DETECTION_PROFILES.strongBump.jerk}`);
      console.log(`   👆 Sharp Tap: magnitude≥${DETECTION_PROFILES.sharpTap.magnitude} + jerk≥${DETECTION_PROFILES.sharpTap.jerk}`);
      console.log(`🔄 Sequential detection system:`);
      console.log(`   📈 Magnitude Primed: magnitude≥${SEQUENTIAL_DETECTION.magnitudePrime.magnitude} → jerk≥${SEQUENTIAL_DETECTION.magnitudePrime.jerk}`);
      console.log(`   📊 Jerk Primed: jerk≥${SEQUENTIAL_DETECTION.jerkPrime.jerk} → magnitude≥${SEQUENTIAL_DETECTION.jerkPrime.magnitude}`);
      console.log(`   📱 Device: ${browserInfo.isIOS ? 'iOS' : browserInfo.isAndroid ? 'Android' : 'Other'} (standardized thresholds)`);
      console.log(`⏱️ Timeout: ${MOTION_TIMEOUT}ms`);

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
      
      // Sequential detection state tracking
      let magnitudePrimed = false;  // True if we've seen magnitude ≥ 5 in any previous event
      let jerkPrimed = false;       // True if we've seen jerk ≥ 100 in any previous event
      
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
        
        // Enhanced server logging: Log ALL motion events to server for comprehensive analysis
        // This will help identify patterns and optimize thresholds
        const motionData = {
          eventCount: motionEventCount,
          acceleration: { x: accel.x, y: accel.y, z: accel.z },
          magnitude: magnitude,
          jerk: jerk,
          timestamp: now,
          isIOS: browserInfo.isIOS,
          userAgent: browserInfo.userAgent,
          thresholds: {
            magnitude: currentThresholds.magnitude,
            jerk: currentThresholds.jerk
          },
          recentMagnitudes: recentMagnitudes,
          exceedsThresholds: {
            magnitude: magnitude >= currentThresholds.magnitude,
            jerk: jerk >= currentThresholds.jerk,
            both: magnitude >= currentThresholds.magnitude && jerk >= currentThresholds.jerk
          }
        };
        
        // Store motion event for analytics
        allMotionEvents.push({
          timestamp: now,
          magnitude: magnitude,
          jerk: jerk,
          acceleration: { x: accel.x, y: accel.y, z: accel.z },
          isIOS: browserInfo.isIOS,
          userAgent: browserInfo.userAgent,
          thresholds: {
            magnitude: currentThresholds.magnitude,
            jerk: currentThresholds.jerk,
            // Include dual threshold info
            strongBump: DETECTION_PROFILES.strongBump,
            sharpTap: DETECTION_PROFILES.sharpTap
          },
          exceedsThresholds: {
            magnitude: magnitude >= currentThresholds.magnitude,
            jerk: jerk >= currentThresholds.jerk,
            both: magnitude >= currentThresholds.magnitude && jerk >= currentThresholds.jerk,
            // Dual threshold detection results
            strongBump: magnitude >= DETECTION_PROFILES.strongBump.magnitude && jerk >= DETECTION_PROFILES.strongBump.jerk,
            sharpTap: magnitude >= DETECTION_PROFILES.sharpTap.magnitude && jerk >= DETECTION_PROFILES.sharpTap.jerk,
            either: (magnitude >= DETECTION_PROFILES.strongBump.magnitude && jerk >= DETECTION_PROFILES.strongBump.jerk) || 
                    (magnitude >= DETECTION_PROFILES.sharpTap.magnitude && jerk >= DETECTION_PROFILES.sharpTap.jerk),
            // Sequential detection results
            magnitudePrimed: magnitudePrimed && jerk >= SEQUENTIAL_DETECTION.magnitudePrime.jerk,
            jerkPrimed: jerkPrimed && magnitude >= SEQUENTIAL_DETECTION.jerkPrime.magnitude,
            sequential: (magnitudePrimed && jerk >= SEQUENTIAL_DETECTION.magnitudePrime.jerk) || 
                       (jerkPrimed && magnitude >= SEQUENTIAL_DETECTION.jerkPrime.magnitude)
          },
          // Sequential detection state
          sequentialState: {
            magnitudePrimed: magnitudePrimed,
            jerkPrimed: jerkPrimed,
            thresholds: SEQUENTIAL_DETECTION
          }
        });

        // Send to server (fire and forget to avoid blocking)
        fetch('/api/system/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            event: 'motion_event_detailed',
            message: `Motion event ${motionEventCount}: mag=${magnitude.toFixed(2)}, jerk=${jerk.toFixed(1)}, threshold_met=${motionData.exceedsThresholds.both}`,
            motionData: motionData,
            timestamp: now
          })
        }).catch(() => {}); // Ignore errors to avoid blocking motion detection
        
        // Update sequential detection state
        if (magnitude >= SEQUENTIAL_DETECTION.magnitudePrime.magnitude) {
          magnitudePrimed = true;
        }
        if (jerk >= SEQUENTIAL_DETECTION.jerkPrime.jerk) {
          jerkPrimed = true;
        }
        
        // Check for sequential detection: primed conditions from previous events
        const magnitudePrimedDetection = magnitudePrimed && jerk >= SEQUENTIAL_DETECTION.magnitudePrime.jerk;
        const jerkPrimedDetection = jerkPrimed && magnitude >= SEQUENTIAL_DETECTION.jerkPrime.magnitude;
        const sequentialDetection = magnitudePrimedDetection || jerkPrimedDetection;
        
        // Check for dual threshold detection: either profile can trigger
        const strongBumpDetection = magnitude >= DETECTION_PROFILES.strongBump.magnitude && jerk >= DETECTION_PROFILES.strongBump.jerk;
        const sharpTapDetection = magnitude >= DETECTION_PROFILES.sharpTap.magnitude && jerk >= DETECTION_PROFILES.sharpTap.jerk;
        const dualThresholdDetection = strongBumpDetection || sharpTapDetection;
        
        // Also check for motion patterns (asymmetric bumps, subtle patterns) - disabled for now
        const patternAnalysis = this.analyzeMotionPattern(recentMagnitudes, currentThresholds, browserInfo);
        
        if (dualThresholdDetection || sequentialDetection || patternAnalysis.detected) {
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
          } else {
            detectionType = patternAnalysis.type;
            confidence = patternAnalysis.confidence;
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
          } else {
            console.log(`   Pattern: ${patternAnalysis.type}, Details:`, patternAnalysis.details);
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
            patternAnalysis: patternAnalysis,
            recentMagnitudes: recentMagnitudes,
            maxMagnitude: recentMagnitudes.length > 0 ? Math.max(...recentMagnitudes.map(m => m.magnitude)) : magnitude,
            avgMagnitude: recentMagnitudes.length > 0 ? recentMagnitudes.reduce((sum, m) => sum + m.magnitude, 0) / recentMagnitudes.length : magnitude
          };
          
          // Send session summary to server
          fetch('/api/system/ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              event: 'motion_session_summary',
              message: `Motion detected successfully - ${motionEventCount} events, trigger_mag=${magnitude.toFixed(2)}, trigger_jerk=${jerk.toFixed(1)}`,
              sessionSummary: sessionSummary,
              timestamp: getServerNow()
            })
          }).catch(() => {});
          
          // Log successful motion detection to server for analytics (legacy)
          try {
            fetch('/api/system/ping', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                event: 'motion_detected',
                message: `Motion detected - Device: ${browserInfo.isIOS ? 'iOS' : 'Other'}, Magnitude: ${magnitude.toFixed(2)}, Jerk: ${jerk.toFixed(1)}`,
                              motionData: {
                isIOS: browserInfo.isIOS,
                magnitude: magnitude,
                jerk: jerk,
                magnitudeThreshold: currentThresholds.magnitude,
                jerkThreshold: currentThresholds.jerk,
                acceleration: { x: accel.x, y: accel.y, z: accel.z }
              },
                timestamp: getServerNow() 
              })
            });
          } catch {}
          
          // Send analytics data for successful detection
          sendSessionAnalytics('success', detectionType, confidence);
          
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

      // Helper function to send session data to analytics
      const sendSessionAnalytics = (outcome: 'success' | 'timeout' | 'error', detectionType?: string, confidence?: number) => {
        const sessionData = {
          sessionId: `motion-${sessionStartTime}-${Math.random().toString(36).substring(2, 8)}`,
          startTime: sessionStartTime,
          endTime: getServerNow(),
          outcome: outcome,
          detectionType: detectionType,
          confidence: confidence,
          totalEvents: motionEventCount,
          deviceInfo: browserInfo,
          events: allMotionEvents,
          summary: {
            maxMagnitude: allMotionEvents.length > 0 ? Math.max(...allMotionEvents.map(e => e.magnitude)) : 0,
            avgMagnitude: allMotionEvents.length > 0 ? allMotionEvents.reduce((sum, e) => sum + e.magnitude, 0) / allMotionEvents.length : 0,
            maxJerk: allMotionEvents.length > 0 ? Math.max(...allMotionEvents.map(e => e.jerk)) : 0,
            avgJerk: allMotionEvents.length > 0 ? allMotionEvents.reduce((sum, e) => sum + e.jerk, 0) / allMotionEvents.length : 0,
            thresholdMetEvents: allMotionEvents.filter(e => e.exceedsThresholds.both).length
          }
        };

        // Send to analytics endpoint (fire and forget)
        fetch('/api/debug/motion-analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sessionData)
        }).catch(() => {}); // Ignore errors to avoid blocking
      };

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
          
          // Send session summary to server
          fetch('/api/system/ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              event: 'motion_session_summary',
              message: `Motion detection session timed out - ${motionEventCount} events, max_mag=${sessionSummary.maxMagnitude.toFixed(2)}, avg_mag=${sessionSummary.avgMagnitude.toFixed(2)}`,
              sessionSummary: sessionSummary,
              timestamp: getServerNow()
            })
          }).catch(() => {});
          
          // Send analytics data for timeout
          sendSessionAnalytics('timeout');
          
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
