/**
 * ExchangeButton component - Handles the "Nekt" button with exchange states
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './Button';
import { initializeClockSync } from '@/lib/utils/clockSync';
import { LoadingSpinner } from './LoadingSpinner';
import type { ExchangeStatus, ContactExchangeState } from '@/types/contactExchange';

interface ExchangeButtonProps {
  className?: string;
}

export const ExchangeButton: React.FC<ExchangeButtonProps> = ({ 
  className 
}) => {
  const router = useRouter();
  const [status, setStatus] = useState<ExchangeStatus>('idle');
  const [exchangeService, setExchangeService] = useState<any>(null);

  // Initialize clock sync on component mount
  useEffect(() => {
    const initClockSync = async () => {
      try {
        console.log('⏰ Initializing clock sync on page load...');
        const success = await initializeClockSync();
        if (success) {
          console.log('✅ Clock sync initialized successfully');
        } else {
          console.warn('⚠️ Clock sync initialization failed');
        }
      } catch (error) {
        console.error('❌ Clock sync error:', error);
      }
    };
    
    initClockSync();
  }, []); // Run once on mount

  // Initialize exchange service when needed
  const initializeService = async () => {
    try {
      // Always use real-time service (removed simulation)
      const { RealTimeContactExchangeService, generateSessionId } = await import('@/lib/services/realTimeContactExchangeService');
      const sessionId = generateSessionId();
      const service = new RealTimeContactExchangeService(sessionId, (state: ContactExchangeState) => {
        setStatus(state.status);
        
        // Navigate to connect page only when we have a match
        if (state.status === 'matched' && state.match) {
          router.push(`/connect?token=${state.match.token}`);
        }
        
        // Handle timeout - reset to idle after delay
        if (state.status === 'timeout') {
          setTimeout(() => setStatus('idle'), 2000);
        }
        
        // Handle error - reset to idle after delay  
        if (state.status === 'error') {
          setTimeout(() => setStatus('idle'), 2000);
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
    // If in timeout or error state, reset and try again
    if (status === 'timeout' || status === 'error') {
      setStatus('idle');
      return;
    }

    let permissionGranted = false;
    
    // For iOS, request permission IMMEDIATELY as the first action
    // NO async operations before this call to preserve user gesture context
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        
        if (permission !== 'granted') {
          setStatus('error');
          setTimeout(() => setStatus('idle'), 2000);
          return;
        }
        permissionGranted = true;
      } catch (error) {
        console.error('❌ iOS permission request failed:', error);
        setStatus('error');
        setTimeout(() => setStatus('idle'), 2000);
        return;
      }
    } else {
      // For non-iOS, permission will be handled by the service
      permissionGranted = false;
    }

    // Now we can do async operations after getting permission
    fetch('/api/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        type: 'EXCHANGE_BUTTON_CALLED',
        message: `ExchangeButton called, iOS permission granted: ${permissionGranted}`
      })
    }).catch(() => {});
    
    try {
      setStatus('requesting-permission');
      
      // Initialize service if not already done
      let service = exchangeService;
      if (!service) {
        service = await initializeService();
        if (!service) return;
      }

      // Start the exchange process
      await service.startExchange(permissionGranted);
      
    } catch (error) {
      console.error('Failed to start exchange:', error);
      setStatus('error');
      
      // Reset to idle after showing error
      setTimeout(() => setStatus('idle'), 2000);
    }
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
        return 'Timed Out - Try Again';
      
      case 'error':
        return 'Error - Try Again';
      
      default:
        return 'Nekt';
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
  const isDisabled = ['requesting-permission', 'waiting-for-bump', 'processing'].includes(status);
  const isActive = status !== 'idle';

  return (
    <div className="w-full">
      <Button
        onClick={handleExchangeStart}
        disabled={isDisabled}
        variant={getButtonVariant()}
        size="lg"
        className={`
          w-full text-xl font-semibold
          transition-all duration-200 ease-in-out
          ${isActive ? 'animate-pulse' : ''}
          ${className || ''}
        `}
      >
        {getButtonContent()}
      </Button>
    </div>
  );
};
