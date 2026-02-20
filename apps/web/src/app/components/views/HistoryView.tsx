/**
 * HistoryView component - Displays the list of historical contacts
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '../ui/buttons/Button';
import { ItemChip } from '../ui/modules/ItemChip';
import Avatar from '../ui/elements/Avatar';
import { AddCalendarModal } from '../ui/modals/AddCalendarModal';
import { StandardModal } from '../ui/modals/StandardModal';
import { Heading, Text } from '../ui/Typography';
import { useProfile } from '@/app/context/ProfileContext';
import { getFieldValue } from '@/client/profile/transforms';
import { getOptimalProfileImageUrl } from '@/client/profile/image';
import type { SavedContact } from '@/types/contactExchange';
import { FaArrowLeft } from 'react-icons/fa';
import { auth } from '@/client/config/firebase';
import { ClientProfileService } from '@/client/profile/firebase-save';
import { useCalendarLocationManagement } from '@/client/hooks/use-calendar-location-management';
import { CACHE_TTL } from '@nektus/shared-client';

// Module-level tracking for pre-fetch cooldown
let lastPreFetchTime = 0;
const PRE_FETCH_COOLDOWN = CACHE_TTL.SHORT_MS;

export const HistoryView: React.FC = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const { profile: userProfile, getContacts, contactsLoading } = useProfile();
  const contacts = getContacts();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddCalendarModal, setShowAddCalendarModal] = useState(false);
  const [showCalendarAddedModal, setShowCalendarAddedModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<SavedContact | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<SavedContact | null>(null);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const hasFetchedSlotsRef = useRef(false);

  // Calendar/location management with OAuth callback for smart-schedule navigation
  useCalendarLocationManagement({
    profile: userProfile,
    saveProfile: async () => null, // Not needed for HistoryView
    onCalendarAddedViaOAuth: () => {
      // Get the contact that was being scheduled from sessionStorage
      const contactIdForScheduling = sessionStorage.getItem('calendar-contact-id');

      if (contactIdForScheduling) {
        sessionStorage.removeItem('calendar-contact-id');
        router.push(`/c/${contactIdForScheduling}/smart-schedule?from=history`);
      }
    }
  });


  // Wait for contacts to load via onSnapshot
  useEffect(() => {
    if (!session?.user?.id) {
      router.push('/');
      return;
    }

    if (!contactsLoading) {
      setIsLoading(false);
    }
  }, [session, router, contactsLoading]);

  // Pre-fetch common time slots for recent contacts (truly non-blocking background process)
  useEffect(() => {
    if (!session?.user?.id || !auth?.currentUser || contacts.length === 0) return;
    if (hasFetchedSlotsRef.current) return; // Already fetched in this mount

    // Check if we recently pre-fetched (cooldown using module-level variable)
    const timeSinceLastFetch = Date.now() - lastPreFetchTime;
    if (timeSinceLastFetch < PRE_FETCH_COOLDOWN) {
      hasFetchedSlotsRef.current = true;
      return;
    }

    hasFetchedSlotsRef.current = true;
    lastPreFetchTime = Date.now();

    // Get recent contacts (synchronous but trivial)
    const recentContacts = contacts.slice(0, 3);

    // Schedule each fetch independently with staggered timing to avoid blocking
    recentContacts.forEach((contact, index) => {
      // Use requestIdleCallback with staggered timeouts to ensure no blocking
      const scheduleDelay = index * 100; // Stagger by 100ms each

      const scheduleFetch = () => {
        const userHasCalendar = userProfile?.calendars?.some(
          (cal) => cal.section === contact.contactType
        );

        if (!userHasCalendar) return;

        // Execute fetch in truly async manner (no blocking)
        if (!auth?.currentUser) return;
        auth.currentUser.getIdToken()
          .then(idToken => fetch('/api/scheduling/common-times', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              user1Id: session.user.id,
              user2Id: contact.userId,
              duration: 30,
              calendarType: contact.contactType,
            }),
          }))
          .then(response => {
            if (response.ok) {
              return response.json();
            }
          })
          .catch(() => {
            // Pre-fetch failed (non-critical)
          });
      };

      // Use requestIdleCallback if available, with staggered fallback
      if ('requestIdleCallback' in window) {
        setTimeout(() => {
          requestIdleCallback(scheduleFetch, { timeout: 5000 });
        }, scheduleDelay);
      } else {
        setTimeout(scheduleFetch, scheduleDelay);
      }
    });
  }, [contacts, session?.user?.id, userProfile?.calendars]);

  const handleRetry = () => {
    setError(null);
    window.location.reload();
  };

  const handleGoBack = () => {
    router.push('/');
  };

  // Format the match date
  const formatMatchDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Today - show time
      const timeString = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      return `Today • ${timeString}`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      // Within the last week - show day of week
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
      // Greater than 6 days old - show date with ordinal
      const day = date.getDate();
      const ordinal = (day: number) => {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
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

  const handleContactTap = (contact: SavedContact) => {
    // Prefer shortCode for cleaner URLs, fall back to userId
    const code = contact.shortCode;
    router.push(`/c/${code}`);
  };

  const handleCalendarClick = (e: React.MouseEvent, contact: SavedContact) => {
    e.stopPropagation(); // Prevent contact tap when clicking calendar button

    if (!session?.user?.id) {
      return;
    }

    // Check if user has calendar for this contact's type using ProfileContext
    const userHasCalendar = userProfile?.calendars?.some(
      (cal) => cal.section === contact.contactType
    );

    if (userHasCalendar) {
      const code = contact.shortCode;
      router.push(`/c/${code}/smart-schedule?from=history`);
    } else {
      // Store contact code for after calendar is added
      const code = contact.shortCode;
      sessionStorage.setItem('calendar-contact-id', code);
      setSelectedContact(contact);
      setShowAddCalendarModal(true);
    }
  };

  const handleCalendarAdded = () => {
    setShowAddCalendarModal(false);
    if (selectedContact) {
      const code = selectedContact.shortCode;
      router.push(`/c/${code}/smart-schedule?from=history`);
    }
  };

  const handleCalendarAddedContinue = () => {
    setShowCalendarAddedModal(false);

    if (selectedContact) {
      sessionStorage.removeItem('calendar-contact-id');
      const code = selectedContact.shortCode;
      router.push(`/c/${code}/smart-schedule?from=history`);
    }
  };

  // Long-press handler for delete
  const handleLongPress = (contact: SavedContact) => {
    setContactToDelete(contact);
    setShowDeleteModal(true);
  };

  const handleDeleteContact = async () => {
    if (!contactToDelete || !session?.user?.id) return;

    setDeletingContactId(contactToDelete.userId);
    setShowDeleteModal(false);

    try {
      await ClientProfileService.deleteContact(session.user.id, contactToDelete.userId);
      // onSnapshot will auto-update the contacts list
    } catch (error) {
      console.error('Failed to delete contact:', error);
      setError('Failed to delete contact. Please try again.');
    } finally {
      setDeletingContactId(null);
      setContactToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setContactToDelete(null);
  };

  // Loading state - show empty content
  if (isLoading) {
    return (
      <div className="flex flex-col items-center px-4 py-2">
        {/* Header */}
        <div className="w-full max-w-[var(--max-content-width,448px)] flex justify-between items-center py-4 flex-shrink-0">
          <Button
            variant="circle"
            size="icon"
            className="w-14 h-14"
            onClick={handleGoBack}
          >
            <FaArrowLeft className="h-5 w-5" />
          </Button>

          <Heading as="h1">History</Heading>

          <div className="w-14 h-14" /> {/* Spacer for centering */}
        </div>

        {/* Empty loading content */}
        <div className="flex-1" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center px-4 py-2">
        {/* Header */}
        <div className="w-full max-w-[var(--max-content-width,448px)] flex justify-between items-center py-4 flex-shrink-0">
          <Button 
            variant="circle"
            size="icon"
            className="w-14 h-14"
            onClick={handleGoBack}
          >
            <FaArrowLeft className="h-5 w-5" />
          </Button>
          
          <Heading as="h1">History</Heading>
          
          <div className="w-14 h-14" /> {/* Spacer for centering */}
        </div>

        {/* Error content */}
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <p className="text-red-400 mb-4">{error}</p>
            <Button
              onClick={handleRetry}
              variant="white"
              size="xl"
              className="w-full"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-4 py-2">
      {/* Header */}
      <div className="w-full max-w-[var(--max-content-width,448px)] flex justify-between items-center py-4 flex-shrink-0">
        <Button
          variant="circle"
          size="icon"
          className="w-14 h-14"
          onClick={handleGoBack}
        >
          <FaArrowLeft className="h-5 w-5" />
        </Button>

        <Heading as="h1">History</Heading>

        <div className="w-14 h-14" /> {/* Spacer for centering */}
      </div>

      {/* Content */}
      <div className="w-full max-w-[var(--max-content-width,448px)] flex-1">
        {contacts.length === 0 ? (
          // Empty state
          <div className="flex items-center justify-center h-full py-12">
            <div className="text-center max-w-sm">
              <div className="mb-6">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-16 w-16 mx-auto text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" 
                  />
                </svg>
              </div>
              <Heading as="h2" className="text-lg font-bold mb-2">No contacts yet</Heading>
              <Text variant="small" className="mb-6">
                When you nekt with someone, they&apos;ll appear here so you can easily reconnect later.
              </Text>
              <Button
                onClick={handleGoBack}
                variant="white"
                size="xl"
                className="w-full"
              >
                Start Nekt&apos;ing
              </Button>
            </div>
          </div>
        ) : (
          // Contact list
          <div className="space-y-3">
            {contacts.map((contact) => (
              <ItemChip
                key={contact.userId}
                icon={
                  <Avatar
                    src={getOptimalProfileImageUrl(contact.profileImage, 128)}
                    alt={getFieldValue(contact.contactEntries, 'name')}
                    size="sm"
                    className="flex-shrink-0 !w-10 !h-10"
                  />
                }
                title={getFieldValue(contact.contactEntries, 'name')}
                subtitle={formatMatchDate(contact.addedAt)}
                truncateTitle
                onClick={() => handleContactTap(contact)}
                onActionClick={(e) => handleCalendarClick(e, contact)}
                onLongPress={() => handleLongPress(contact)}
                actionIcon="calendar"
                isActionLoading={deletingContactId === contact.userId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Calendar Modal */}
      {selectedContact && (
        <AddCalendarModal
          isOpen={showAddCalendarModal}
          onClose={() => setShowAddCalendarModal(false)}
          section={selectedContact.contactType}
          userEmail={session?.user?.email || ''}
          onCalendarAdded={handleCalendarAdded}
          redirectTo={`/c/${selectedContact.shortCode}/smart-schedule?from=history`}
        />
      )}

      {/* Calendar Added Success Modal */}
      <StandardModal
        isOpen={showCalendarAddedModal}
        onClose={() => setShowCalendarAddedModal(false)}
        title="Calendar Connected! 🎉"
        subtitle="Your calendar has been connected successfully. Let's find a time to meet up!"
        primaryButtonText="Find a time"
        onPrimaryButtonClick={handleCalendarAddedContinue}
        showSecondaryButton={false}
        showCloseButton={false}
      />

      {/* Delete Contact Confirmation Modal */}
      {contactToDelete && (
        <StandardModal
          isOpen={showDeleteModal}
          onClose={handleCancelDelete}
          title="Delete Contact?"
          subtitle={`Are you sure you want to delete ${getFieldValue(contactToDelete.contactEntries, 'name')}? This cannot be undone.`}
          primaryButtonText="Delete"
          onPrimaryButtonClick={handleDeleteContact}
          secondaryButtonText="Cancel"
          onSecondaryButtonClick={handleCancelDelete}
          showCloseButton={false}
        />
      )}
    </div>
  );
}; 