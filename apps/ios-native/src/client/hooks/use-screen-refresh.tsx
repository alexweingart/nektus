/**
 * useScreenRefresh - Centralized hook for pull-to-refresh functionality
 *
 * Provides consistent refresh state management for:
 * - FlatList-based screens (needs external refreshing state)
 * - ScrollView-based screens (for consistency)
 *
 * Features:
 * - Prevents duplicate refresh calls while refreshing
 * - Consistent error handling
 * - Works with RefreshControl prop directly
 */

import React, { useState, useCallback, useRef } from 'react';
import { RefreshControl, RefreshControlProps } from 'react-native';

interface UseScreenRefreshOptions {
  /** Async function to call when user pulls to refresh */
  onRefresh: () => Promise<void>;
  /** Minimum delay between refreshes in ms (default: 500) */
  debounceMs?: number;
  /** Tint color for the refresh indicator (default: brand green) */
  tintColor?: string;
}

interface UseScreenRefreshResult {
  /** Whether a refresh is currently in progress */
  isRefreshing: boolean;
  /** Handler to pass to FlatList/ScrollView refreshControl's onRefresh */
  handleRefresh: () => Promise<void>;
  /** Pre-configured RefreshControl component for direct use */
  refreshControl: React.ReactElement<RefreshControlProps>;
}

/**
 * Hook for consistent pull-to-refresh behavior across screens
 *
 * @example
 * // With FlatList
 * const { isRefreshing, handleRefresh } = useScreenRefresh({
 *   onRefresh: async () => {
 *     await loadContacts(true);
 *   }
 * });
 *
 * <FlatList
 *   refreshControl={
 *     <RefreshControl
 *       refreshing={isRefreshing}
 *       onRefresh={handleRefresh}
 *       tintColor="#22c55e"
 *     />
 *   }
 * />
 *
 * @example
 * // With pre-configured RefreshControl
 * const { refreshControl } = useScreenRefresh({
 *   onRefresh: async () => {
 *     await refreshProfile();
 *   }
 * });
 *
 * <ScrollView refreshControl={refreshControl}>
 */
export function useScreenRefresh({
  onRefresh,
  debounceMs = 500,
  tintColor = '#22c55e',
}: UseScreenRefreshOptions): UseScreenRefreshResult {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastRefreshTimeRef = useRef<number>(0);

  const handleRefresh = useCallback(async () => {
    // Prevent refresh if already refreshing
    if (isRefreshing) return;

    // Debounce rapid refresh attempts
    const now = Date.now();
    if (now - lastRefreshTimeRef.current < debounceMs) {
      return;
    }
    lastRefreshTimeRef.current = now;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('[useScreenRefresh] Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, debounceMs, isRefreshing]);

  const refreshControl = (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      tintColor={tintColor}
    />
  );

  return {
    isRefreshing,
    handleRefresh,
    refreshControl,
  };
}

export default useScreenRefresh;
