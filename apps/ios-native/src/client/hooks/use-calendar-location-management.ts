/**
 * Calendar Location Management Hook for iOS
 * Adapted from: apps/web/src/client/hooks/use-calendar-location-management.ts
 *
 * Changes from web:
 * - Uses React Navigation instead of Next.js router
 * - Uses API base URL for calendar deletion
 * - No URL parameter handling (handled differently in iOS)
 */

import { useState, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { UserProfile, UserLocation, Calendar } from '@nektus/shared-types';
import { getApiBaseUrl, getIdToken } from '../auth/firebase';

type RootStackParamList = {
  Calendar: { section: 'personal' | 'work' };
  Location: { section: 'personal' | 'work' };
  SmartSchedule: { contactUserId: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface UseCalendarLocationManagementProps {
  profile: UserProfile | null;
  saveProfile: (data: Partial<UserProfile>) => Promise<UserProfile | null>;
  onCalendarAddedViaOAuth?: () => void;
}

export function useCalendarLocationManagement({
  profile,
  saveProfile,
  onCalendarAddedViaOAuth,
}: UseCalendarLocationManagementProps) {
  const navigation = useNavigation<NavigationProp>();

  // Modal state
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [modalSection, setModalSection] = useState<'personal' | 'work'>('personal');

  // Loading state for delete operations
  const [isDeletingCalendar, setIsDeletingCalendar] = useState<{
    personal: boolean;
    work: boolean;
  }>({
    personal: false,
    work: false,
  });
  const [isDeletingLocation, setIsDeletingLocation] = useState<{
    personal: boolean;
    work: boolean;
  }>({
    personal: false,
    work: false,
  });

  // Helper functions to get calendar/location for a section
  const getCalendarForSection = useCallback(
    (section: 'personal' | 'work'): Calendar | undefined => {
      return profile?.calendars?.find((cal) => cal.section === section);
    },
    [profile]
  );

  const getLocationForSection = useCallback(
    (section: 'personal' | 'work'): UserLocation | undefined => {
      return profile?.locations?.find((loc) => loc.section === section);
    },
    [profile]
  );

  // Modal handlers
  const handleOpenCalendarModal = useCallback((section: 'personal' | 'work') => {
    setModalSection(section);
    setIsCalendarModalOpen(true);
  }, []);

  const handleOpenLocationModal = useCallback((section: 'personal' | 'work') => {
    setModalSection(section);
    setIsLocationModalOpen(true);
  }, []);

  const handleCalendarAdded = useCallback(async () => {
    // Calendar added via API in modal, close modal first
    setIsCalendarModalOpen(false);

    // Call the provided callback if available
    if (onCalendarAddedViaOAuth) {
      console.log('[useCalendarLocationManagement] Calling onCalendarAddedViaOAuth callback');
      onCalendarAddedViaOAuth();
    }
  }, [onCalendarAddedViaOAuth]);

  const handleLocationAdded = useCallback(
    async (locations: UserLocation[]) => {
      setIsLocationModalOpen(false);

      // Update profile locations (merge with existing locations)
      if (profile && saveProfile) {
        const updatedLocations = [...(profile.locations || [])];

        locations.forEach((loc) => {
          // Remove existing location for this section if any
          const filteredIndex = updatedLocations.findIndex(
            (l: UserLocation) => l.section === loc.section
          );
          if (filteredIndex >= 0) {
            updatedLocations.splice(filteredIndex, 1);
          }
          updatedLocations.push(loc);
        });

        // Save to Firebase
        await saveProfile({ locations: updatedLocations });
      }
    },
    [profile, saveProfile]
  );

  const handleDeleteCalendar = useCallback(
    async (section: 'personal' | 'work') => {
      const calendar = getCalendarForSection(section);
      if (!calendar) return;

      // Set loading state
      setIsDeletingCalendar((prev) => ({ ...prev, [section]: true }));

      try {
        const apiBaseUrl = getApiBaseUrl();
        const idToken = await getIdToken();

        const response = await fetch(
          `${apiBaseUrl}/api/calendar-connections/${calendar.id}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          }
        );

        if (!response.ok) throw new Error('Failed to delete calendar');

        // Update profile state to remove the deleted calendar
        if (saveProfile && profile) {
          const updatedCalendars =
            profile.calendars?.filter((cal: Calendar) => cal.id !== calendar.id) ||
            [];
          await saveProfile({ calendars: updatedCalendars });
        }
      } catch (error) {
        console.error('[useCalendarLocationManagement] Failed to delete calendar:', error);
      } finally {
        // Clear loading state
        setIsDeletingCalendar((prev) => ({ ...prev, [section]: false }));
      }
    },
    [getCalendarForSection, saveProfile, profile]
  );

  const handleDeleteLocation = useCallback(
    async (section: 'personal' | 'work') => {
      const location = getLocationForSection(section);
      if (!location) return;

      // Set loading state
      setIsDeletingLocation((prev) => ({ ...prev, [section]: true }));

      try {
        // Update profile state to remove the deleted location
        if (saveProfile && profile) {
          const updatedLocations =
            profile.locations?.filter(
              (loc: UserLocation) => loc.id !== location.id
            ) || [];
          await saveProfile({ locations: updatedLocations });
        }
      } catch (error) {
        console.error('[useCalendarLocationManagement] Failed to delete location:', error);
      } finally {
        // Clear loading state
        setIsDeletingLocation((prev) => ({ ...prev, [section]: false }));
      }
    },
    [getLocationForSection, saveProfile, profile]
  );

  return {
    // Modal state
    isCalendarModalOpen,
    isLocationModalOpen,
    modalSection,
    setIsCalendarModalOpen,
    setIsLocationModalOpen,

    // Loading state
    isDeletingCalendar,
    isDeletingLocation,

    // Getters
    getCalendarForSection,
    getLocationForSection,

    // Handlers
    handleOpenCalendarModal,
    handleOpenLocationModal,
    handleCalendarAdded,
    handleLocationAdded,
    handleDeleteCalendar,
    handleDeleteLocation,

    // Navigation for React Navigation
    navigation,
  };
}

export default useCalendarLocationManagement;
