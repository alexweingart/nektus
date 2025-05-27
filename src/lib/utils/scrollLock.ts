'use client';

let scrollY = 0;

export function setupScrollLock() {
  // Enable VirtualKeyboard API if available
  if ('virtualKeyboard' in navigator) {
    (navigator as any).virtualKeyboard.overlaysContent = true;
  }

  // Set up dynamic viewport height variable
  const setVh = () => {
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
  };
  setVh();
  window.addEventListener('resize', setVh);

  // Scroll lock for form inputs
  const handleFocusIn = (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (target.matches('input, textarea, [contenteditable]')) {
      scrollY = window.scrollY;
      Object.assign(document.body.style, {
        position: 'fixed',
        top: `-${scrollY}px`,
        width: '100%',
        overscrollBehavior: 'contain'
      });
    }
  };

  const handleFocusOut = () => {
    if (scrollY !== undefined) {
      const scrollY_ = scrollY;
      Object.assign(document.body.style, {
        position: '',
        top: '',
        width: '',
        overscrollBehavior: ''
      });
      window.scrollTo(0, scrollY_);
      scrollY = 0;
    }
  };

  // Add event listeners
  document.addEventListener('focusin', handleFocusIn);
  document.addEventListener('focusout', handleFocusOut);

  // Cleanup function
  return () => {
    document.removeEventListener('focusin', handleFocusIn);
    document.removeEventListener('focusout', handleFocusOut);
    window.removeEventListener('resize', setVh);
  };
}

// Initialize CSS custom property for vh units
if (typeof document !== 'undefined') {
  document.documentElement.style.setProperty('--vh', '1vh');
}
