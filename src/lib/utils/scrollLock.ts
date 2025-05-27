'use client';

let scrollY = 0;
let isLocked = false;
let isIOS = false;

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
    
    // iOS specific fixes
    if (isIOS) {
      // Add a fixed position container to prevent iOS from adjusting the viewport
      const scrollLockContainer = document.createElement('div');
      scrollLockContainer.id = 'ios-scroll-lock-container';
      scrollLockContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        -webkit-overflow-scrolling: touch;
      `;
      
      // Move the app content into the container
      const appContent = document.getElementById('__next');
      if (appContent) {
        document.body.insertBefore(scrollLockContainer, appContent);
        scrollLockContainer.appendChild(appContent);
      }
      
      // Prevent overscroll bounce
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.body.style.overscrollBehavior = 'none';
      document.documentElement.style.overscrollBehavior = 'none';
      
      // Add touch event listeners
      document.addEventListener('touchmove', preventDefault, { passive: false });
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
    
    // Handle iOS viewport resize when keyboard appears
    if (isIOS) {
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      }
    }
  };

  // Unlock scrolling
  const unlockScroll = () => {
    if (!isLocked) return;
    
    isLocked = false;
    
    // iOS specific cleanup
    if (isIOS) {
      // Restore the original DOM structure
      const scrollLockContainer = document.getElementById('ios-scroll-lock-container');
      if (scrollLockContainer) {
        const appContent = scrollLockContainer.firstElementChild;
        if (appContent) {
          document.body.insertBefore(appContent, scrollLockContainer);
          document.body.removeChild(scrollLockContainer);
        }
      }
      
      // Restore viewport settings
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0, interactive-widget=overlays-content');
      }
    }
    
    // Restore body styles
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
      window.scrollTo(0, scrollY);
    }, 0);
  };

  // Handle focus events
  const handleFocusIn = (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (target.matches('input, textarea, [contenteditable]')) {
      lockScroll();
    }
  };

  const handleFocusOut = () => {
    // Small delay to prevent race conditions
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
