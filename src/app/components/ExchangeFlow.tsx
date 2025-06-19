/**
 * ExchangeFlow component - Orchestrates the contact exchange process
 * Manages states: Waiting → Matched → Contact View
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ContactView } from './ContactView';
import type { ContactExchangeState, SavedContact } from '@/types/contactExchange';

export const ExchangeFlow: React.FC = () => {
  const router = useRouter();
  const [exchangeState, setExchangeState] = useState<ContactExchangeState>({ status: 'idle' });
  const [exchangeService, setExchangeService] = useState<any>(null);
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false);

  // Debug state changes
  useEffect(() => {
    console.log('🔄 CLIENT: ExchangeFlow state changed:', {
      status: exchangeState.status,
      hasMatch: !!exchangeState.match,
      profileName: exchangeState.match?.profile?.name
    });
  }, [exchangeState]);

  // Dynamically import the service to avoid build-time bundling issues
  useEffect(() => {
    const initializeService = async () => {
      try {
        const { RealTimeContactExchangeService, generateSessionId } = await import('@/lib/services/realTimeContactExchangeService');
        const sessionId = generateSessionId();
        const service = new RealTimeContactExchangeService(sessionId, setExchangeState);
        setExchangeService(service);
        
        // Log for debugging - use console.log which might show up in service logs
        const userAgent = navigator.userAgent;
        const hasRequestPermission = typeof (DeviceMotionEvent as any).requestPermission === 'function';
        const isIOS = /iPad|iPhone|iPod/.test(userAgent) || hasRequestPermission;
        
        console.log('🔍 INIT DEBUG:', { isIOS, hasRequestPermission, userAgent: userAgent.substring(0, 50) });
        
        // Always require user interaction for iOS or any mobile device
        if (isIOS || /Mobile|Android|iPhone|iPad/.test(userAgent)) {
          console.log('📱 INIT: iOS/Mobile detected - requiring user interaction');
          setNeedsUserInteraction(true);
        } else {
          console.log('💻 INIT: Desktop detected - auto-starting service');
          // Only auto-start for confirmed desktop browsers
          await service.startExchange();
        }
      } catch (error) {
        console.error('Failed to initialize exchange service:', error);
        setExchangeState({ status: 'error', error: 'Failed to initialize exchange' });
      }
    };

    initializeService();

    // Cleanup on unmount
    return () => {
      if (exchangeService) {
        exchangeService.disconnect();
      }
    };
  }, []);

  // Start exchange when user taps the start button (required for iOS motion permission)
  const handleStartExchange = useCallback(async () => {
    // IMMEDIATE server log to confirm this function is called
    fetch('/api/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        type: 'BUTTON_HANDLER_CALLED',
        message: 'handleStartExchange function was called'
      })
    }).catch(() => {});

    // Log to server so we can see what's happening on mobile
    const logToServer = async (event: string, message: string) => {
      try {
        await fetch('/api/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            type: 'CLIENT_BUTTON_LOG',
            event, 
            message,
            timestamp: new Date().toISOString()
          })
        });
      } catch (e) { /* ignore */ }
    };

    await logToServer('button_tapped', 'Start Exchange button tapped');
    await logToServer('device_motion_check', `DeviceMotionEvent.requestPermission available: ${typeof (DeviceMotionEvent as any).requestPermission === 'function'}`);
    await logToServer('service_ready_check', `Exchange service ready: ${!!exchangeService}`);
    
    if (!exchangeService) {
      await logToServer('service_not_ready', 'Exchange service not ready - returning early');
      return;
    }
    
    let permissionGranted = false;
    
    // For iOS, request permission IMMEDIATELY in the click handler
    // NO async operations before this call to preserve user gesture context
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      await logToServer('ios_detected', 'iOS detected - requesting permission immediately');
      console.log('🍎 iOS detected - requesting permission immediately...');
      await logToServer('ios_detected', 'iOS detected - requesting permission immediately');
      try {
        await logToServer('permission_request_about_to_call', 'About to call DeviceMotionEvent.requestPermission()');
        const permission = await (DeviceMotionEvent as any).requestPermission();
        await logToServer('permission_result_received', `Permission result: ${permission}`);
        
        if (permission !== 'granted') {
          await logToServer('permission_denied', `Permission denied: ${permission}`);
          setExchangeState({ 
            status: 'error', 
            error: `Motion permission ${permission}. Please try again or check Settings → Privacy & Security → Motion & Fitness → Fitness Tracking is enabled.` 
          });
          return;
        }
        await logToServer('ios_permission_granted', 'iOS permission granted!');
        permissionGranted = true;
      } catch (error) {
        await logToServer('ios_permission_error', `iOS permission request failed: ${error}`);
        setExchangeState({ 
          status: 'error', 
          error: 'Failed to request motion permission. Please ensure you are using Safari and try again.' 
        });
        return;
      }
    } else {
      await logToServer('non_ios_detected', 'Non-iOS device - letting service handle permission');
      // For non-iOS, permission will be handled by the service
      permissionGranted = false; // Let the service handle permission
    }
    
    await logToServer('starting_exchange', `Starting exchange with permission granted: ${permissionGranted}`);
    setNeedsUserInteraction(false);
    
    try {
      // Start the exchange, passing whether permission was already granted
      await exchangeService.startExchange(permissionGranted);
    } catch (error) {
      console.error('Failed to start exchange:', error);
      setExchangeState({ status: 'error', error: 'Failed to start exchange' });
    }
  }, [exchangeService]);

  const handleSaveContact = useCallback(async () => {
    if (!exchangeState.match || !exchangeService) return;

    try {
      const savedContact = await exchangeService.acceptContact(exchangeState.match.token);
      
      if (savedContact) {
        // Contact saved successfully
        console.log('Contact saved:', savedContact);
        // TODO: Show success message or navigate somewhere
        // For now, we'll stay on this page with a success state
      }
    } catch (error) {
      console.error('Failed to save contact:', error);
    }
  }, [exchangeService, exchangeState.match]);

  const handleReject = useCallback(async () => {
    if (!exchangeState.match || !exchangeService) return;

    try {
      await exchangeService.rejectContact(exchangeState.match.token);
      
      // Navigate back to profile or show retry option
      router.push('/');
    } catch (error) {
      console.error('Failed to reject contact:', error);
      // Still navigate back even if reject failed
      router.push('/');
    }
  }, [exchangeService, exchangeState.match, router]);

  const handleRetry = useCallback(() => {
    if (exchangeService) {
      exchangeService.reset();
    }
    router.push('/');
  }, [exchangeService, router]);

  const renderContent = () => {
    console.log('🎨 RENDER: needsUserInteraction =', needsUserInteraction, 'exchangeState.status =', exchangeState.status);
    
    // Show start button for iOS motion permission requirement
    if (needsUserInteraction) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-24 h-24 bg-primary/20 rounded-full mx-auto mb-6 flex items-center justify-center">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18l9-9-9-9-9 9 9 9z" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Ready to Connect?</h2>
            <p className="text-white/70 mb-6">Tap the button below to start looking for nearby contacts</p>
            <button
              onClick={handleStartExchange}
              className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-lg transition-colors font-semibold"
            >
              Start Exchange
            </button>
          </div>
        </div>
      );
    }

    switch (exchangeState.status) {
      case 'requesting-permission':
        return (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold text-white mb-2">Getting Ready</h2>
              <p className="text-white/70">Requesting motion access...</p>
            </div>
          </div>
        );

      case 'waiting-for-bump':
        return (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="relative mb-6">
                <div className="animate-pulse">
                  <div className="w-24 h-24 bg-primary/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <div className="w-12 h-12 bg-primary rounded-full animate-ping"></div>
                  </div>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Waiting for Bump...</h2>
              <p className="text-white/70 mb-4">Gently tap your phones together</p>
              
              <div className="space-y-2">
                <button
                  onClick={handleRetry}
                  className="text-primary hover:text-primary/80 text-sm transition-colors block mx-auto"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );

      case 'processing':
        return (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold text-white mb-2">Finding Match</h2>
              <p className="text-white/70">Looking for your connection...</p>
            </div>
          </div>
        );

      case 'matched':
        console.log('🎯 CLIENT: ExchangeFlow showing matched state', {
          hasMatch: !!exchangeState.match,
          hasProfile: !!exchangeState.match?.profile,
          profileName: exchangeState.match?.profile?.name
        });
        
        if (!exchangeState.match?.profile) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-white/70">Loading contact...</p>
              </div>
            </div>
          );
        }

        return (
          <ContactView
            profile={exchangeState.match.profile}
            onSaveContact={handleSaveContact}
            onReject={handleReject}
            isLoading={false}
          />
        );

      case 'accepted':
        return (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Contact Saved!</h2>
              <p className="text-white/70 mb-6">You can find them in your contacts</p>
              <button
                onClick={() => router.push('/')}
                className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        );

      case 'rejected':
        return (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Exchange Cancelled</h2>
              <p className="text-white/70 mb-6">No contact was saved</p>
              <button
                onClick={() => router.push('/')}
                className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Back to Profile
              </button>
            </div>
          </div>
        );

      case 'timeout':
        return (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">No Match Found</h2>
              <p className="text-white/70 mb-6">Nobody nearby, try again</p>
              <div className="space-y-2">
                <button
                  onClick={handleRetry}
                  className="block w-full bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="block w-full text-white/70 hover:text-white text-sm transition-colors"
                >
                  Back to Profile
                </button>
              </div>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Permission Required</h2>
              <p className="text-white/70 mb-2">{exchangeState.error || 'Please try again'}</p>
              
              {/* iOS specific instructions */}
              <div className="bg-black/30 rounded-lg p-4 mb-4 text-sm">
                <p className="text-white/90 font-semibold mb-2">iOS Users:</p>
                <p className="text-white/70 text-left">
                  • Make sure you're using Safari (not Chrome/Firefox)<br/>
                  • Look for a permission popup at the top of the screen<br/>
                  • If no popup appears, check Settings → Safari → Motion & Orientation Access
                </p>
              </div>
              <div className="space-y-2 mt-6">
                <button
                  onClick={handleRetry}
                  className="block w-full bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="block w-full text-white/70 hover:text-white text-sm transition-colors"
                >
                  Back to Profile
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-white/70">Initializing...</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black">
      {renderContent()}
    </div>
  );
};
