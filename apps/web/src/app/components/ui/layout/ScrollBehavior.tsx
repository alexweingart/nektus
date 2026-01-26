'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Prevents upward overscroll (bounce up) but allows downward pull-to-refresh.
 * Only applies to pages that don't need scrolling.
 * Based on background-tester v3 approach.
 */
export function ScrollBehavior() {
  const pathname = usePathname();

  useEffect(() => {
    // Only apply scroll blocking on pages that don't need scrolling
    const nonScrollablePages = [
      '/setup',               // Setup page
    ];

    // Apply to contact detail pages (single-screen), but NOT scheduling pages (scrollable)
    const isContactPage = pathname?.startsWith('/c/') &&
                          !pathname?.includes('/ai-schedule') &&
                          !pathname?.includes('/smart-schedule');
    const isNonScrollablePage = nonScrollablePages.includes(pathname || '') || isContactPage;

    if (!isNonScrollablePage) {
      // Don't apply scroll blocking on scrollable pages
      return;
    }

    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;

      // If at top of page and trying to scroll up (negative delta), prevent
      if (window.scrollY === 0 && deltaY < 0) {
        e.preventDefault();
      }
      // If at top and pulling down (positive delta), allow (for refresh)
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, [pathname]);

  return null;
}
