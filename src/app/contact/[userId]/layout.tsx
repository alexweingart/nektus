'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useProfile } from '@/app/context/ProfileContext';
import type { SavedContact } from '@/types/contactExchange';

/**
 * Layout for contact pages - applies contact's background image
 * Shared across: /contact/[userId], /contact/[userId]/smart-schedule, /contact/[userId]/ai-schedule
 */
export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const { data: session } = useSession();
  const { getContact, loadContacts } = useProfile();
  const contactUserId = params.userId as string;
  const [contactProfile, setContactProfile] = useState<SavedContact | null>(null);

  useEffect(() => {
    async function loadContact() {
      if (!session?.user?.id || !contactUserId) {
        return;
      }

      try {
        // Check cache first
        let savedContact = getContact(contactUserId);

        if (!savedContact) {
          // Not in cache, load all contacts (this will populate cache)
          const allContacts = await loadContacts(session.user.id);
          savedContact = allContacts.find(c => c.userId === contactUserId) || null;
        }

        if (savedContact) {
          setContactProfile(savedContact);

          // Dispatch match-found event for LayoutBackground with contact's background colors
          if (savedContact.backgroundColors) {
            window.dispatchEvent(new CustomEvent('match-found', {
              detail: { backgroundColors: savedContact.backgroundColors }
            }));
          } else {
            // Contact doesn't have backgroundColors - extract from their profile image
            try {
              const response = await fetch(`/api/contacts/${contactUserId}/colors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              });

              if (response.ok) {
                const data = await response.json();
                if (data.success && data.backgroundColors) {
                  window.dispatchEvent(new CustomEvent('match-found', {
                    detail: { backgroundColors: data.backgroundColors }
                  }));
                }
              }
            } catch {
              // Color extraction failed silently - will use fallback colors
            }
          }
        }
      } catch (error) {
        console.error('🎨 ContactLayout: Error loading contact for background:', error);
      }
    }

    loadContact();
  }, [session?.user?.id, contactUserId, getContact, loadContacts]);

  // Apply contact's background using CSS variables and classes
  useEffect(() => {
    if (!contactProfile) {
      return;
    }

    // Always hide user background when on contact page
    document.body.classList.remove('has-user-background');

    if (contactProfile.backgroundImage) {
      // Set CSS variable for contact background
      const cleanedUrl = contactProfile.backgroundImage.replace(/[\n\r\t]/g, '').trim();
      document.documentElement.style.setProperty('--contact-background-image', `url("${cleanedUrl}")`);

      // Show contact background via CSS class
      document.body.classList.add('show-contact-background');
    } else {
      // No contact background, remove class (will show green pattern)
      document.body.classList.remove('show-contact-background');
    }

    // Cleanup function - restore user background when leaving
    return () => {
      document.body.classList.remove('show-contact-background');
      document.body.classList.add('has-user-background');

      // Remove CSS variable after transition completes (1s to match CSS transition)
      setTimeout(() => {
        document.documentElement.style.removeProperty('--contact-background-image');
      }, 1000);
    };
  }, [contactProfile?.backgroundImage]);

  return <>{children}</>;
}
