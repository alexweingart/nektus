/**
 * AddCalendarModal - Modal for selecting calendar provider
 * Adapted from CalConnect's CalendarProviderButtons for Nekt styling
 */

'use client';

import React, { useState } from 'react';
import { StandardModal } from './StandardModal';
import { Button } from '../buttons/Button';
import AppleCalendarSetupModal from './AppleCalendarSetupModal';
import type { FieldSection } from '@/types/profile';

interface AddCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: FieldSection;  // 'personal' | 'work'
  userEmail: string;
  onCalendarAdded: () => void;
}

export const AddCalendarModal: React.FC<AddCalendarModalProps> = ({
  isOpen,
  onClose,
  section,
  userEmail,
  onCalendarAdded
}) => {
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [isAppleModalOpen, setIsAppleModalOpen] = useState(false);

  const handleAppleCalendarConnect = async (appleId: string, appPassword: string) => {
    try {
      setIsConnecting('apple');

      // Call the API to test Apple calendar connection
      const response = await fetch('/api/calendar-connections/apple/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail,
          appleId,
          appSpecificPassword: appPassword,
          section
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to connect Apple Calendar');
      }

      // Calendar was saved server-side, just notify and close
      await onCalendarAdded();
      setIsAppleModalOpen(false);
      onClose();
    } catch (error) {
      console.error('Failed to connect Apple Calendar:', error);
      throw error; // Re-throw so modal can show error
    } finally {
      setIsConnecting(null);
    }
  };

  const handleAddCalendar = async (provider: 'google' | 'microsoft' | 'apple') => {
    if (isConnecting) return;

    try {
      setIsConnecting(provider);

      // Store the section and origin page for OAuth callback
      sessionStorage.setItem('calendar-section', section);
      sessionStorage.setItem('oauth-origin-page', window.location.pathname);

      if (provider === 'google') {
        // Redirect to Google OAuth
        const params = new URLSearchParams({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID!,
          redirect_uri: `${window.location.origin}/api/calendar-connections/google/callback`,
          response_type: 'code',
          scope: 'https://www.googleapis.com/auth/calendar.readonly openid profile email',
          access_type: 'offline',
          prompt: 'select_account',
          state: encodeURIComponent(JSON.stringify({ userEmail, section }))
        });

        window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      } else if (provider === 'microsoft') {
        // Redirect to Microsoft OAuth
        const params = new URLSearchParams({
          client_id: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID!,
          redirect_uri: `${window.location.origin}/api/calendar-connections/microsoft/callback`,
          response_type: 'code',
          scope: 'https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/User.Read openid profile email offline_access',
          prompt: 'select_account',
          state: encodeURIComponent(JSON.stringify({ userEmail, section }))
        });

        window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
      } else if (provider === 'apple') {
        // For Apple, we'll need a separate modal for CalDAV credentials
        onClose(); // Close the AddCalendarModal first
        setIsAppleModalOpen(true);
        setIsConnecting(null);
      }
    } catch (error) {
      console.error(`Error connecting ${provider} calendar:`, error);
      alert(`Failed to connect ${provider}. Please try again.`);
      setIsConnecting(null);
    }
  };

  return (
    <>
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Calendar"
      subtitle="Make finding time effortless! Nekt uses only reads free/busy info, and stores no data."
      showPrimaryButton={false}
      showSecondaryButton={true}
      secondaryButtonText="Cancel"
      showCloseButton={false}
    >
      <div className="space-y-3">
            {/* Google Calendar */}
            <Button
              variant="white"
              size="lg"
              className="w-full"
              onClick={() => handleAddCalendar('google')}
              disabled={isConnecting === 'google'}
              icon={
                <svg className="w-6 h-6 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              }
              iconPosition="left"
            >
              {isConnecting === 'google' ? 'Connecting...' : 'Google Calendar'}
            </Button>

            {/* Microsoft Calendar */}
            <Button
              variant="white"
              size="lg"
              className="w-full"
              onClick={() => handleAddCalendar('microsoft')}
              disabled={isConnecting === 'microsoft'}
              icon={
                <svg className="w-6 h-6 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#F25022" d="M1 1h10v10H1z" />
                  <path fill="#7FBA00" d="M13 1h10v10H13z" />
                  <path fill="#00A4EF" d="M1 13h10v10H1z" />
                  <path fill="#FFB900" d="M13 13h10v10H13z" />
                </svg>
              }
              iconPosition="left"
            >
              {isConnecting === 'microsoft' ? 'Connecting...' : 'Microsoft Calendar'}
            </Button>

            {/* Apple Calendar */}
            <Button
              variant="white"
              size="lg"
              className="w-full"
              onClick={() => handleAddCalendar('apple')}
              disabled={isConnecting === 'apple'}
              icon={
                <svg className="w-6 h-6 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#000000"
                    d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"
                  />
                </svg>
              }
              iconPosition="left"
            >
              {isConnecting === 'apple' ? 'Connecting...' : 'Apple Calendar'}
            </Button>
          </div>
    </StandardModal>

    {/* Apple Calendar Setup Modal */}
    <AppleCalendarSetupModal
      isOpen={isAppleModalOpen}
      onClose={() => setIsAppleModalOpen(false)}
      onConnect={handleAppleCalendarConnect}
    />
    </>
  );
};
