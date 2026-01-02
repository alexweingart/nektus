/**
 * Custom hook for managing QR code display state during exchange
 * Listens to exchange events and manages showQRCode/matchToken state
 */

import { useState, useEffect } from 'react';
import { exchangeEvents } from '../contacts/exchange/service';
import type { ExchangeStatus } from '@nektus/shared-types';

export function useExchangeQRDisplay() {
  const [showQRCode, setShowQRCode] = useState(false);
  const [matchToken, setMatchToken] = useState<string | null>(null);

  useEffect(() => {
    // Listen for exchange initiated event (token received, show QR)
    const unsubscribe = exchangeEvents.onExchangeInitiated(({ token }) => {
      console.log('📱 [iOS] QR Display: Exchange initiated, showing QR code');
      setMatchToken(token);
      setShowQRCode(true);
    });

    return unsubscribe;
  }, []);

  // Hide QR code when status changes to idle, error, timeout, or matched
  const handleStatusChange = (status: ExchangeStatus) => {
    if (['idle', 'error', 'timeout', 'matched', 'qr-scan-matched'].includes(status)) {
      setShowQRCode(false);
      setMatchToken(null);
    }
  };

  return { showQRCode, matchToken, handleStatusChange };
}
