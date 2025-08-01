/**
 * ExchangeButton component - Handles the "Nekt" button with exchange states and sharing categories
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './Button';
import { initializeClockSync } from '@/lib/services/client/clockSyncService';
import { LoadingSpinner } from '../LoadingSpinner';
import { FaChevronUp, FaChevronDown } from 'react-icons/fa';
import type { ExchangeStatus, ContactExchangeState } from '@/types/contactExchange';

interface ExchangeButtonProps {
  className?: string;
}

type SharingCategory = 'All' | 'Personal' | 'Work';

const SHARING_CATEGORIES: SharingCategory[] = ['All', 'Personal', 'Work'];

export const ExchangeButton: React.FC<ExchangeButtonProps> = ({ 
  className 
}) => {
  const router = useRouter();
  const [status, setStatus] = useState<ExchangeStatus>('idle');
  const [exchangeService, setExchangeService] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<SharingCategory>('All');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const caretRef = useRef<HTMLDivElement>(null);
  const lastPingTimeRef = useRef<number>(0); // Add ref to track last ping time

  // Load selected category from localStorage on mount
  useEffect(() => {
    try {
      const savedCategory = localStorage.getItem('nekt-sharing-category') as SharingCategory;
      if (savedCategory && SHARING_CATEGORIES.includes(savedCategory)) {
        setSelectedCategory(savedCategory);
      }
      setHasLoadedFromStorage(true);
    } catch (error) {
      console.warn('Failed to load sharing category from localStorage:', error);
      setHasLoadedFromStorage(true);
    }
  }, []);

  // Save selected category to localStorage when it changes (but only after we've loaded from storage)
  useEffect(() => {
    if (!hasLoadedFromStorage) return;
    
    try {
      localStorage.setItem('nekt-sharing-category', selectedCategory);
    } catch (error) {
      console.warn('Failed to save sharing category to localStorage:', error);
    }
  }, [selectedCategory, hasLoadedFromStorage]);

  // Close dropdown when clicking outside or pressing escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isDropdownOpen) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  // Initialize clock sync on component mount
  useEffect(() => {
    const initClockSync = async () => {
      try {
        const success = await initializeClockSync();
        if (!success) {
          console.warn('⚠️ Clock sync initialization failed');
        }
      } catch (error) {
        console.error('❌ Clock sync error:', error);
      }
    };
    
    initClockSync();
  }, []);

  // Initialize exchange service when needed
  const initializeService = async () => {
    try {
      // Always use real-time service (removed simulation)
      const { RealTimeContactExchangeService, generateSessionId } = await import('@/lib/services/client/realTimeContactExchangeService');
      const sessionId = generateSessionId();
      const service = new RealTimeContactExchangeService(sessionId, async (state: ContactExchangeState) => {
        console.log('🎯 ExchangeButton received state change:', state.status, state);
        setStatus(state.status);
        
        // Navigate to connect page only when we have a match
        if (state.status === 'matched' && state.match) {
          router.push(`/connect?token=${state.match.token}`);
          // Clear service reference immediately - service has already disconnected itself
          setExchangeService(null);
          // Reset status to idle after successful match
          setStatus('idle');
        }
        
        // Handle timeout - service has already disconnected itself, just manage UI
        if (state.status === 'timeout') {
          // Keep the timeout state visible for user feedback
          setTimeout(() => {
            setStatus('idle');
            setExchangeService(null); // Clear service reference
          }, 1000); // Show timeout for 1 second, then reset UI
        }
        
        // Handle error - service has already disconnected itself, just manage UI  
        if (state.status === 'error') {
          setTimeout(() => {
            setStatus('idle');
            setExchangeService(null); // Clear service reference
          }, 2000); // Show error for 2 seconds, then reset UI
        }
      });
      setExchangeService(service);
      return service;
    } catch (error) {
      console.error('Failed to initialize exchange service:', error);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
      return null;
    }
  };

  const handleExchangeStart = async () => {
    // If in timeout or error state, don't allow new exchange (cleanup in progress)
    if (status === 'timeout' || status === 'error') {
      return; // Button should be disabled, but just in case
    }

    // Force reset to idle if we're in any non-idle state
    // This handles edge cases where state might be inconsistent after navigation
    if (status !== 'idle') {
      const isIOS = typeof (DeviceMotionEvent as any).requestPermission === 'function';
      console.log(`⚠️ [${isIOS ? 'iOS' : 'Other'}] Exchange button clicked in non-idle state: ${status}, forcing reset`);
      setStatus('idle');
      // Small delay to ensure state updates before continuing
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    let permissionGranted = false;
    
    // For iOS, request permission IMMEDIATELY as the first action
    // NO async operations before this call to preserve user gesture context
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        
        if (permission !== 'granted') {
          setStatus('error');
          return;
        }
        permissionGranted = true;
      } catch (error) {
        console.error('❌ iOS permission request failed:', error);
        setStatus('error');
        return;
      }
    } else {
      // For non-iOS, permission will be handled by the service
      permissionGranted = false;
    }

    // Now we can do async operations after getting permission
    const platform = typeof (DeviceMotionEvent as any).requestPermission === 'function' ? 'iOS' : 'Android/Other';
    
    // Debounce ping requests to prevent duplicates (React Strict Mode can cause double execution)
    const now = Date.now();
    if (now - lastPingTimeRef.current > 1000) { // Only send ping if last one was more than 1 second ago
      lastPingTimeRef.current = now;
      fetch('/api/system/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          event: 'exchange_button_called',
          message: `[${platform}] ExchangeButton called with category: ${selectedCategory}, iOS permission granted: ${permissionGranted}`,
          timestamp: Date.now()
        })
      }).catch(() => {});
    }
    
    try {
      // Always create a fresh service and session for each exchange attempt
      // This prevents hit counter reuse and session confusion
      setStatus('requesting-permission');
      
      // Clean up any existing service first and wait for complete cleanup
      if (exchangeService && exchangeService.disconnect) {
        await exchangeService.disconnect(); // ✅ Now properly awaited
      }
      setExchangeService(null);
      
      const service = await initializeService();
      if (!service) return;

      // Start the exchange process with the selected sharing category
      await service.startExchange(permissionGranted, selectedCategory);
      
    } catch (error) {
      console.error('Failed to start exchange:', error);
      setStatus('error');
      
      // The error state cleanup will be handled by the state change handler
    }
  };

  const handleButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    // Check if click came from caret area
    if (caretRef.current && caretRef.current.contains(event.target as Node)) {
      // Click was on caret area, don't start exchange
      return;
    }

    // Close dropdown if it's open
    if (isDropdownOpen) {
      setIsDropdownOpen(false);
      return;
    }

    // Start exchange
    handleExchangeStart();
  };

  const handleCategorySelect = (category: SharingCategory) => {
    setSelectedCategory(category);
    setIsDropdownOpen(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (exchangeService && exchangeService.disconnect) {
        exchangeService.disconnect();
      }
    };
  }, [exchangeService]);

  // Get button content with animations
  const getButtonContent = () => {
    switch (status) {
      case 'requesting-permission':
        return (
          <div className="flex items-center space-x-2">
            <LoadingSpinner size="sm" />
            <span>Getting Ready...</span>
          </div>
        );
      
      case 'waiting-for-bump':
        return (
          <div className="flex items-center space-x-2">
            <div className="animate-pulse w-4 h-4 bg-current rounded-full"></div>
            <span>Waiting for Bump...</span>
          </div>
        );
      
      case 'processing':
        return (
          <div className="flex items-center space-x-2">
            <LoadingSpinner size="sm" />
            <span>Waiting for Match...</span>
          </div>
        );
      
      case 'timeout':
        return (
          <div className="flex items-center space-x-2">
            <LoadingSpinner size="sm" />
            <span>Timed Out - Cleaning up...</span>
          </div>
        );
      
      case 'error':
        return (
          <div className="flex items-center space-x-2">
            <LoadingSpinner size="sm" />
            <span>Error - Cleaning up...</span>
          </div>
        );
      
              default:
          return (
            <div className="relative flex items-center justify-center w-full">
              <div className="flex flex-col items-center">
                <span className="text-xl font-semibold">Nekt</span>
                <span className="text-xs opacity-80 mt-0">{selectedCategory}</span>
              </div>
              <div 
                ref={caretRef}
                className="absolute flex items-center justify-end rounded-r-full"
                style={{ 
                  top: '-4px', 
                  bottom: '-4px', 
                  right: '-32px', 
                  left: 'auto', 
                  width: '96px'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDropdownOpen(!isDropdownOpen);
                }}
              >
                <div className="flex flex-col mr-8">
                  <FaChevronUp className="h-3 w-3" />
                  <FaChevronDown className="h-3 w-3" />
                </div>
              </div>
            </div>
          );
    }
  };

  // Get button variant based on status
  const getButtonVariant = () => {
    switch (status) {
      case 'matched':
        return 'theme' as const;
      case 'error':
      case 'timeout':
        return 'destructive' as const;
      default:
        return 'theme' as const; // Use theme variant for consistent styling
    }
  };

  // Determine if button should be disabled and active state
  const isDisabled = ['requesting-permission', 'waiting-for-bump', 'processing', 'timeout', 'error'].includes(status);
  const isActive = status !== 'idle';

  return (
    <div className="w-full relative" ref={dropdownRef}>
      <Button
        ref={buttonRef}
        onClick={handleButtonClick}
        disabled={isDisabled}
        variant={getButtonVariant()}
        size="xl"
        className={`
          w-full font-semibold
          transition-all duration-200 ease-in-out
          ${isActive ? 'animate-pulse' : ''}
          ${className || ''}
        `}
      >
        {getButtonContent()}
      </Button>
      


      {/* Dropdown menu */}
      {isDropdownOpen && (
        <div 
          className="absolute z-50 left-0 right-0 mb-1 shadow-lg rounded-md max-h-60 overflow-y-auto backdrop-blur-sm [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-200/70 [&::-webkit-scrollbar-thumb]:rounded-full animate-in slide-in-from-top-2 duration-200"
          style={{ 
            bottom: 'calc(100% + 0.25rem)', 
            backgroundColor: 'rgba(255, 255, 255, 0.8)'
          }}
        >
          {SHARING_CATEGORIES.map((category) => (
            <div
              key={category}
              className="px-4 py-3 hover:bg-gray-100/80 cursor-pointer text-black text-center font-medium transition-colors duration-150"
              onClick={() => handleCategorySelect(category)}
            >
              {category}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
