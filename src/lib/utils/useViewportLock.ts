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
    
    // Apply viewport lock classes
    body.classList.add('viewport-locked');
    
    if (!enablePullToRefresh) {
      // Full body lock for welcome screen (no pull-to-refresh)
      body.classList.add('no-refresh');
    } else {
      // Container-based lock for authenticated view (preserve pull-to-refresh)
      body.classList.remove('no-refresh');
    }
    
    // Remove any conflicting classes
    body.classList.remove('allow-scroll');

    // Cleanup function
    return () => {
      body.classList.remove('viewport-locked', 'no-refresh');
    };
  }, [enablePullToRefresh]);
};
