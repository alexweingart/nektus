import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { UserProfile, UserLocation, Calendar } from '@/types/profile';

interface UseCalendarLocationManagementProps {
  profile: UserProfile | null;
  saveProfile: (data: Partial<UserProfile>) => Promise<UserProfile | null>;
}

export function useCalendarLocationManagement({
  profile,
  saveProfile
}: UseCalendarLocationManagementProps) {
  const router = useRouter();

  // Detect successful OAuth calendar addition on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const calendarAdded = urlParams.get('calendar');

    if (calendarAdded === 'added') {
      console.log('[useCalendarLocationManagement] Calendar added via OAuth, reloading...');

      // Clean up URL parameter
      urlParams.delete('calendar');
      const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : '');
      window.history.replaceState({}, '', newUrl);

      // Reload to fetch updated profile with new calendar
      window.location.reload();
    }
  }, []);

  // Modal state
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [modalSection, setModalSection] = useState<'personal' | 'work'>('personal');

  // Loading state for delete operations
  const [isDeletingCalendar, setIsDeletingCalendar] = useState<{ personal: boolean; work: boolean }>({
    personal: false,
    work: false
  });
  const [isDeletingLocation, setIsDeletingLocation] = useState<{ personal: boolean; work: boolean }>({
    personal: false,
    work: false
  });

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

  const handleLocationAdded = useCallback(async (locations: UserLocation[]) => {
    setIsLocationModalOpen(false);

    // Update profile locations (merge with existing locations)
    if (profile && saveProfile) {
      const updatedLocations = profile.locations || [];

      locations.forEach(loc => {
        // Remove existing location for this section if any
        const filtered = updatedLocations.filter((l: UserLocation) => l.section !== loc.section);
        filtered.push(loc);
        updatedLocations.length = 0;
        updatedLocations.push(...filtered);
      });

      // Save to Firebase
      await saveProfile({ locations: updatedLocations });
    }
  }, [profile, saveProfile]);

  const handleDeleteCalendar = useCallback(async (section: 'personal' | 'work') => {
    const calendar = getCalendarForSection(section);
    if (!calendar) return;

    // Set loading state
    setIsDeletingCalendar(prev => ({ ...prev, [section]: true }));

    try {
      const response = await fetch(`/api/calendar-connections/${calendar.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete calendar');

      // Update profile state to remove the deleted calendar
      if (saveProfile && profile) {
        const updatedCalendars = profile.calendars?.filter((cal: Calendar) => cal.id !== calendar.id) || [];
        await saveProfile({ calendars: updatedCalendars });
      }
    } catch (error) {
      console.error('[useCalendarLocationManagement] Failed to delete calendar:', error);
    } finally {
      // Clear loading state
      setIsDeletingCalendar(prev => ({ ...prev, [section]: false }));
    }
  }, [getCalendarForSection, saveProfile, profile]);

  const handleDeleteLocation = useCallback(async (section: 'personal' | 'work') => {
    const location = getLocationForSection(section);
    if (!location) return;

    // Set loading state
    setIsDeletingLocation(prev => ({ ...prev, [section]: true }));

    try {
      // Update profile state to remove the deleted location
      if (saveProfile && profile) {
        const updatedLocations = profile.locations?.filter((loc: UserLocation) => loc.id !== location.id) || [];
        await saveProfile({ locations: updatedLocations });
      }
    } catch (error) {
      console.error('[useCalendarLocationManagement] Failed to delete location:', error);
    } finally {
      // Clear loading state
      setIsDeletingLocation(prev => ({ ...prev, [section]: false }));
    }
  }, [getLocationForSection, saveProfile, profile]);

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

    // Router for navigation
    router
  };
}
