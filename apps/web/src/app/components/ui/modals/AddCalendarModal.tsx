/**
 * AddCalendarModal - Modal for selecting calendar provider
 * Adapted from CalConnect's CalendarProviderButtons for Nekt styling
 */

'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
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
  redirectTo?: string; // Optional: where to redirect after OAuth success (defaults to current page)
}

export const AddCalendarModal: React.FC<AddCalendarModalProps> = ({
  isOpen,
  onClose,
  section,
  userEmail,
  onCalendarAdded,
  redirectTo
}) => {
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [isAppleModalOpen, setIsAppleModalOpen] = useState(false);
  const isAndroid = useMemo(() => /android/i.test(navigator.userAgent), []);

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

      if (provider === 'google') {
        // Redirect to Google OAuth using incremental authorization
        // Use NEXT_PUBLIC_BASE_URL to ensure consistent OAuth redirect regardless of how user accessed the site
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
        const currentUrl = window.location.pathname + window.location.search;
        const params = new URLSearchParams({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID!,
          redirect_uri: `${baseUrl}/api/calendar-connections/google/callback`,
          response_type: 'code',
          scope: 'https://www.googleapis.com/auth/calendar',
          access_type: 'offline',
          include_granted_scopes: 'true', // Key for incremental auth - keeps existing permissions
          login_hint: userEmail, // Suggest the correct account
          prompt: 'none', // Try silent auth first — zero taps if already authorized.
          // Server callback falls back to interactive if Google returns interaction_required.
          state: encodeURIComponent(JSON.stringify({
            userEmail,
            section,
            returnUrl: currentUrl, // Fallback for errors
            redirectTo: redirectTo || currentUrl // Where to go on success
          }))
        });

        window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      } else if (provider === 'microsoft') {
        // Redirect to Microsoft OAuth
        // Use NEXT_PUBLIC_BASE_URL to ensure consistent OAuth redirect regardless of how user accessed the site
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
        const currentUrl = window.location.pathname + window.location.search;
        const params = new URLSearchParams({
          client_id: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID!,
          redirect_uri: `${baseUrl}/api/calendar-connections/microsoft/callback`,
          response_type: 'code',
          scope: 'https://graph.microsoft.com/Calendars.ReadWrite https://graph.microsoft.com/User.Read openid profile email offline_access',
          login_hint: userEmail,
          // Omit prompt to skip picker when login_hint matches
          state: encodeURIComponent(JSON.stringify({
            userEmail,
            section,
            returnUrl: currentUrl, // Fallback for errors
            redirectTo: redirectTo || currentUrl // Where to go on success
          }))
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
      title="Connect your calendar"
      subtitle="Let Nekt find the perfect time. We only check when you're free — nothing else."
      showPrimaryButton={false}
      showSecondaryButton={true}
      secondaryButtonText="Never mind"
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
              icon={<Image src="/icons/auth/google.svg" alt="" width={24} height={24} className="flex-shrink-0" />}
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
              icon={<Image src="/icons/auth/microsoft.svg" alt="" width={24} height={24} className="flex-shrink-0" />}
              iconPosition="left"
            >
              {isConnecting === 'microsoft' ? 'Connecting...' : 'Microsoft Calendar'}
            </Button>

            {/* Apple Calendar - hidden on Android since CalDAV flow requires Apple ID */}
            {!isAndroid && (
            <Button
              variant="white"
              size="lg"
              className="w-full"
              onClick={() => handleAddCalendar('apple')}
              disabled={isConnecting === 'apple'}
              icon={<Image src="/icons/auth/apple.svg" alt="" width={24} height={24} className="flex-shrink-0" />}
              iconPosition="left"
            >
              {isConnecting === 'apple' ? 'Connecting...' : 'Apple Calendar'}
            </Button>
            )}
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
