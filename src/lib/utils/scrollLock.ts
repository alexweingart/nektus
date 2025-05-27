'use client';

let scrollY = 0;
let isLocked = false;

export function setupScrollLock() {
  // Disable touch scrolling on the document
  const preventDefault = (e: TouchEvent) => {
    if (isLocked) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  };

  // More aggressive scroll prevention
  const preventDefaultForScrollKeys = (e: KeyboardEvent) => {
    if (isLocked) {
      const keys = { 37: 1, 38: 1, 39: 1, 40: 1 };
      if (keys[e.keyCode as keyof typeof keys]) {
        e.preventDefault();
        return false;
      }
    }
  };

  // Lock scrolling
  const lockScroll = () => {
    if (isLocked) return;
    
    isLocked = true;
    scrollY = window.scrollY;
    
    // Disable scroll on body
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    
    // Prevent iOS rubber banding
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';
    
    // Add touch event listeners
    document.addEventListener('touchmove', preventDefault, { passive: false });
    window.addEventListener('keydown', preventDefaultForScrollKeys, false);
  };

  // Unlock scrolling
  const unlockScroll = () => {
    if (!isLocked) return;
    
    isLocked = false;
    
    // Re-enable scroll on body
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.height = '';
    document.body.style.overscrollBehavior = '';
    document.documentElement.style.overscrollBehavior = '';
    
    // Restore scroll position
    window.scrollTo(0, scrollY);
    
    // Remove event listeners
    document.removeEventListener('touchmove', preventDefault);
    window.removeEventListener('keydown', preventDefaultForScrollKeys);
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
    setTimeout(unlockScroll, 100);
  };

  // Add event listeners
  document.addEventListener('focusin', handleFocusIn, true);
  document.addEventListener('focusout', handleFocusOut, true);
  
  // Handle page visibility changes
  const handleVisibilityChange = () => {
    if (document.hidden) {
      unlockScroll();
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Cleanup function
  return () => {
    unlockScroll();
    document.removeEventListener('focusin', handleFocusIn, true);
    document.removeEventListener('focusout', handleFocusOut, true);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
