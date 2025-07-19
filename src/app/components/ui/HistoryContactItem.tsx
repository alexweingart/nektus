/**
 * HistoryContactItem component - Individual contact item for the history list
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Avatar from './Avatar';
import { generateMessageText, openMessagingAppDirectly } from '@/lib/services/client/messagingService';
import { useSession } from 'next-auth/react';
import type { SavedContact } from '@/types/contactExchange';

interface HistoryContactItemProps {
  contact: SavedContact;
}

export const HistoryContactItem: React.FC<HistoryContactItemProps> = ({ contact }) => {
  const router = useRouter();
  const { data: session } = useSession();

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

  const handleMessageTap = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent contact tap when clicking message button
    
    if (!session?.user?.name) {
      console.warn('Cannot send message: no user session');
      return;
    }

    const senderFirstName = session.user.name.split(' ')[0];
    const contactFirstName = contact.name.split(' ')[0];
    const messageText = generateMessageText(contactFirstName, senderFirstName);
    
    // Try to use phone number if available
    const phoneNumber = contact.contactChannels?.phoneInfo?.internationalPhone;
    
    openMessagingAppDirectly(messageText, phoneNumber);
  };

  return (
    <div 
      className="flex items-center p-4 bg-black/40 rounded-2xl backdrop-blur-sm cursor-pointer transition-all duration-200 hover:bg-black/50 active:scale-98"
      onClick={handleContactTap}
    >
      {/* Avatar */}
      <Avatar
        src={contact.profileImage}
        alt={contact.name}
        size="sm"
        className="flex-shrink-0"
      />
      
      {/* Contact Info */}
      <div className="flex-1 ml-4 min-w-0">
        <h3 className="text-white font-medium text-lg truncate">
          {contact.name}
        </h3>
        <p className="text-gray-300 text-sm truncate">
          {formatMatchDate(contact.addedAt)}
        </p>
      </div>
      
      {/* Message Button */}
      <button
        onClick={handleMessageTap}
        className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 border border-white/40 flex items-center justify-center transition-all duration-200 hover:bg-white/30 active:scale-95"
        aria-label={`Message ${contact.name}`}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-5 w-5 text-white" 
          viewBox="0 0 20 20" 
          fill="currentColor"
        >
          <path 
            fillRule="evenodd" 
            d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" 
            clipRule="evenodd" 
          />
        </svg>
      </button>
    </div>
  );
}; 