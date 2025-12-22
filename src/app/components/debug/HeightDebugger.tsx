'use client';

import { useEffect } from 'react';

/**
 * Sets CSS custom properties for safe areas and full screen height
 *
 * PLATFORM BEHAVIOR:
 * - iOS Safari: Uses native env(safe-area-inset-*) which works correctly
 * - iOS PWA: Native env() sometimes returns 0px, so we manually calculate
 * - Android/Desktop: Uses native env() values
 *
 * The key insight: window.outerHeight - window.innerHeight gives DIFFERENT
 * results in Safari (includes browser chrome) vs PWA (full screen only).
 * So we only override when necessary (PWA mode).
 */
export function HeightDebugger() {
  useEffect(() => {
    const setFullScreenHeight = () => {
      // Detect if we're in standalone PWA mode
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isIOSPWA = isStandalone && isIOS;

      // Full screen height calculation
      const fullHeight = window.outerHeight;
      const viewportHeight = window.innerHeight;

      // Always set full screen height (used by ParticleNetwork and backgrounds)
      document.documentElement.style.setProperty('--full-screen-height', `${fullHeight}px`);

      if (isIOSPWA) {
        // iOS PWA: Native env(safe-area-inset-*) often returns 0px, so we calculate manually

        // For top inset, check if native env() is working
        const testDiv = document.createElement('div');
        testDiv.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top);';
        document.body.appendChild(testDiv);
        const nativeTopInset = testDiv.offsetHeight;
        document.body.removeChild(testDiv);

        if (nativeTopInset === 0) {
          // Native env() is broken, calculate manually
          // In PWA mode, outerHeight - innerHeight approximates the top safe area
          // But we need to be more conservative to avoid false positives
          const calculatedTop = fullHeight - viewportHeight;

          // Only use calculated value if it's reasonable (between 20px and 60px)
          // This range covers iPhone notches (44px-59px) and older iOS status bars (20px)
          const topInset = (calculatedTop >= 20 && calculatedTop <= 60) ? calculatedTop : 44;

          document.documentElement.style.setProperty('--safe-area-inset-top', `${topInset}px`);
        } else {
          // Native env() is working, don't override
          document.documentElement.style.setProperty('--safe-area-inset-top', `${nativeTopInset}px`);
        }

        // Bottom safe area for home indicator
        const bottomInset = 34; // Standard home indicator height
        document.documentElement.style.setProperty('--safe-area-inset-bottom', `${bottomInset}px`);

      } else {
        // iOS Safari, Android, Desktop: Use native env() values
        // Don't override - the browser provides correct values
        // Remove any custom properties so native env() is used
        document.documentElement.style.removeProperty('--safe-area-inset-top');
        document.documentElement.style.removeProperty('--safe-area-inset-bottom');
      }
    };

    // Set immediately on mount
    setFullScreenHeight();

    // Update on resize (throttled to avoid performance issues)
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(setFullScreenHeight, 100);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, []);

  return null; // This component doesn't render anything
}
