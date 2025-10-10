/**
 * HistoryContactItem component - Individual contact item for the history list
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Avatar from './Avatar';
import { useSession } from 'next-auth/react';
import type { SavedContact } from '@/types/contactExchange';
import { getFieldValue } from '@/lib/utils/profileTransforms';
import { AddCalendarModal } from './modals/AddCalendarModal';
import { ItemChip } from './ItemChip';

interface HistoryContactItemProps {
  contact: SavedContact;
}

export const HistoryContactItem: React.FC<HistoryContactItemProps> = ({ contact }) => {
  const router = useRouter();
  const { data: session } = useSession();
  const [showAddCalendarModal, setShowAddCalendarModal] = useState(false);

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

  const handleContactTap = () => {
    // Navigate to the new contact page using userId
    router.push(`/contact/${contact.userId}`);
  };

  // Phase 4: Calendar button handler
  const handleCalendarClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent contact tap when clicking calendar button

    if (!session?.user?.id) {
      console.warn('Cannot schedule: no user session');
      return;
    }

    try {
      // Fetch user's profile to check for calendar
      const response = await fetch(`/api/profile/${session.user.id}`);
      if (!response.ok) {
        console.error('Failed to fetch user profile');
        return;
      }
      const userProfile = await response.json();

      // Check if user has calendar for this contact's type
      const userHasCalendar = userProfile.calendars?.some(
        (cal: any) => cal.section === contact.contactType
      );

      if (userHasCalendar) {
        // Navigate to smart-schedule page
        router.push(`/contact/${contact.userId}/smart-schedule`);
      } else {
        // Open Add Calendar modal
        setShowAddCalendarModal(true);
      }
    } catch (error) {
      console.error('Error checking calendar:', error);
    }
  };

  const handleCalendarAdded = () => {
    setShowAddCalendarModal(false);
    // After calendar is added, navigate to smart-schedule
    router.push(`/contact/${contact.userId}/smart-schedule`);
  };

  return (
    <>
      <ItemChip
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
        onClick={handleContactTap}
        onActionClick={handleCalendarClick}
        actionIcon="calendar"
      />

      {/* Add Calendar Modal */}
      <AddCalendarModal
        isOpen={showAddCalendarModal}
        onClose={() => setShowAddCalendarModal(false)}
        section={contact.contactType}
        userEmail={session?.user?.email || ''}
        onCalendarAdded={handleCalendarAdded}
      />
    </>
  );
}; 