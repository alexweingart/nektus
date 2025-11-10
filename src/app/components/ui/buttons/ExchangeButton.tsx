/**
 * ExchangeButton component - Handles the "Nekt" button with exchange states and sharing categories
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './Button';
import { LoadingSpinner } from '../elements/LoadingSpinner';
import type { ExchangeStatus, ContactExchangeState } from '@/types/contactExchange';

interface ExchangeButtonProps {
  className?: string;
}

type SharingCategory = 'Personal' | 'Work';

export const ExchangeButton: React.FC<ExchangeButtonProps> = ({
  className
}) => {
  const router = useRouter();
  const [status, setStatus] = useState<ExchangeStatus>('idle');
  const [exchangeService, setExchangeService] = useState<{ disconnect: () => Promise<void>; startExchange: (permissionGranted?: boolean, sharingCategory?: "All" | "Personal" | "Work") => Promise<void> } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SharingCategory>('Personal');

  // Load selected category from localStorage on mount and listen for changes
  useEffect(() => {
    const loadCategory = () => {
      try {
        const savedCategory = localStorage.getItem('nekt-sharing-category') as SharingCategory;
        if (savedCategory && ['Personal', 'Work'].includes(savedCategory)) {
          setSelectedCategory(savedCategory);
        }
      } catch (error) {
        console.warn('Failed to load sharing category from localStorage:', error);
      }
    };

    // Load initial value
    loadCategory();

    // Listen for storage changes from ProfileInfo
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'nekt-sharing-category' && e.newValue) {
        const newCategory = e.newValue as SharingCategory;
        if (['Personal', 'Work'].includes(newCategory)) {
          setSelectedCategory(newCategory);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Listen for admin simulation trigger
  useEffect(() => {
    const handleSimulateNekt = async () => {
      console.log('🧪 ExchangeButton: Starting admin simulation');

      // 1. Waiting for bump (floating animation)
      setStatus('waiting-for-bump');
      window.dispatchEvent(new CustomEvent('start-floating'));

      // 2. After 3 seconds, bump detected
      setTimeout(() => {
        console.log('🧪 ExchangeButton: Simulating bump detected');
        setStatus('processing');
        window.dispatchEvent(new CustomEvent('bump-detected'));

        // 3. After 500ms, simulate match and trigger exit animation
        setTimeout(async () => {
          console.log('🧪 ExchangeButton: Simulating match - triggering exit animation');
          setStatus('matched');

          // Trigger exit animation on ProfileView with mock contact background
          window.dispatchEvent(new CustomEvent('match-found', {
            detail: {
              contactBackgroundImage: '' // No background for mock
            }
          }));

          // Wait for exit animation to complete (500ms), then navigate
          setTimeout(() => {
            sessionStorage.setItem('test-connect-mode', 'true');
            router.push('/connect?token=test-animation-token');
          }, 500);
        }, 500);
      }, 3000);
    };

    window.addEventListener('admin-simulate-nekt', handleSimulateNekt as EventListener);
    return () => window.removeEventListener('admin-simulate-nekt', handleSimulateNekt as EventListener);
  }, [router]);


  // Initialize exchange service when needed
  const initializeService = async () => {
    try {
      // Always use real-time service (removed simulation)
      const { RealTimeContactExchangeService, generateSessionId } = await import('@/lib/services/client/realTimeContactExchangeService');
      const sessionId = generateSessionId();
      const service = new RealTimeContactExchangeService(sessionId, async (state: ContactExchangeState) => {
        console.log('🎯 ExchangeButton received state change:', state.status, state);
        setStatus(state.status);

        // Emit start-floating event when waiting for bump
        if (state.status === 'waiting-for-bump') {
          console.log('🎯 ExchangeButton: Emitting start-floating event');
          window.dispatchEvent(new CustomEvent('start-floating'));
        }

        // Emit bump-detected event when processing starts
        if (state.status === 'processing') {
          console.log('🎯 ExchangeButton: Emitting bump-detected event');
          window.dispatchEvent(new CustomEvent('bump-detected'));
        }

        // Navigate to connect page only when we have a match
        if (state.status === 'matched' && state.match) {
          console.log('🎯 ExchangeButton: Match found, fetching contact background');

          // Store token for use in setTimeout callback
          const matchToken = state.match.token;

          // Fetch contact profile to get background image
          let contactBackgroundImage = '';
          try {
            const response = await fetch(`/api/exchange/pair/${matchToken}`);
            if (response.ok) {
              const result = await response.json();
              if (result.success && result.profile?.backgroundImage) {
                contactBackgroundImage = result.profile.backgroundImage;
              }
            }
          } catch (error) {
            console.error('Failed to fetch contact background:', error);
          }

          // Emit match-found event with contact background
          console.log('🎯 ExchangeButton: Emitting match-found event');
          window.dispatchEvent(new CustomEvent('match-found', {
            detail: { contactBackgroundImage }
          }));

          // Navigate after a small delay to allow animation to start
          setTimeout(() => {
            router.push(`/connect?token=${matchToken}`);
            // Clear service reference immediately - service has already disconnected itself
            setExchangeService(null);
            // Reset status to idle after successful match
            setStatus('idle');
          }, 100);
        }
        
        // Handle timeout - service has already disconnected itself, just manage UI
        if (state.status === 'timeout') {
          console.log('🎯 ExchangeButton: Emitting stop-floating event (timeout)');
          window.dispatchEvent(new CustomEvent('stop-floating'));
          // Keep the timeout state visible for user feedback
          setTimeout(() => {
            setStatus('idle');
            setExchangeService(null); // Clear service reference
          }, 1000); // Show timeout for 1 second, then reset UI
        }

        // Handle error - service has already disconnected itself, just manage UI
        if (state.status === 'error') {
          console.log('🎯 ExchangeButton: Emitting stop-floating event (error)');
          window.dispatchEvent(new CustomEvent('stop-floating'));
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
      const isIOS = typeof (DeviceMotionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> }).requestPermission === 'function';
      console.log(`⚠️ [${isIOS ? 'iOS' : 'Other'}] Exchange button clicked in non-idle state: ${status}, forcing reset`);
      setStatus('idle');
      // Small delay to ensure state updates before continuing
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    let permissionGranted = false;
    
    // For iOS, request permission IMMEDIATELY as the first action
    // NO async operations before this call to preserve user gesture context
    const DeviceMotionEventWithPermission = DeviceMotionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> };
    if (typeof DeviceMotionEventWithPermission.requestPermission === 'function') {
      try {
        const permission = await DeviceMotionEventWithPermission.requestPermission!();
        
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
    // Note: Telemetry removed - was just console.log on server

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

  const handleButtonClick = () => {
    handleExchangeStart();
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
            <span>Timed out, try bumping again!</span>
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
            <span className="text-xl font-semibold">Nekt</span>
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
    <Button
      onClick={handleButtonClick}
      disabled={isDisabled}
      variant={getButtonVariant()}
      size="xl"
      className={`
        w-full font-semibold
        ${isActive ? 'animate-pulse' : ''}
        ${className || ''}
      `}
    >
      {getButtonContent()}
    </Button>
  );
};
