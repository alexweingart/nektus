import React, { useState, useCallback } from "react";
import { ScrollView, RefreshControl, ScrollViewProps } from "react-native";

interface PullToRefreshProps extends Omit<ScrollViewProps, "refreshControl"> {
  children: React.ReactNode;
  /** Called when user pulls to refresh */
  onRefresh: () => Promise<void> | void;
  /** Disable pull-to-refresh gesture */
  disabled?: boolean;
  /** Refresh indicator tint color (default: brand green) */
  tintColor?: string;
}

/**
 * PullToRefresh - wrapper component that adds pull-to-refresh functionality.
 * Matches web pattern: parent provides onRefresh callback.
 */
export function PullToRefresh({
  children,
  onRefresh,
  disabled = false,
  tintColor = "#22c55e", // Brand green
  ...scrollViewProps
}: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (disabled || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error("[PullToRefresh] Refresh failed:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, disabled, isRefreshing]);

  return (
    <ScrollView
      {...scrollViewProps}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={tintColor}
          enabled={!disabled}
        />
      }
    >
      {children}
    </ScrollView>
  );
}

export default PullToRefresh;
