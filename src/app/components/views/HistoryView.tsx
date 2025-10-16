/**
 * HistoryView component - Displays the list of historical contacts
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '../ui/buttons/Button';
import { LoadingSpinner } from '../ui/elements/LoadingSpinner';
import { ItemChip } from '../ui/modules/ItemChip';
import Avatar from '../ui/elements/Avatar';
import { AddCalendarModal } from '../ui/modals/AddCalendarModal';
import { Heading, Text } from '../ui/Typography';
import { ClientProfileService } from '@/lib/firebase/clientProfileService';
import { useProfile } from '@/app/context/ProfileContext';
import { getFieldValue } from '@/lib/utils/profileTransforms';
import type { SavedContact } from '@/types/contactExchange';
import { FaArrowLeft } from 'react-icons/fa';
import { auth } from '@/lib/firebase/clientConfig';

export const HistoryView: React.FC = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const { profile: userProfile } = useProfile();
  const [contacts, setContacts] = useState<SavedContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddCalendarModal, setShowAddCalendarModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<SavedContact | null>(null);
  const hasFetchedSlotsRef = useRef(false);

  // Fetch contacts on component mount
  useEffect(() => {
    const fetchContacts = async () => {
      if (!session?.user?.id) {
        console.log('No session or user ID, redirecting to home');
        router.push('/');
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        console.log('🔍 Fetching contacts for user:', session.user.id);
        const userContacts = await ClientProfileService.getContacts(session.user.id);

        // Sort contacts by addedAt timestamp (newest first)
        const sortedContacts = userContacts.sort((a, b) => b.addedAt - a.addedAt);

        console.log('✅ Loaded contacts:', sortedContacts.length);
        setContacts(sortedContacts);

      } catch (error) {
        console.error('Failed to load contacts:', error);
        setError('Failed to load contact history');
      } finally {
        setIsLoading(false);
      }
    };

    fetchContacts();
  }, [session, router]);

  // Pre-fetch common time slots for recent contacts (proactive caching for scheduling)
  useEffect(() => {
    const preFetchCommonTimeSlotsForContacts = async () => {
      if (!session?.user?.id || !auth?.currentUser || contacts.length === 0) return;
      if (hasFetchedSlotsRef.current) return; // Already fetched

      hasFetchedSlotsRef.current = true;

      // Pre-fetch for up to 3 most recent contacts to avoid too many requests
      const recentContacts = contacts.slice(0, 3);

      for (const contact of recentContacts) {
        // Only pre-fetch if user has calendar for this contact type
        const userHasCalendar = userProfile?.calendars?.some(
          (cal) => cal.section === contact.contactType
        );

        if (!userHasCalendar) continue;

        try {
          console.log(`🔄 Proactively pre-fetching common time slots for ${getFieldValue(contact.contactEntries, 'name')}...`);
          const idToken = await auth.currentUser.getIdToken();

          const response = await fetch('/api/scheduling/common-times', {
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
          });

          if (response.ok) {
            const data = await response.json();
            const slots = data.slots || [];
            console.log(`✅ Pre-fetched ${slots.length} slots for ${getFieldValue(contact.contactEntries, 'name')}`);
          }
        } catch (error) {
          console.log(`Pre-fetch failed for ${getFieldValue(contact.contactEntries, 'name')} (non-critical)`);
        }
      }
    };

    preFetchCommonTimeSlotsForContacts();
  }, [contacts, session?.user?.id, userProfile?.calendars]);

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    // Re-trigger the effect by updating a dependency
    setTimeout(() => {
      window.location.reload();
    }, 100);
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
    // Navigate to the new contact page using userId
    router.push(`/contact/${contact.userId}`);
  };

  const handleCalendarClick = (e: React.MouseEvent, contact: SavedContact) => {
    e.stopPropagation(); // Prevent contact tap when clicking calendar button

    if (!session?.user?.id) {
      console.warn('Cannot schedule: no user session');
      return;
    }

    // Check if user has calendar for this contact's type using ProfileContext
    const userHasCalendar = userProfile?.calendars?.some(
      (cal) => cal.section === contact.contactType
    );

    if (userHasCalendar) {
      // Navigate to smart-schedule page with 'from' parameter
      router.push(`/contact/${contact.userId}/smart-schedule?from=history`);
    } else {
      // Open Add Calendar modal
      setSelectedContact(contact);
      setShowAddCalendarModal(true);
    }
  };

  const handleCalendarAdded = () => {
    setShowAddCalendarModal(false);
    if (selectedContact) {
      // After calendar is added, navigate to smart-schedule with 'from' parameter
      router.push(`/contact/${selectedContact.userId}/smart-schedule?from=history`);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-dvh flex flex-col items-center px-4 py-2">
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

        {/* Loading content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <LoadingSpinner size="sm" className="mx-auto mb-4" />
            <Text variant="small" className="text-gray-300">Loading your contact history...</Text>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-dvh flex flex-col items-center px-4 py-2">
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
    <div className="min-h-dvh flex flex-col items-center px-4 py-2">
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
                  className="h-16 w-16 mx-auto text-gray-400" 
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
              <Heading as="h2" className="text-lg font-medium mb-2">No contacts yet</Heading>
              <Text variant="small" className="text-gray-300 mb-6">
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
                    src={contact.profileImage}
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
                actionIcon="calendar"
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
        />
      )}
    </div>
  );
}; 