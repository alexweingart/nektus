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
    const distance = Math.max(0, currentY - startY);
    
    if (distance > 0) {
      e.preventDefault(); // Prevent native scroll behavior
      setPullDistance(Math.min(distance * 0.5, pullThreshold * 1.5)); // Add resistance
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
      className={`h-screen overflow-y-auto overflow-x-hidden ${className}`}
      style={{
        transform: isRefreshing ? `translateY(${Math.min(pullDistance, 60)}px)` : `translateY(${pullDistance}px)`,
        transition: isPulling ? 'none' : 'transform 0.3s ease-out'
      }}
    >
      {/* Pull-to-refresh indicator */}
      {showRefreshIndicator && (
        <div 
          className="absolute top-0 left-0 right-0 flex justify-center items-center z-10"
          style={{
            height: `${Math.max(pullDistance, isRefreshing ? 60 : 0)}px`,
            opacity: isRefreshing ? 1 : pullProgress,
            transform: `translateY(-${Math.max(pullDistance, isRefreshing ? 60 : 0)}px)`
          }}
        >
          <div className="flex flex-col items-center">
            {isRefreshing ? (
              <LoadingSpinner size="sm" className="text-white" />
            ) : (
              <div 
                className="w-6 h-6 border-2 border-white border-t-transparent rounded-full"
                style={{
                  transform: `rotate(${pullProgress * 180}deg)`,
                  transition: 'transform 0.1s ease-out'
                }}
              />
            )}
            <p className="text-white text-sm mt-2">
              {isRefreshing ? 'Refreshing...' : pullDistance >= pullThreshold ? 'Release to refresh' : 'Pull to refresh'}
            </p>
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