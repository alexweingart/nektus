'use client';

let scrollY = 0;
let isLocked = false;
let isIOS = false;
let originalViewport = '';

// Detect iOS
if (typeof window !== 'undefined') {
  isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function setupScrollLock() {
  // Store the current scroll position
  const storeScrollPosition = () => {
    scrollY = window.scrollY;
  };

  // Disable touch scrolling on the document
  const preventDefault = (e: TouchEvent) => {
    if (isLocked) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  };

  // Lock scrolling
  const lockScroll = () => {
    if (isLocked) return;
    
    isLocked = true;
    storeScrollPosition();
    
    // For all platforms
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';
    
    // Add touch event listeners
    document.addEventListener('touchmove', preventDefault, { passive: false });
    
    // iOS specific fixes
    if (isIOS) {
      // Store original viewport content
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        originalViewport = viewport.getAttribute('content') || '';
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0, viewport-fit=cover');
      }
      
      // Add padding to the bottom of the body to account for the keyboard
      const keyboardHeight = Math.min(window.innerHeight * 0.4, 300); // Estimate keyboard height
      document.body.style.paddingBottom = `${keyboardHeight}px`;
      
      // Force scroll to top to prevent any shifting
      window.scrollTo(0, 0);
      
      // Add a class to the body for iOS-specific styling
      document.body.classList.add('ios-keyboard-visible');
    }
  };

  // Unlock scrolling
  const unlockScroll = () => {
    if (!isLocked) return;
    
    isLocked = false;
    
    // Remove iOS specific styles first
    if (isIOS) {
      // Restore original viewport settings
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport && originalViewport) {
        viewport.setAttribute('content', originalViewport);
      }
      
      // Remove padding and iOS class
      document.body.style.paddingBottom = '';
      document.body.classList.remove('ios-keyboard-visible');
    }
    
    // Restore body styles
    const scrollY = document.body.style.top;
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.height = '';
    document.body.style.overscrollBehavior = '';
    document.documentElement.style.overscrollBehavior = '';
    
    // Remove event listeners
    document.removeEventListener('touchmove', preventDefault);
    
    // Restore scroll position after a short delay
    window.setTimeout(() => {
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }, 0);
  };

  // Handle focus events
  const handleFocusIn = (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (target.matches('input, textarea, [contenteditable]')) {
      // Small delay to allow iOS to finish focusing
      setTimeout(lockScroll, 100);
    }
  };

  const handleFocusOut = () => {
    // Slightly longer delay to ensure the keyboard is fully dismissed
    setTimeout(unlockScroll, 300);
  };

  // Add event listeners
  document.addEventListener('focusin', handleFocusIn, true);
  document.addEventListener('focusout', handleFocusOut, true);
  
  // Handle page visibility changes
  const handleVisibilityChange = () => {
    if (document.hidden) {
      unlockScroll();
    } else {
      // Re-lock if we're still focused on an input
      const activeElement = document.activeElement;
      if (activeElement?.matches('input, textarea, [contenteditable]')) {
        lockScroll();
      }
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('resize', storeScrollPosition);
  window.addEventListener('orientationchange', storeScrollPosition);

  // Initial check
  const activeElement = document.activeElement;
  if (activeElement?.matches('input, textarea, [contenteditable]')) {
    lockScroll();
  }

  // Cleanup function
  return () => {
    unlockScroll();
    document.removeEventListener('focusin', handleFocusIn, true);
    document.removeEventListener('focusout', handleFocusOut, true);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('resize', storeScrollPosition);
    window.removeEventListener('orientationchange', storeScrollPosition);
  };
}
