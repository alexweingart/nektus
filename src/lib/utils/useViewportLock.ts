import { useEffect } from 'react';

interface UseViewportLockOptions {
  enablePullToRefresh?: boolean;
}

/**
 * useViewportLock - Locks viewport elements in place while allowing native pull-to-refresh
 * 
 * This hook applies CSS classes to enable viewport locking with optional pull-to-refresh.
 * The browser's native pull-to-refresh will handle page refresh automatically.
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
      body.classList.add('no-refresh');
    } else {
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
