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
        console.log('🎨 ContactLayout: Missing session or userId', { session: !!session?.user?.id, contactUserId });
        return;
      }

      try {
        console.log('🎨 ContactLayout: Loading contact for background...', contactUserId);

        // Check cache first
        let savedContact = getContact(contactUserId);

        if (!savedContact) {
          // Not in cache, load all contacts (this will populate cache)
          console.log('📦 [ContactLayout] Contact not in cache, loading...');
          const allContacts = await loadContacts(session.user.id);
          savedContact = allContacts.find(c => c.userId === contactUserId) || null;
        } else {
          console.log('📦 [ContactLayout] Using cached contact');
        }

        if (savedContact) {
          console.log('🎨 ContactLayout: Found contact:', savedContact.userId, 'Background:', savedContact.backgroundImage ? 'Yes' : 'No');
          setContactProfile(savedContact);
        } else {
          console.log('🎨 ContactLayout: Contact not found in saved contacts');
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
      console.log('🎨 ContactLayout: No contact profile yet');
      return;
    }

    // Always hide user background when on contact page
    document.body.classList.remove('has-user-background');
    console.log('🎨 ContactLayout: Hiding user background');

    if (contactProfile.backgroundImage) {
      // Set CSS variable for contact background
      const cleanedUrl = contactProfile.backgroundImage.replace(/[\n\r\t]/g, '').trim();
      console.log('🎨 ContactLayout: Setting contact background:', cleanedUrl);
      document.documentElement.style.setProperty('--contact-background-image', `url("${cleanedUrl}")`);

      // Show contact background via CSS class
      document.body.classList.add('show-contact-background');
      console.log('🎨 ContactLayout: Added show-contact-background class');
    } else {
      console.log('🎨 ContactLayout: No background image, green pattern will show');
      // No contact background, remove class (will show green pattern)
      document.body.classList.remove('show-contact-background');
    }

    // Cleanup function - restore user background when leaving
    return () => {
      console.log('🎨 ContactLayout: Cleaning up background, restoring user background');
      document.body.classList.remove('show-contact-background');
      document.body.classList.add('has-user-background');
      document.documentElement.style.removeProperty('--contact-background-image');
    };
  }, [contactProfile?.backgroundImage]);

  return <>{children}</>;
}
