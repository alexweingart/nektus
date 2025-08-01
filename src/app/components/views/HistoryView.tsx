/**
 * HistoryView component - Displays the list of historical contacts
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '../ui/buttons/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { HistoryContactItem } from '../ui/HistoryContactItem';
import { Heading, Text } from '../ui/Typography';
import { ClientProfileService } from '@/lib/firebase/clientProfileService';
import type { SavedContact } from '@/types/contactExchange';
import { FaArrowLeft } from 'react-icons/fa';

export const HistoryView: React.FC = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const [contacts, setContacts] = useState<SavedContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
              variant="theme"
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
                When you nekt with someone, they'll appear here so you can easily reconnect later.
              </Text>
              <Button 
                onClick={handleGoBack}
                variant="theme"
                size="xl"
                className="w-full"
              >
                Start Nekt'ing
              </Button>
            </div>
          </div>
        ) : (
          // Contact list
          <div className="space-y-3">
            {contacts.map((contact) => (
              <HistoryContactItem
                key={contact.userId}
                contact={contact}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}; 