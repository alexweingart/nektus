'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void> | void;
  pullThreshold?: number;
  className?: string;
}

export function PullToRefresh({ 
  children, 
  onRefresh, 
  pullThreshold = 80,
  className = '' 
}: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [startY, setStartY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;
    
    setStartY(e.touches[0].clientY);
    setIsPulling(true);
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling || isRefreshing) return;
    
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;

    const currentY = e.touches[0].clientY;
    const distance = currentY - startY;
    
    if (distance > 0) {
      // Pulling down - apply pull distance
      e.preventDefault(); // Prevent native scroll behavior
      setPullDistance(Math.min(distance * 0.5, pullThreshold * 1.5)); // Add resistance
    } else {
      // Pulling up or no movement - reset pull distance immediately
      setPullDistance(0);
    }
  }, [isPulling, isRefreshing, startY, pullThreshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;
    
    setIsPulling(false);
    
    if (pullDistance >= pullThreshold && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh failed:', error);
      } finally {
        setIsRefreshing(false);
      }
    }
    
    setPullDistance(0);
  }, [isPulling, pullDistance, pullThreshold, isRefreshing, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Add passive: false to allow preventDefault
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const pullProgress = Math.min(pullDistance / pullThreshold, 1);
  const showRefreshIndicator = pullDistance > 20 || isRefreshing;

  return (
    <div 
      ref={containerRef}
      className={`min-h-screen overflow-y-auto overflow-x-hidden ${className}`}
      style={{
        transform: pullDistance > 0 ? (isRefreshing ? `translateY(${Math.min(pullDistance, 60)}px)` : `translateY(${pullDistance}px)`) : 'translateY(0px)',
        transition: isPulling && pullDistance > 0 ? 'none' : 'transform 0.2s ease-out',
        height: '100vh',
        minHeight: '100dvh',
        // Prevent overscroll bounce to avoid black area
        overscrollBehaviorY: 'none',
        overscrollBehaviorX: 'contain'
      }}
    >
      {/* Pull-to-refresh indicator - at the top */}
      {showRefreshIndicator && (
        <div 
          className="fixed top-4 left-1/2 transform -translate-x-1/2 z-20 flex justify-center items-center"
          style={{
            opacity: isRefreshing ? 1 : pullProgress
          }}
        >
          <div 
            className="flex items-center justify-center rounded-full shadow-xl border border-white/30"
            style={{
              width: `${Math.max(40, Math.min(pullProgress * 60 + 40, 80))}px`,
              height: `${Math.max(40, Math.min(pullProgress * 60 + 40, 80))}px`,
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)', // Safari compatibility
              transition: isRefreshing ? 'all 0.3s ease-out' : 'none'
            }}
          >
            {isRefreshing ? (
              <LoadingSpinner size="sm" className="text-white" />
            ) : (
              <div 
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                style={{
                  transform: `rotate(${pullProgress * 180}deg)`,
                  transition: 'transform 0.1s ease-out'
                }}
              />
            )}
          </div>
        </div>
      )}
      
      {/* Content */}
      <div className="relative">
        {children}
      </div>
    </div>
  );
} 