import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { UserProfile } from '@/types/profile';

interface UseCalendarLocationManagementProps {
  profile: UserProfile | null;
  saveProfile: (data: Partial<UserProfile>) => Promise<UserProfile | null>;
  onSaveProfile?: () => Promise<void>;
}

export function useCalendarLocationManagement({
  profile,
  saveProfile,
  onSaveProfile
}: UseCalendarLocationManagementProps) {
  const router = useRouter();

  // Modal state
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [modalSection, setModalSection] = useState<'personal' | 'work'>('personal');

  // Helper functions to get calendar/location for a section
  const getCalendarForSection = useCallback((section: 'personal' | 'work') => {
    return profile?.calendars?.find((cal) => cal.section === section && (cal.section === 'personal' || cal.section === 'work'));
  }, [profile]);

  const getLocationForSection = useCallback((section: 'personal' | 'work') => {
    return profile?.locations?.find((loc) => loc.section === section && (loc.section === 'personal' || loc.section === 'work'));
  }, [profile]);

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

    // Reload page to show newly added calendar (matches Google/Microsoft OAuth flow)
    window.location.reload();
  }, []);

  const handleLocationAdded = useCallback(async (locations: any[]) => {
    // Update profile locations directly (locations are special, not regular fields)
    if (profile) {
      profile.locations = profile.locations || [];
      locations.forEach(loc => {
        // Remove existing location for this section if any
        profile.locations = profile.locations!.filter((l: any) => l.section !== loc.section);
        // Add the new location
        profile.locations!.push(loc);
      });
    }

    setIsLocationModalOpen(false);

    // Trigger profile save
    if (onSaveProfile) {
      await onSaveProfile();
    }
  }, [profile, onSaveProfile]);

  const handleDeleteCalendar = useCallback(async (section: 'personal' | 'work') => {
    const calendar = getCalendarForSection(section);
    if (!calendar) return;

    try {
      const response = await fetch(`/api/calendar-connections/${calendar.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete calendar');

      // Update profile state to remove the deleted calendar
      if (saveProfile && profile) {
        const updatedCalendars = profile.calendars?.filter((cal: any) => cal.id !== calendar.id) || [];
        await saveProfile({ calendars: updatedCalendars });
      }
    } catch (error) {
      console.error('[useCalendarLocationManagement] Failed to delete calendar:', error);
    }
  }, [getCalendarForSection, saveProfile, profile]);

  const handleDeleteLocation = useCallback(async (section: 'personal' | 'work') => {
    const location = getLocationForSection(section);
    if (!location) return;

    try {
      // Update profile state to remove the deleted location
      if (saveProfile && profile) {
        const updatedLocations = profile.locations?.filter((loc: any) => loc.id !== location.id) || [];
        await saveProfile({ locations: updatedLocations });
      }
    } catch (error) {
      console.error('[useCalendarLocationManagement] Failed to delete location:', error);
    }
  }, [getLocationForSection, saveProfile, profile]);

  return {
    // Modal state
    isCalendarModalOpen,
    isLocationModalOpen,
    modalSection,
    setIsCalendarModalOpen,
    setIsLocationModalOpen,

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

    // Router for navigation
    router
  };
}
