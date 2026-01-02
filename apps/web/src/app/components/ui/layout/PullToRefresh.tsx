'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void> | void;
  disabled?: boolean;
  /** Threshold in pixels to trigger refresh (default: 80) */
  threshold?: number;
  className?: string;
}

// Detect platform
function getPlatform(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'other';
}

// Detect if running as standalone PWA (not in browser)
function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;

  // Check for iOS standalone mode
  const isIOSStandalone = 'standalone' in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  // Check for display-mode: standalone (works on Android and other platforms)
  const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;

  // Check for display-mode: fullscreen
  const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;

  return isIOSStandalone || isDisplayStandalone || isFullscreen;
}

// iOS-style spinner (circular, gray, subtle)
function IOSSpinner({ progress, isRefreshing }: { progress: number; isRefreshing: boolean }) {
  const rotation = isRefreshing ? undefined : progress * 360;

  return (
    <div
      className="relative w-6 h-6"
      style={{
        transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
      }}
    >
      <svg
        className={`w-6 h-6 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="32 32"
          opacity={isRefreshing ? 1 : Math.min(1, progress)}
        />
      </svg>
    </div>
  );
}

// Android/Material-style spinner (circular, colored, bolder)
function AndroidSpinner({ progress, isRefreshing }: { progress: number; isRefreshing: boolean }) {
  return (
    <div className="relative w-7 h-7">
      <svg
        className={`w-7 h-7 text-green-500 ${isRefreshing ? 'animate-spin' : ''}`}
        viewBox="0 0 24 24"
        fill="none"
        style={{
          transform: isRefreshing ? undefined : `rotate(${progress * 360}deg)`,
        }}
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="28 28"
          opacity={isRefreshing ? 1 : Math.min(1, progress)}
        />
      </svg>
    </div>
  );
}

export function PullToRefresh({
  children,
  onRefresh,
  disabled = false,
  threshold = 80,
  className = '',
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPWA, setIsPWA] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');

  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);

  useEffect(() => {
    // Detect platform and PWA mode on client side
    setPlatform(getPlatform());
    setIsPWA(isStandalonePWA());
  }, []);

  // Only enable custom pull-to-refresh in PWA standalone mode
  // In regular browser, native pull-to-refresh handles it
  const isEnabled = isPWA && !disabled;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isEnabled || isRefreshing) return;

    // Only start pull if at top of scroll
    const container = containerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop || window.scrollY;
    if (scrollTop <= 0) {
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    }
  }, [isEnabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPullingRef.current || !isEnabled || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startYRef.current;

    // Only allow pulling down (positive delta)
    if (deltaY > 0) {
      // Apply resistance - pull distance is less than actual finger movement
      const resistance = 0.4;
      const distance = Math.min(deltaY * resistance, threshold * 1.5);
      setPullDistance(distance);
    } else {
      setPullDistance(0);
    }
  }, [isEnabled, isRefreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current || !isEnabled) return;

    isPullingRef.current = false;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold * 0.6); // Keep some distance while refreshing

      try {
        await onRefresh();
      } catch (error) {
        console.error('[PullToRefresh] Refresh failed:', error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, isRefreshing, onRefresh, isEnabled]);

  const progress = Math.min(1, pullDistance / threshold);
  const showSpinner = isEnabled && (pullDistance > 10 || isRefreshing);

  const Spinner = platform === 'ios' ? IOSSpinner : AndroidSpinner;

  // In browser mode (not PWA), just render children without any pull-to-refresh UI
  // Native browser pull-to-refresh will handle it
  if (!isPWA) {
    return <div className={className}>{children}</div>;
  }

  // In PWA mode, we render without transforms to avoid breaking fixed positioning
  // The spinner appears as a fixed overlay, content stays in place
  return (
    <div
      ref={containerRef}
      className={className}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Spinner - fixed position overlay that slides down */}
      {showSpinner && (
        <div
          className="fixed left-1/2 -translate-x-1/2 pointer-events-none z-[200]"
          style={{
            top: Math.max(20, pullDistance - 20),
            opacity: Math.min(1, progress),
            transition: isRefreshing ? 'none' : (pullDistance === 0 ? 'all 0.2s ease-out' : 'none'),
          }}
        >
          <div className="bg-black/60 backdrop-blur-sm rounded-full p-2">
            <Spinner progress={progress} isRefreshing={isRefreshing} />
          </div>
        </div>
      )}

      {children}
    </div>
  );
}

export default PullToRefresh;
