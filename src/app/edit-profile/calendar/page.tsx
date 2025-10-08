/**
 * Edit Calendar Page - Edit schedulable hours for a specific calendar
 * Part of Phase 3: Calendar Management
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useProfile } from '@/app/context/ProfileContext';
import { PageContainer } from '@/app/components/ui/PageContainer';
import { TopBar } from '@/app/components/ui/TopBar';
import { Heading, Text } from '@/app/components/ui/Typography';
import { Button } from '@/app/components/ui/buttons/Button';
import { SecondaryButton } from '@/app/components/ui/buttons/SecondaryButton';
import { SchedulableHoursEditor } from '@/app/components/ui/calendar/SchedulableHoursEditor';
import type { Calendar, SchedulableHours } from '@/types/profile';

export default function EditCalendarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, saveProfile, isLoading } = useProfile();
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Get calendar ID from URL params
  const calendarId = searchParams.get('id');

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
          ? { ...cal, schedulableHours: editedHours, updatedAt: Date.now() }
          : cal
      );

      await saveProfile({ calendars: updatedCalendars });
      router.push('/edit-profile');
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

      // TODO: Also revoke OAuth tokens if needed
      // For now, just remove from profile

      router.push('/edit-profile');
    } catch (error) {
      console.error('Error deleting calendar:', error);
      alert('Failed to delete calendar. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'google':
        return (
          <svg className="w-8 h-8" viewBox="0 0 24 24">
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
        );
      case 'microsoft':
        return (
          <svg className="w-8 h-8" viewBox="0 0 24 24">
            <path fill="#F25022" d="M1 1h10v10H1z" />
            <path fill="#7FBA00" d="M13 1h10v10H13z" />
            <path fill="#00A4EF" d="M1 13h10v10H1z" />
            <path fill="#FFB900" d="M13 13h10v10H13z" />
          </svg>
        );
      case 'apple':
        return (
          <svg className="w-8 h-8" viewBox="0 0 24 24">
            <path
              fill="#FFFFFF"
              d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"
            />
          </svg>
        );
      default:
        return null;
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

  if (isLoading) {
    return (
      <PageContainer>
        <TopBar title="Edit Calendar" backButton />
        <div className="p-6">
          <Text className="text-white/60">Loading...</Text>
        </div>
      </PageContainer>
    );
  }

  if (!calendar) {
    return (
      <PageContainer>
        <TopBar title="Edit Calendar" backButton />
        <div className="p-6">
          <Text className="text-white/60">Calendar not found</Text>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <TopBar title="Edit Calendar" backButton />

      <div className="p-6 space-y-6">
        {/* Calendar Info */}
        <div className="flex items-center gap-3">
          {getProviderIcon(calendar.provider)}
          <div>
            <Text className="font-medium text-white">{getProviderName(calendar.provider)}</Text>
            <Text variant="small" className="text-white/60">
              {calendar.email}
            </Text>
          </div>
        </div>

        {/* Schedulable Hours Section */}
        <div>
          <Heading as="h3" className="mb-4">
            Available Hours
          </Heading>
          {editedHours && (
            <SchedulableHoursEditor
              schedulableHours={editedHours}
              onChange={setEditedHours}
            />
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-4">
          <Button
            variant="white"
            className="w-full"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>

          {!showDeleteConfirm ? (
            <SecondaryButton
              variant="dark"
              className="w-full text-red-500"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete Calendar
            </SecondaryButton>
          ) : (
            <div className="space-y-2">
              <Text variant="small" className="text-center text-red-400">
                Are you sure? This will permanently remove this calendar.
              </Text>
              <div className="flex gap-2">
                <SecondaryButton
                  variant="dark"
                  className="flex-1"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </SecondaryButton>
                <Button
                  variant="white"
                  className="flex-1 !bg-red-500 !text-white hover:!bg-red-600"
                  onClick={handleDelete}
                  disabled={isSaving}
                >
                  {isSaving ? 'Deleting...' : 'Confirm Delete'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
