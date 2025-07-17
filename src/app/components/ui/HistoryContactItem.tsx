/**
 * HistoryContactItem component - Individual contact item for the history list
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Avatar from './Avatar';
import { generateMessageText, openMessagingAppDirectly } from '@/lib/services/messagingService';
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
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const handleContactTap = () => {
    // Navigate to connect page with historical mode parameter
    router.push(`/connect?token=${contact.matchToken}&mode=historical`);
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
      className="flex items-center p-4 bg-white/5 rounded-xl backdrop-blur-sm border border-white/10 cursor-pointer transition-all duration-200 hover:bg-white/10 active:scale-98"
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
          Matched {formatMatchDate(contact.addedAt)}
        </p>
      </div>
      
      {/* Message Button */}
      <button
        onClick={handleMessageTap}
        className="flex-shrink-0 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center transition-all duration-200 hover:bg-white/20 active:scale-95"
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