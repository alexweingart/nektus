/**
 * Custom hook for managing QR code display state during exchange
 * Listens to exchange events and manages showQRCode/matchToken state
 */

'use client';

import { useState, useEffect } from 'react';

export function useExchangeQRDisplay() {
  const [showQRCode, setShowQRCode] = useState(false);
  const [matchToken, setMatchToken] = useState<string | null>(null);

  useEffect(() => {
    const handleExchangeInitiated = (e: CustomEvent) => {
      setMatchToken(e.detail.token);
      setShowQRCode(true);
    };

    const handleMatchFound = () => {
      setShowQRCode(false);
      setMatchToken(null);
    };

    const handleStopFloating = () => {
      // Hide QR code on timeout/error
      setShowQRCode(false);
      setMatchToken(null);
    };

    window.addEventListener('exchange-initiated', handleExchangeInitiated as EventListener);
    window.addEventListener('match-found', handleMatchFound);
    window.addEventListener('stop-floating', handleStopFloating);

    return () => {
      window.removeEventListener('exchange-initiated', handleExchangeInitiated as EventListener);
      window.removeEventListener('match-found', handleMatchFound);
      window.removeEventListener('stop-floating', handleStopFloating);
    };
  }, []);

  return { showQRCode, matchToken };
}
