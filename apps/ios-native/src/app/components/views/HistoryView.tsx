/**
 * HistoryView component - Displays the list of saved contacts
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useScreenRefresh } from '../../../client/hooks/use-screen-refresh';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';
import type { RootStackParamList } from '../../../../App';
import { ScreenTransition, useGoBackWithFade, useNavigateWithFade } from '../ui/layout/ScreenTransition';
import type { SavedContact } from '../../context/ProfileContext';
import { ClientProfileService } from '../../../client/firebase/firebase-save';
import { getOptimalProfileImageUrl } from '@nektus/shared-client';
import { generateProfileColors } from '../../../shared/colors';
import { useSession } from '../../providers/SessionProvider';
import { useProfile } from '../../context/ProfileContext';
import { PageHeader } from '../ui/layout/PageHeader';
import { Button } from '../ui/buttons/Button';
import { ItemChip } from '../ui/modules/ItemChip';
import { StandardModal } from '../ui/modals/StandardModal';
import { AddCalendarModal } from '../ui/modals/AddCalendarModal';
import { Heading, BodyText, textSizes, fontStyles } from '../ui/Typography';
import Avatar from '../ui/elements/Avatar';

type HistoryViewNavigationProp = NativeStackNavigationProp<RootStackParamList, 'History'>;

/**
 * Format the match date for display
 */
const formatMatchDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  // Compare by calendar day in local timezone (not raw ms difference)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const timeString = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return `Today • ${timeString}`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  } else {
    const day = date.getDate();
    const ordinal = (d: number) => {
      if (d > 3 && d < 21) return 'th';
      switch (d % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const year = date.getFullYear();
    return `${month} ${day}${ordinal(day)}, ${year}`;
  }
};

// Empty state icon (white)
const EmptyIcon = () => (
  <Svg width={64} height={64} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={1.5}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
    />
  </Svg>
);

