/**
 * ExchangeButton component - Handles the "Nekt" button with exchange states
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/Button';
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
  const [useRealTime, setUseRealTime] = useState(true); // Toggle for testing - default to real-time

  // Initialize exchange service when needed
  const initializeService = async () => {
    try {
      // Use the toggle state instead of config
      const USE_REAL_TIME_EXCHANGE = useRealTime;
      
      if (USE_REAL_TIME_EXCHANGE) {
        // Use real-time service
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
            setTimeout(() => setStatus('idle'), 3000);
          }
          
          // Handle error - reset to idle after delay  
          if (state.status === 'error') {
            setTimeout(() => setStatus('idle'), 3000);
          }
        });
        setExchangeService(service);
        return service;
      } else {
        // Use simulation service
        const { ContactExchangeService } = await import('@/lib/services/contactExchangeService');
        const service = new ContactExchangeService((state: ContactExchangeState) => {
          setStatus(state.status);
          
          // Navigate to connect page only when we have a match
          if (state.status === 'matched' && state.match) {
            router.push(`/connect?token=${state.match.token}`);
          }
          
          // Handle timeout - reset to idle after delay
          if (state.status === 'timeout') {
            setTimeout(() => setStatus('idle'), 3000);
          }
          
          // Handle error - reset to idle after delay  
          if (state.status === 'error') {
            setTimeout(() => setStatus('idle'), 3000);
          }
        });
        setExchangeService(service);
        return service;
      }
      
    } catch (error) {
      console.error('Failed to initialize exchange service:', error);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
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
          setTimeout(() => setStatus('idle'), 3000);
          return;
        }
        permissionGranted = true;
      } catch (error) {
        console.error('❌ iOS permission request failed:', error);
        setStatus('error');
        setTimeout(() => setStatus('idle'), 3000);
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
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (exchangeService) {
        exchangeService.disconnect();
      }
    };
  }, [exchangeService]);

  const getButtonContent = () => {
    switch (status) {
      case 'requesting-permission':
        return (
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
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
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
            <span>Finding Match...</span>
          </div>
        );
      
      case 'timeout':
        return 'Try Again';
      
      case 'error':
        return 'Try Again';
      
      default:
        return 'Nekt';
    }
  };

  const isDisabled = ['requesting-permission', 'waiting-for-bump', 'processing'].includes(status);
  const isActive = status !== 'idle';

  return (
    <div className="w-full space-y-4">
      {/* Mode Toggle */}
      <div className="flex items-center justify-center space-x-2 text-sm">
        <span className={!useRealTime ? 'font-semibold' : 'text-gray-400'}>Simulation</span>
        <button
          onClick={() => setUseRealTime(!useRealTime)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full ${
            useRealTime ? 'bg-blue-600' : 'bg-gray-200'
          } transition-colors`}
          disabled={isDisabled}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              useRealTime ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <span className={useRealTime ? 'font-semibold' : 'text-gray-400'}>Real-time</span>
      </div>

      {/* Exchange Button */}
      <Button 
        variant="theme"
        size="lg"
        className={`w-full font-bold text-lg transition-all duration-200 ${
          isActive ? 'animate-pulse' : ''
        } ${className}`}
        onClick={handleExchangeStart}
        disabled={isDisabled}
      >
        {getButtonContent()}
      </Button>
    </div>
  );
};
