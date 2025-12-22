'use client';

import { useEffect } from 'react';

/**
 * Sets CSS custom property for full screen height in iOS PWA
 * Uses window.outerHeight which gives the actual full screen (852px on iPhone 14)
 * instead of viewport height (793px) which excludes safe areas
 */
export function HeightDebugger() {
  useEffect(() => {
    const setFullScreenHeight = () => {
      // window.outerHeight gives the full screen including safe areas
      const fullHeight = window.outerHeight;
      const viewportHeight = window.innerHeight;

      // Calculate safe area insets (since env() returns 0px on iOS PWA in portrait)
      // Top inset = difference between outer and inner height
      const topInset = fullHeight - viewportHeight;

      // For bottom inset, check if we're in standalone mode (PWA)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      // On iPhone with home indicator, bottom safe area is typically 34px in portrait
      // We'll calculate it based on screen size if standalone
      const bottomInset = isStandalone ? 34 : 0;

      // Set CSS custom properties on root element
      document.documentElement.style.setProperty('--full-screen-height', `${fullHeight}px`);
      document.documentElement.style.setProperty('--safe-area-inset-top', `${topInset}px`);
      document.documentElement.style.setProperty('--safe-area-inset-bottom', `${bottomInset}px`);
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