export function HistoryView() {
  const navigation = useNavigation<HistoryViewNavigationProp>();
  const goBackWithFade = useGoBackWithFade();
  const navigateWithFade = useNavigateWithFade();
  const { data: session } = useSession();
  const { contacts, contactsLoading, profile: userProfile } = useProfile();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<SavedContact | null>(null);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const [showAddCalendarModal, setShowAddCalendarModal] = useState(false);
  const [calendarContact, setCalendarContact] = useState<SavedContact | null>(null);

  // Pull-to-refresh (no-op: contacts are live via onSnapshot)
  const { isRefreshing, handleRefresh } = useScreenRefresh({
    onRefresh: async () => {},
  });

  // Wait for contacts to load via onSnapshot
  useEffect(() => {
    if (!session?.user?.id) {
      navigation.goBack();
      return;
    }

    if (!contactsLoading) {
      setIsLoading(false);
    }
  }, [session, navigation, contactsLoading]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    goBackWithFade();
  }, [goBackWithFade]);

  // Handle contact tap
  const handleContactTap = useCallback((contact: SavedContact) => {
    navigateWithFade('Contact', {
      userId: contact.userId,
      token: '',
      isHistoricalMode: true,
      backgroundColors: contact.backgroundColors,
    });
  }, [navigateWithFade]);

  // Handle long press for delete
  const handleLongPress = useCallback((contact: SavedContact) => {
    setContactToDelete(contact);
    setShowDeleteModal(true);
  }, []);

  // Handle delete confirmation
  const handleDeleteContact = useCallback(async () => {
    if (!contactToDelete || !session?.user?.id) return;

    setDeletingContactId(contactToDelete.userId);
    setShowDeleteModal(false);

    try {
      await ClientProfileService.deleteContact(session.user.id, contactToDelete.userId);
      // onSnapshot will auto-update the contacts list
    } catch (err) {
      console.error('[HistoryView] Failed to delete contact:', err);
      setError('Failed to delete contact');
    } finally {
      setDeletingContactId(null);
      setContactToDelete(null);
    }
  }, [contactToDelete, session]);

  // Handle cancel delete
  const handleCancelDelete = useCallback(() => {
    setShowDeleteModal(false);
    setContactToDelete(null);
  }, []);

  // Handle calendar/schedule action - check for linked calendar first (matches web)
  const handleCalendarClick = useCallback((contact: SavedContact) => {
    if (!session?.user?.id) return;

    // Check if user has a calendar for this contact's type
    const userHasCalendar = userProfile?.calendars?.some(
      (cal) => cal.section === contact.contactType
    );

    if (userHasCalendar) {
      navigateWithFade('SmartSchedule', {
        contactUserId: contact.userId,
        backgroundColors: contact.backgroundColors,
      });
    } else {
      // Store contact and show Add Calendar modal
      setCalendarContact(contact);
      setShowAddCalendarModal(true);
    }
  }, [navigateWithFade, session?.user?.id, userProfile?.calendars]);

  // Handle calendar added from modal - navigate to smart schedule
  const handleCalendarAdded = useCallback(() => {
    setShowAddCalendarModal(false);
    if (calendarContact) {
      navigateWithFade('SmartSchedule', {
        contactUserId: calendarContact.userId,
        backgroundColors: calendarContact.backgroundColors,
      });
      setCalendarContact(null);
    }
  }, [calendarContact, navigateWithFade]);

  // Render contact item
  const renderContactItem = ({ item }: { item: SavedContact }) => {
    return (
      <ItemChip
        icon={
          <Avatar
            src={getOptimalProfileImageUrl(item.profileImage, 128)}
            alt={item.odtName}
            sizeNumeric={40}
            showInitials={!item.profileImage}
            profileColors={
              item.backgroundColors?.length === 3
                ? item.backgroundColors as [string, string, string]
                : item.odtName ? generateProfileColors(item.odtName) : undefined
            }
          />
        }
        title={item.odtName || 'They-who-must-not-be-named'}
        subtitle={formatMatchDate(item.addedAt)}
        truncateTitle
        onClick={() => handleContactTap(item)}
        onLongPress={() => handleLongPress(item)}
        actionIcon="calendar"
        isActionLoading={deletingContactId === item.userId}
        onActionClick={() => handleCalendarClick(item)}
      />
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <PageHeader title="History" onBack={handleBack} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <PageHeader title="History" onBack={handleBack} />
        <View style={styles.errorContainer}>
          <BodyText style={styles.errorText}>{error}</BodyText>
          <Button
            variant="white"
            size="xl"
            onPress={() => {
              setError(null);
              // Contacts are live via onSnapshot — just clear error state
            }}
            style={styles.retryButton}
          >
            Let me try that again
          </Button>
        </View>
      </View>
    );
  }

  return (
    <ScreenTransition>
      <View style={styles.container}>
        <PageHeader title="History" onBack={handleBack} />

        {!contacts || contacts.length === 0 ? (
          // Empty state
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <EmptyIcon />
            </View>
            <Heading variant="h3" style={styles.emptyTitle}>It's quiet in here...</Heading>
            <BodyText variant="small" style={styles.emptySubtitle}>
              Your future friends are waiting. Go bump into someone.
            </BodyText>
            <Button
              variant="white"
              size="xl"
              onPress={handleBack}
              style={styles.startButton}
            >
              Let's go
            </Button>
          </View>
        ) : (
          // Contact list
          <FlatList
            data={contacts || []}
            renderItem={renderContactItem}
            keyExtractor={(item) => item.userId}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor="#22c55e"
              />
            }
          />
        )}
      </View>

      {/* Delete Confirmation Modal */}
      {contactToDelete && (
        <StandardModal
          isOpen={showDeleteModal}
          onClose={handleCancelDelete}
          title={`Remove ${contactToDelete.odtName}?`}
          subtitle="They'll disappear from your history for good."
          primaryButtonText="Remove"
          onPrimaryButtonClick={handleDeleteContact}
          secondaryButtonText="Never mind"
          showCloseButton={false}
        />
      )}

      {/* Add Calendar Modal - shown when user taps calendar without a linked calendar */}
      <AddCalendarModal
        isOpen={showAddCalendarModal}
        onClose={() => {
          setShowAddCalendarModal(false);
          setCalendarContact(null);
        }}
        section={calendarContact?.contactType || 'personal'}
        userEmail={session?.user?.email || userProfile?.contactEntries?.find((f: any) => f.fieldType === 'email')?.value || ''}
        onCalendarAdded={handleCalendarAdded}
      />
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    paddingHorizontal: 16,
  },
  errorText: {
    color: '#EF4444',
    ...textSizes.base,
    ...fontStyles.regular,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    width: '100%',
  },
  emptyContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 48,
    paddingHorizontal: 16,
  },
  emptyIconContainer: {
    marginBottom: 24,
  },
  emptyTitle: {
    marginBottom: 8, // Match web's mb-2
  },
  emptySubtitle: {
    textAlign: 'center',
    marginBottom: 24, // Match web's mb-6
    maxWidth: 384, // Match web's max-w-sm
  },
  startButton: {
    width: '100%',
  },
  listContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  separator: {
    height: 12,
  },
});

export default HistoryView;
