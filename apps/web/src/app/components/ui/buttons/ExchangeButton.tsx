/**
 * ExchangeButton component - Handles the "Nekt" button with exchange states and sharing categories
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './Button';
import { LoadingSpinner } from '../elements/LoadingSpinner';
import type { ExchangeStatus, ContactExchangeState } from '@/types/contactExchange';
import { useProfile } from '@/app/context/ProfileContext';

interface ExchangeButtonProps {
  className?: string;
}

export const ExchangeButton: React.FC<ExchangeButtonProps> = ({
  className
}) => {
  const router = useRouter();
  const { sharingCategory: selectedCategory } = useProfile();
  const [status, setStatus] = useState<ExchangeStatus>('idle');
  const [exchangeService, setExchangeService] = useState<{ disconnect: () => Promise<void>; startExchange: (permissionGranted?: boolean, sharingCategory?: "All" | "Personal" | "Work") => Promise<void> } | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);

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

          // Trigger exit animation on ProfileView with demo contact colors
          window.dispatchEvent(new CustomEvent('match-found', {
            detail: {
              backgroundColors: ['#FF6F61', '#FFB6C1', '#FF1493']  // Demo coral/pink colors
            }
          }));

          // Wait for exit animation to complete (500ms), then navigate
          setTimeout(() => {
            router.push('/x/test-animation-token');
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
      const { RealTimeContactExchangeService, generateSessionId } = await import('@/client/contacts/exchange/service');
      const sessionId = generateSessionId();
      const service = new RealTimeContactExchangeService(sessionId, async (state: ContactExchangeState) => {
        console.log('🎯 ExchangeButton received state change:', state.status, state);
        setStatus(state.status);

        // Save QR token for qr-scan-matched state
        if (state.qrToken) {
          setQrToken(state.qrToken);
        }

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

        // Navigate to connect page only for BUMP matches (not QR scan matches)
        // QR scan matches should show "Match Found!" button instead
        if (state.status === 'matched' && state.match) {
          console.log('🎯 ExchangeButton: Bump match found, fetching contact background');

          // Store token for use in setTimeout callback
          const matchToken = state.match.token;

          // Fetch contact profile to get background colors
          let backgroundColors: string[] | undefined;
          try {
            const response = await fetch(`/api/exchange/pair/${matchToken}`);
            if (response.ok) {
              const result = await response.json();
              if (result.success && result.profile?.backgroundColors) {
                backgroundColors = result.profile.backgroundColors;
              }
            }
          } catch (error) {
            console.error('Failed to fetch contact background colors:', error);
          }

          // Emit match-found event with contact background colors
          console.log('🎯 ExchangeButton: Emitting match-found event', { backgroundColors });
          window.dispatchEvent(new CustomEvent('match-found', {
            detail: { backgroundColors }
          }));

          // Navigate after a small delay to allow animation to start
          setTimeout(() => {
            router.push(`/x/${matchToken}`);
            // Clear service reference immediately - service has already disconnected itself
            setExchangeService(null);
            // Reset status to idle after successful match
            setStatus('idle');
          }, 100);
        }

        // For QR scan matches, don't auto-navigate - button becomes tappable "Match Found!"
        if (state.status === 'qr-scan-matched') {
          console.log('🎯 ExchangeButton: QR scan match - showing tappable button');
          // Button will show "Match Found!" and user can tap to navigate
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
    // Handle QR scan matched state - navigate to contact view
    if (status === 'qr-scan-matched' && qrToken) {
      console.log('🎯 ExchangeButton: Navigating to QR match contact');
      router.push(`/x/${qrToken}`);
      // Reset state
      setStatus('idle');
      setQrToken(null);
      setExchangeService(null);
      return;
    }

    // Normal exchange start
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

  // Listen for cancel event from ProfileView
  useEffect(() => {
    const handleCancel = async () => {
      console.log('🚫 ExchangeButton: Cancel exchange requested');

      // Disconnect the service
      if (exchangeService && exchangeService.disconnect) {
        await exchangeService.disconnect();
      }

      // Reset state
      setExchangeService(null);
      setStatus('idle');
      setQrToken(null);

      // Dispatch stop-floating event to exit animations
      console.log('🚫 ExchangeButton: Emitting stop-floating event');
      window.dispatchEvent(new CustomEvent('stop-floating'));
    };

    window.addEventListener('cancel-exchange', handleCancel);
    return () => {
      window.removeEventListener('cancel-exchange', handleCancel);
    };
  }, [exchangeService]);

  // Get button content with animations
  const getButtonContent = () => {
    switch (status) {
      case 'requesting-permission':
        return (
          <div className="flex items-center space-x-2">
            <LoadingSpinner size="sm" />
            <span>Warming up...</span>
          </div>
        );
      
      case 'waiting-for-bump':
        return (
          <div className="flex items-center space-x-2">
            <div className="animate-pulse w-4 h-4 bg-current rounded-full"></div>
            <span>Bump or scan when ready...</span>
          </div>
        );
      
      case 'processing':
        return (
          <div className="flex items-center space-x-2">
            <div className="animate-pulse w-4 h-4 bg-current rounded-full"></div>
            <span>Finding your person...</span>
          </div>
        );

      case 'qr-scan-pending':
        return (
          <div className="flex items-center space-x-2">
            <div className="animate-pulse w-4 h-4 bg-current rounded-full"></div>
            <span>Finding your person...</span>
          </div>
        );

      case 'qr-scan-matched':
        return (
          <span className="text-xl font-semibold">Match Found!</span>
        );

      case 'timeout':
        return (
          <div className="flex items-center space-x-2">
            <LoadingSpinner size="sm" />
            <span>Missed it — bump again!</span>
          </div>
        );
      
      case 'error':
        return (
          <div className="flex items-center space-x-2">
            <LoadingSpinner size="sm" />
            <span>Oops, hang tight...</span>
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
        return 'white' as const;
      case 'error':
      case 'timeout':
        return 'destructive' as const;
      default:
        return 'white' as const; // Use white variant for consistent styling
    }
  };

  // Determine if button should be disabled and active state
  const isDisabled = ['requesting-permission', 'waiting-for-bump', 'processing', 'qr-scan-pending', 'timeout', 'error'].includes(status);
  const shouldPulse = status === 'qr-scan-matched';

  // Calculate animation delay to sync with float animation (3s cycle)
  const getAnimationDelay = () => {
    const floatStart = (window as Window & { floatAnimationStart?: number }).floatAnimationStart;
    if (floatStart) {
      const elapsed = Date.now() - floatStart;
      const positionInCycle = elapsed % 3000;
      return -positionInCycle;
    }
    return 0;
  };

  // Build props conditionally to avoid overriding Button's internal gradient
  const buttonProps = {
    onClick: handleButtonClick,
    disabled: isDisabled,
    variant: getButtonVariant(),
    size: "xl" as const,
    className: `w-full ${shouldPulse ? 'animate-color-pulse' : ''} ${className || ''}`,
    ...(shouldPulse && {
      style: {
        animationDelay: `${getAnimationDelay()}ms`,
        background: 'radial-gradient(circle, rgb(255 255 255 / 1), rgb(255 255 255 / 0.6))'
      }
    })
  };

  return (
    <Button {...buttonProps}>
      {getButtonContent()}
    </Button>
  );
};
