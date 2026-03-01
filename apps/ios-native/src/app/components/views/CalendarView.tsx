/**
 * CalendarView - View and edit a connected calendar
 * Allows editing schedulable hours and deleting the calendar
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Linking,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useScreenRefresh } from '../../../client/hooks/use-screen-refresh';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../../App';
import type { SchedulableHours, Calendar } from '@nektus/shared-types';
import { useProfile } from '../../context/ProfileContext';
import { PageHeader } from '../ui/layout/PageHeader';
import { ScreenTransition, useGoBackWithFade } from '../ui/layout/ScreenTransition';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import { SchedulableHoursEditor } from '../ui/calendar/SchedulableHoursEditor';
import { textSizes, fontStyles } from '../ui/Typography';

type CalendarViewNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Calendar'>;
type CalendarViewRouteProp = RouteProp<RootStackParamList, 'Calendar'>;

/**
 * Get display name for calendar provider
 */
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

/**
 * Get URL to open the calendar provider's web interface
 */
const getCalendarUrl = (provider: string) => {
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

export function CalendarView() {
  const navigation = useNavigation<CalendarViewNavigationProp>();
  const route = useRoute<CalendarViewRouteProp>();
  const goBackWithFade = useGoBackWithFade();
  const { section } = route.params;
  const { profile, saveProfile, isLoading: profileLoading } = useProfile();

  const [isSaving, setIsSaving] = useState(false);
  const [editedHours, setEditedHours] = useState<SchedulableHours | null>(null);

  // Find the calendar for this section
  const calendar = profile?.calendars?.find((cal: Calendar) => cal.section === section);

  // Pull-to-refresh — profile is live via onSnapshot, just reset local edits
  const { refreshControl } = useScreenRefresh({
    onRefresh: async () => {
      setEditedHours(calendar?.schedulableHours || null);
    },
  });


  // Initialize edited hours when calendar is loaded
  useEffect(() => {
    if (calendar && !editedHours) {
      setEditedHours(calendar.schedulableHours);
    }
  }, [calendar, editedHours]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    goBackWithFade();
  }, [goBackWithFade]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!calendar || !editedHours || !profile) return;

    setIsSaving(true);
    try {
      // Update calendar in profile
      const updatedCalendars = profile.calendars?.map((cal: Calendar) =>
        cal.section === section
          ? { ...cal, schedulableHours: editedHours, updatedAt: new Date() }
          : cal
      );

      await saveProfile({ calendars: updatedCalendars });
      goBackWithFade();
    } catch (error) {
      console.error('[CalendarView] Error saving calendar:', error);
      Alert.alert('Error', 'Failed to save calendar. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [calendar, editedHours, profile, section, saveProfile, goBackWithFade]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!calendar || !profile) return;

    Alert.alert(
      'Delete Calendar',
      `Are you sure you want to remove ${getProviderName(calendar.provider)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsSaving(true);
            try {
              // Remove calendar from profile
              const updatedCalendars = profile.calendars?.filter(
                (cal: Calendar) => cal.section !== section
              );

              await saveProfile({ calendars: updatedCalendars });
              goBackWithFade();
            } catch (error) {
              console.error('[CalendarView] Error deleting calendar:', error);
              Alert.alert('Error', 'Failed to delete calendar. Please try again.');
            } finally {
              setIsSaving(false);
            }
          },
        },
      ]
    );
  }, [calendar, profile, section, saveProfile, goBackWithFade]);

  // Handle opening calendar provider
  const handleOpenProvider = useCallback(() => {
    if (!calendar) return;
    const url = getCalendarUrl(calendar.provider);
    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Could not open calendar');
      });
    }
  }, [calendar]);

  // Loading state
  if (profileLoading) {
    return (
      <ScreenTransition>
        <View style={styles.container}>
          <PageHeader title="Edit Calendar" onBack={handleBack} />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        </View>
      </ScreenTransition>
    );
  }

  // Calendar not found
  if (!calendar) {
    return (
      <ScreenTransition>
        <View style={styles.container}>
          <PageHeader title="Edit Calendar" onBack={handleBack} />
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Calendar not found</Text>
          </View>
        </View>
      </ScreenTransition>
    );
  }

  return (
    <ScreenTransition>
      <View style={styles.container}>
      <PageHeader
        title="Edit Calendar"
        onBack={handleBack}
        onSave={handleSave}
        isSaving={isSaving}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {/* Calendar Info */}
        <View style={styles.calendarInfo}>
          <Text style={styles.providerName} onPress={handleOpenProvider}>
            {getProviderName(calendar.provider)}
          </Text>
          <Text style={styles.email}>{calendar.email}</Text>
        </View>

        {/* Schedulable Hours Editor */}
        <View style={styles.editorContainer}>
          {editedHours && (
            <SchedulableHoursEditor
              schedulableHours={editedHours}
              onChange={setEditedHours}
            />
          )}
        </View>

        {/* Delete Button */}
        <View style={styles.footer}>
          <SecondaryButton
            variant="destructive"
            onPress={handleDelete}
            disabled={isSaving}
          >
            {isSaving ? 'Deleting...' : 'Delete'}
          </SecondaryButton>
        </View>
      </ScrollView>
      </View>
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: 'rgba(255, 255, 255, 0.6)',
    ...textSizes.base,
    ...fontStyles.regular,
  },
  calendarInfo: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  providerName: {
    color: '#ffffff',
    ...textSizes.lg,
    ...fontStyles.bold,
  },
  email: {
    color: 'rgba(255, 255, 255, 0.6)',
    ...textSizes.sm,
    ...fontStyles.regular,
    marginTop: 4,
  },
  editorContainer: {
    flex: 1,
    paddingTop: 16,
  },
  footer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
});

export default CalendarView;
