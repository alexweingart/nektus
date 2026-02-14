'use client';

import { useState } from 'react';
import { StandardModal } from './StandardModal';
import { StaticInput } from '../inputs/StaticInput';
import { useProfile } from '@/app/context/ProfileContext';
import { ensureReadableColor } from '@/shared/colors';

interface AppleCalendarSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (appleId: string, appPassword: string) => Promise<void>;
}

export default function AppleCalendarSetupModal({ isOpen, onClose, onConnect }: AppleCalendarSetupModalProps) {
  const [appleId, setAppleId] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const { profile } = useProfile();

  const dominantColor = profile?.backgroundColors?.[0];
  const linkColor = dominantColor ? ensureReadableColor(dominantColor) : undefined;

  const handleConnect = async () => {
    if (!appleId || !appPassword) {
      setError('Please enter both Apple ID and app-specific password');
      return;
    }

    if (appPassword.length !== 16) {
      setError('App-specific password should be 16 characters');
      return;
    }

    setIsConnecting(true);
    setError('');

    try {
      await onConnect(appleId, appPassword);
      resetModal();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsConnecting(false);
    }
  };

  const resetModal = () => {
    setAppleId('');
    setAppPassword('');
    setError('');
    setIsConnecting(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Connect Apple Calendar"
      primaryButtonText={isConnecting ? 'Connecting...' : 'Connect Calendar'}
      onPrimaryButtonClick={handleConnect}
      primaryButtonDisabled={!appleId || !appPassword || isConnecting}
      showSecondaryButton={true}
      secondaryButtonText="Cancel"
      showCloseButton={false}
    >
      <div className="text-center mb-6">
        <p className="text-sm text-white">
          <a
            href="https://appleid.apple.com/account/security"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            style={linkColor ? { color: linkColor } : { color: 'hsl(var(--primary))' }}
          >
            Generate an app-specific password
          </a>
          {' '}for your Apple ID and enter it below
        </p>
      </div>

      <div className="space-y-4">
        <StaticInput
          type="email"
          value={appleId}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAppleId(e.target.value)}
          placeholder="Apple ID (iCloud Email)"
        />
        <StaticInput
          type="text"
          value={appPassword}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAppPassword(e.target.value.replace(/[\s-]/g, ''))}
          placeholder="16-character app-specific password"
          data-1p-ignore="true"
          data-bwignore="true"
          autoComplete="off"
        />
      </div>

      {error && (
        <div className="mt-4 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </StandardModal>
  );
}
