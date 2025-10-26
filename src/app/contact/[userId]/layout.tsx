'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ClientProfileService } from '@/lib/firebase/clientProfileService';
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
  const contactUserId = params.userId as string;
  const [contactProfile, setContactProfile] = useState<SavedContact | null>(null);

  useEffect(() => {
    async function loadContact() {
      if (!session?.user?.id || !contactUserId) return;

      try {
        const contacts = await ClientProfileService.getContacts(session.user.id);
        const savedContact = contacts.find((c: SavedContact) => c.userId === contactUserId);

        if (savedContact) {
          setContactProfile(savedContact);
        }
      } catch (error) {
        console.error('Error loading contact for background:', error);
      }
    }

    loadContact();
  }, [session?.user?.id, contactUserId]);

  // Apply contact's background image
  useEffect(() => {
    if (!contactProfile) return;

    try {
      // Remove any existing contact background div from previous contact
      const existingContactBg = document.getElementById('contact-background');
      if (existingContactBg) {
        existingContactBg.remove();
      }

      // Remove default background class from body
      document.body.classList.remove('default-nekt-background');
      document.body.style.background = '';

      if (contactProfile.backgroundImage) {
        // Create background div with contact's background image
        const cleanedUrl = contactProfile.backgroundImage.replace(/[\n\r\t]/g, '').trim();
        const backgroundDiv = document.createElement('div');
        backgroundDiv.id = 'contact-background';
        backgroundDiv.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: url(${cleanedUrl});
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          z-index: 1;
          pointer-events: none;
        `;
        document.body.appendChild(backgroundDiv);
      } else {
        // No contact background image, use default green pattern
        document.body.classList.add('default-nekt-background');
      }

      // Cleanup function
      return () => {
        try {
          const bgDiv = document.getElementById('contact-background');
          if (bgDiv) {
            bgDiv.remove();
          }
          document.body.classList.remove('default-nekt-background');
          document.body.style.background = '';
        } catch {
          // Error cleaning up background
        }
      };
    } catch {
      // Error applying contact background
    }
  }, [contactProfile?.backgroundImage, contactProfile]);

  return <>{children}</>;
}
