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
import { getApiBaseUrl, getIdToken } from '../../../client/auth/firebase';
import { getOptimalProfileImageUrl } from '@nektus/shared-client';
import { useSession } from '../../providers/SessionProvider';
import { useProfile } from '../../context/ProfileContext';
import { PageHeader } from '../ui/layout/PageHeader';
import { Button } from '../ui/buttons/Button';
import { ItemChip } from '../ui/modules/ItemChip';
import { StandardModal } from '../ui/modals/StandardModal';
import { Heading, BodyText } from '../ui/Typography';
import Avatar from '../ui/elements/Avatar';

type HistoryViewNavigationProp = NativeStackNavigationProp<RootStackParamList, 'History'>;

/**
 * Format the match date for display
 */
const formatMatchDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

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
  const { contacts, loadContacts } = useProfile();
  const apiBaseUrl = getApiBaseUrl();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<SavedContact | null>(null);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);

  // Pull-to-refresh
  const { isRefreshing, handleRefresh } = useScreenRefresh({
    onRefresh: async () => {
      await loadContacts(true);
    },
  });

  // Load contacts on mount
  useEffect(() => {
    const fetchContacts = async () => {
      if (!session?.user?.id) {
        navigation.goBack();
        return;
      }

      try {
        setError(null);
        await loadContacts();
        setIsLoading(false);
      } catch (err) {
        console.error('[HistoryView] Failed to load contacts:', err);
        setError('Failed to load contact history');
        setIsLoading(false);
      }
    };

    fetchContacts();
  }, [session, navigation, loadContacts]);

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
      const idToken = await getIdToken();
      const response = await fetch(`${apiBaseUrl}/api/contacts/${contactToDelete.userId}`, {
        method: 'DELETE',
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      });

      if (!response.ok) {
        throw new Error('Failed to delete contact');
      }

      // Reload contacts with force refresh
      await loadContacts(true);
    } catch (err) {
      console.error('[HistoryView] Failed to delete contact:', err);
      setError('Failed to delete contact');
    } finally {
      setDeletingContactId(null);
      setContactToDelete(null);
    }
  }, [contactToDelete, session, apiBaseUrl, loadContacts]);

  // Handle cancel delete
  const handleCancelDelete = useCallback(() => {
    setShowDeleteModal(false);
    setContactToDelete(null);
  }, []);

  // Handle calendar/schedule action
  const handleCalendarClick = useCallback((contact: SavedContact) => {
    // Navigate directly to smart schedule for this contact
    navigateWithFade('SmartSchedule', {
      contactUserId: contact.userId,
      backgroundColors: contact.backgroundColors,
    });
  }, [navigateWithFade]);

  // Render contact item
  const renderContactItem = ({ item }: { item: SavedContact }) => {
    return (
      <ItemChip
        icon={
          <Avatar
            src={getOptimalProfileImageUrl(item.profileImage, 128)}
            alt={item.odtName}
            sizeNumeric={40}
          />
        }
        title={item.odtName || 'Unknown Contact'}
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
              setIsLoading(true);
              loadContacts().then(() => setIsLoading(false));
            }}
            style={styles.retryButton}
          >
            Try Again
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
            <Heading variant="h3" style={styles.emptyTitle}>No contacts yet</Heading>
            <BodyText variant="small" style={styles.emptySubtitle}>
              When you nekt with someone, they'll appear here so you can easily reconnect later.
            </BodyText>
            <Button
              variant="white"
              size="xl"
              onPress={handleBack}
              style={styles.startButton}
            >
              Start Nekt'ing
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
          title="Delete Contact?"
          subtitle={`Are you sure you want to delete ${contactToDelete.odtName}? This cannot be undone.`}
          primaryButtonText="Delete"
          onPrimaryButtonClick={handleDeleteContact}
          secondaryButtonText="Cancel"
          showCloseButton={false}
        />
      )}
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
    fontSize: 16,
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
