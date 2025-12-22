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

      // Set CSS custom property on root element
      document.documentElement.style.setProperty('--full-screen-height', `${fullHeight}px`);

      console.log('=== HEIGHT DEBUG ===');
      console.log('Full screen height set to:', fullHeight);
      console.log('window.screen.height:', window.screen.height);
      console.log('window.outerHeight:', window.outerHeight);
      console.log('window.innerHeight:', window.innerHeight);
      console.log('visualViewport.height:', window.visualViewport?.height);
      console.log('CSS variable --full-screen-height:',
        getComputedStyle(document.documentElement).getPropertyValue('--full-screen-height'));

      // Check safe area insets
      const computedStyle = getComputedStyle(document.documentElement);
      console.log('--- Safe Area Insets ---');
      console.log('safe-area-inset-top:', computedStyle.getPropertyValue('padding-top') ||
        getComputedStyle(document.body).paddingTop);
      console.log('safe-area-inset-bottom:', computedStyle.getPropertyValue('padding-bottom') ||
        getComputedStyle(document.body).paddingBottom);
      console.log('safe-area-inset-left:', computedStyle.getPropertyValue('padding-left') ||
        getComputedStyle(document.body).paddingLeft);
      console.log('safe-area-inset-right:', computedStyle.getPropertyValue('padding-right') ||
        getComputedStyle(document.body).paddingRight);

      // Also check body padding which uses env()
      console.log('--- Body Padding (uses env) ---');
      console.log('body.paddingTop:', getComputedStyle(document.body).paddingTop);
      console.log('body.paddingBottom:', getComputedStyle(document.body).paddingBottom);
      console.log('body.paddingLeft:', getComputedStyle(document.body).paddingLeft);
      console.log('body.paddingRight:', getComputedStyle(document.body).paddingRight);

      // Check ContactBackgroundOverlay dimensions
      const overlay = document.querySelector('.contact-background-overlay');
      if (overlay) {
        const overlayStyle = getComputedStyle(overlay);
        console.log('--- ContactBackgroundOverlay ---');
        console.log('height:', overlayStyle.height);
        console.log('marginTop:', overlayStyle.marginTop);
        console.log('marginBottom:', overlayStyle.marginBottom);
        console.log('top:', overlayStyle.top);
        console.log('bottom:', overlayStyle.bottom);
      }

      // Check canvas dimensions
      const canvas = document.querySelector('canvas');
      if (canvas) {
        console.log('--- Canvas ---');
        console.log('canvas.width:', canvas.width);
        console.log('canvas.height:', canvas.height);
        console.log('canvas computed height:', getComputedStyle(canvas).height);
      }
      console.log('==================');
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
