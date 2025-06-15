import { useEffect } from 'react';

interface UseViewportLockOptions {
  enablePullToRefresh?: boolean;
}

/**
 * useViewportLock - Locks viewport elements in place while allowing native pull-to-refresh
 * 
 * Uses a container-based approach for pull-to-refresh scenarios to avoid interfering
 * with the browser's native pull-to-refresh mechanism.
 * 
 * @param options - Configuration options for viewport lock behavior
 */
export const useViewportLock = (options: UseViewportLockOptions = {}) => {
  const {
    enablePullToRefresh = true
  } = options;

  useEffect(() => {
    const body = document.body;
    if (enablePullToRefresh) {
      // Allow native body pull-to-refresh
      body.classList.add('allow-scroll');
      body.classList.remove('viewport-locked', 'no-refresh');
    } else {
      // Lock viewport container for internal scrolling (no body scroll)
      body.classList.add('viewport-locked', 'no-refresh');
      body.classList.remove('allow-scroll');
    }

    return () => {
      body.classList.remove('viewport-locked', 'no-refresh', 'allow-scroll');
    };
  }, [enablePullToRefresh]);
};
