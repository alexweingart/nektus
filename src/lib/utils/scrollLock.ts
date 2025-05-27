'use client';

let scrollY = 0;
let isLocked = false;
let isIOS = false;
let originalViewport = '';
let activeElement: HTMLElement | null = null;

// Detect iOS
if (typeof window !== 'undefined') {
  isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Store the current active element
const storeActiveElement = () => {
  if (document.activeElement?.matches('input, textarea, [contenteditable]')) {
    activeElement = document.activeElement as HTMLElement;
  }
};

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
    
    // For iOS, we'll use a different approach
    if (isIOS) {
      // Store original viewport content
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        originalViewport = viewport.getAttribute('content') || '';
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0, viewport-fit=cover, interactive-widget=resizes-content');
      }
      
      // Set body styles
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.bottom = '0';
      document.body.style.overflow = 'hidden';
      // Using bracket notation to avoid TypeScript errors with webkit-prefixed properties
      document.body.style['WebkitOverflowScrolling' as any] = 'touch';
      
      // Add a class to the body for iOS-specific styling
      document.body.classList.add('ios-keyboard-visible');
      
      // Add touch event listeners
      document.addEventListener('touchmove', preventDefault, { passive: false });
      
      // Focus the active element after a delay
      if (activeElement) {
        setTimeout(() => {
          activeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    } else {
      // Standard approach for other platforms
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.body.style.overscrollBehavior = 'none';
      document.documentElement.style.overscrollBehavior = 'none';
      document.addEventListener('touchmove', preventDefault, { passive: false });
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
      
      // Remove iOS class
      document.body.classList.remove('ios-keyboard-visible');
    }
    
    // Restore body styles
    const scrollY = Math.abs(parseInt(document.body.style.top || '0'));
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.bottom = '';
    document.body.style.overflow = '';
    // Using bracket notation to avoid TypeScript errors with webkit-prefixed properties
    document.body.style['WebkitOverflowScrolling' as any] = '';
    document.body.style.overscrollBehavior = '';
    document.documentElement.style.overscrollBehavior = '';
    
    // Remove event listeners
    document.removeEventListener('touchmove', preventDefault);
    
    // Restore scroll position after a short delay
    window.setTimeout(() => {
      window.scrollTo(0, scrollY);
    }, 0);
  };

  // Handle focus events
  const handleFocusIn = (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (target.matches('input, textarea, [contenteditable]')) {
      storeActiveElement();
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
  document.addEventListener('touchstart', storeActiveElement, true);
  
  // Handle page visibility changes
  const handleVisibilityChange = () => {
    if (document.hidden) {
      unlockScroll();
    } else {
      // Re-lock if we're still focused on an input
      if (document.activeElement?.matches('input, textarea, [contenteditable]')) {
        storeActiveElement();
        lockScroll();
      }
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('resize', storeScrollPosition);
  window.addEventListener('orientationchange', storeScrollPosition);

  // Initial check
  if (document.activeElement?.matches('input, textarea, [contenteditable]')) {
    storeActiveElement();
    lockScroll();
  }

  // Cleanup function
  return () => {
    unlockScroll();
    document.removeEventListener('focusin', handleFocusIn, true);
    document.removeEventListener('focusout', handleFocusOut, true);
    document.removeEventListener('touchstart', storeActiveElement, true);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('resize', storeScrollPosition);
    window.removeEventListener('orientationchange', storeScrollPosition);
  };
}
