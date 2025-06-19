import { MotionDetectionResult } from '@/types/contactExchange';

const MOTION_THRESHOLD = 15; // m/s² (higher threshold for actual impacts)
const MOTION_TIMEOUT = 10000; // 10 seconds
const SPIKE_DURATION_MS = 500; // Look for spikes within 500ms

export class MotionDetector {
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
      await fetch('/api/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          event: 'browser_detection',
          message: JSON.stringify(browserInfo, null, 2),
          timestamp: Date.now() 
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
          await fetch('/api/ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              event: 'ios_safari_permission_request',
              message: 'Calling DeviceMotionEvent.requestPermission() on iOS Safari',
              timestamp: Date.now() 
            })
          });
        } catch {}

        const permission = await (DeviceMotionEvent as any).requestPermission();
        console.log('📱 iOS Safari permission result:', permission);
        
        // Log result to server
        try {
          await fetch('/api/ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              event: 'ios_safari_permission_result',
              message: `Permission result: ${permission}`,
              timestamp: Date.now() 
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
          await fetch('/api/ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              event: 'ios_safari_permission_error',
              message: `Permission request failed: ${error}`,
              timestamp: Date.now() 
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
        await fetch('/api/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            event: 'android_device',
            message: 'Android device - no permission required',
            timestamp: Date.now() 
          })
        });
      } catch {}
      
      return { success: true };
    }
    
    // Fallback for other browsers
    console.log('❓ Unknown browser/device - attempting without permission');
    
    // Log to server
    try {
      await fetch('/api/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          event: 'unknown_device',
          message: 'Unknown device/browser - attempting motion detection',
          timestamp: Date.now() 
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

    // Note: Permission should already be granted by the calling service
    console.log('✅ Starting motion detection...');
    console.log(`🎯 Motion threshold: ${MOTION_THRESHOLD} m/s²`);
    console.log(`⏱️ Timeout: ${MOTION_TIMEOUT}ms`);

    return new Promise((resolve) => {
      let resolved = false;
      let motionEventCount = 0;
      let recentMagnitudes: Array<{magnitude: number, timestamp: number}> = [];
      
      const handleMotion = (event: DeviceMotionEvent) => {
        if (resolved) return;
        
        motionEventCount++;
        
        // Use acceleration WITHOUT gravity for better bump detection
        const accel = event.acceleration;
        
        if (!accel || accel.x === null || accel.y === null || accel.z === null) {
          if (motionEventCount <= 5) {
            console.log(`📊 Motion event ${motionEventCount}: no acceleration data (without gravity)`);
          }
          return;
        }

        const magnitude = Math.hypot(accel.x, accel.y, accel.z);
        const now = Date.now();
        
        // Keep track of recent magnitudes for spike detection
        recentMagnitudes.push({ magnitude, timestamp: now });
        recentMagnitudes = recentMagnitudes.filter(m => now - m.timestamp <= SPIKE_DURATION_MS);
        
        if (motionEventCount <= 5) {
          console.log(`📊 Motion event ${motionEventCount}: x=${accel.x.toFixed(2)}, y=${accel.y.toFixed(2)}, z=${accel.z.toFixed(2)}, magnitude=${magnitude.toFixed(2)} (no gravity)`);
        }
        
        // Check for impact: sudden spike in acceleration
        if (magnitude >= MOTION_THRESHOLD) {
          console.log(`🎯 IMPACT DETECTED! Magnitude: ${magnitude.toFixed(2)} >= ${MOTION_THRESHOLD} (without gravity)`);
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
            timestamp: now // Use the timestamp when motion was actually detected
          });
        }
      };

      const timeout = setTimeout(() => {
        if (!resolved) {
          console.log(`⏰ Motion detection timeout after ${MOTION_TIMEOUT}ms (${motionEventCount} events processed)`);
          resolved = true;
          window.removeEventListener('devicemotion', handleMotion);
          resolve({
            hasMotion: false,
            magnitude: 0,
            timestamp: Date.now() // Add timestamp for timeout case too
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
