'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/app/context/ProfileContext';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import { Text } from '@/app/components/ui/Typography';
import { SecondaryButton } from '@/app/components/ui/buttons/SecondaryButton';
import { SchedulableHoursEditor } from '@/app/components/ui/calendar/SchedulableHoursEditor';
import type { SchedulableHours } from '@/types/profile';

interface CalendarViewProps {
  calendarId: string;
}

export default function CalendarView({ calendarId }: CalendarViewProps) {
  const router = useRouter();
  const { profile, saveProfile, isLoading } = useProfile();
  const [isSaving, setIsSaving] = useState(false);

  // Find the calendar
  const calendar = profile?.calendars?.find(cal => cal.id === calendarId);
  const [editedHours, setEditedHours] = useState<SchedulableHours | null>(null);

  // Initialize edited hours when calendar is loaded
  useEffect(() => {
    if (calendar && !editedHours) {
      setEditedHours(calendar.schedulableHours);
    }
  }, [calendar, editedHours]);

  const handleSave = async () => {
    if (!calendar || !editedHours || !profile) return;

    setIsSaving(true);
    try {
      // Update calendar in profile
      const updatedCalendars = profile.calendars?.map(cal =>
        cal.id === calendarId
          ? { ...cal, schedulableHours: editedHours, updatedAt: new Date() }
          : cal
      );

      await saveProfile({ calendars: updatedCalendars });
      router.push('/edit');
    } catch (error) {
      console.error('Error saving calendar:', error);
      alert('Failed to save calendar. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!calendar || !profile) return;

    setIsSaving(true);
    try {
      // Remove calendar from profile
      const updatedCalendars = profile.calendars?.filter(cal => cal.id !== calendarId);

      await saveProfile({ calendars: updatedCalendars });

      router.push('/edit');
    } catch (error) {
      console.error('Error deleting calendar:', error);
      alert('Failed to delete calendar. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'google':
        return 'Google Calendar';
      case 'microsoft':
        return 'Microsoft Calendar';
      case 'apple':
        return 'Apple Calendar';
      default:
        return 'Calendar';
    }
  };

  const getCalendarUrl = (provider: string, _email: string) => {
    switch (provider) {
      case 'google':
        return 'https://calendar.google.com';
      case 'microsoft':
        return 'https://outlook.live.com/calendar';
      case 'apple':
        return 'https://www.icloud.com/calendar';
      default:
        return null;
    }
  };

  const handleBack = () => {
    router.back();
  };

  if (!calendar && !isLoading) {
    return (
      <div>
        <div className="max-w-2xl mx-auto px-6">
          <PageHeader title="Edit Calendar" onBack={handleBack} />
          <div className="py-6">
            <Text className="text-white/60">Calendar not found</Text>
          </div>
        </div>
      </div>
    );
  }

  if (!calendar) {
    return null;
  }

  return (
    <div className="flex flex-col items-center px-4 py-2 pb-8 relative">
      <div className="w-full max-w-[var(--max-content-width,448px)] space-y-5">
        <PageHeader
          title="Edit Calendar"
          onBack={handleBack}
          onSave={handleSave}
          isSaving={isSaving}
        />

        <div className="space-y-6">
        {/* Calendar Info - Clickable to open calendar */}
        <div
          className="flex flex-col items-center justify-center text-center cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => {
            const calendarUrl = getCalendarUrl(calendar.provider, calendar.email);
            if (calendarUrl) window.location.href = calendarUrl;
          }}
        >
          <Text className="font-bold text-white">{getProviderName(calendar.provider)}</Text>
          <Text variant="small" className="text-white/60">
            {calendar.email}
          </Text>
        </div>

        {/* Schedulable Hours Section */}
        <div>
          {editedHours && (
            <SchedulableHoursEditor
              schedulableHours={editedHours}
              onChange={setEditedHours}
            />
          )}
        </div>

        {/* Actions */}
        <div className="mt-5 text-center">
          <SecondaryButton
            variant="destructive"
            onClick={handleDelete}
            disabled={isSaving}
          >
            {isSaving ? 'Deleting...' : 'Delete'}
          </SecondaryButton>
        </div>
        </div>
      </div>
    </div>
  );
}
