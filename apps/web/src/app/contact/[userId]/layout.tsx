'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useProfile } from '@/app/context/ProfileContext';
import type { SavedContact } from '@/types/contactExchange';
import { hexToRgb } from '@/lib/cn';

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
  const { profile: userProfile, getContact, loadContacts } = useProfile();
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

          // Always dispatch match-found event to signal loading complete
          if (savedContact.backgroundColors) {
            window.dispatchEvent(new CustomEvent('match-found', {
              detail: { backgroundColors: savedContact.backgroundColors }
            }));
          } else {
            // No colors - dispatch empty event to signal completion
            window.dispatchEvent(new CustomEvent('match-found', {
              detail: {}
            }));

            // Try color extraction in background (non-blocking)
            fetch(`/api/contacts/${contactUserId}/colors`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              if (data?.success && data?.backgroundColors) {
                // Update with extracted colors
                window.dispatchEvent(new CustomEvent('match-found', {
                  detail: { backgroundColors: data.backgroundColors }
                }));
              }
            })
            .catch(() => {
              // Extraction failed - already using default
            });
          }
        }
      } catch (error) {
        console.error('🎨 ContactLayout: Error loading contact for background:', error);
      }
    }

    loadContact();
  }, [session?.user?.id, contactUserId, getContact, loadContacts]);

  // Liquid Glass: Override global color with contact's color
  useEffect(() => {
    if (contactProfile?.backgroundColors) {
      // Use accent2 to match particle dots
      const contactColor = contactProfile.backgroundColors[2] || contactProfile.backgroundColors[1] || contactProfile.backgroundColors[0];
      if (contactColor) {
        const rgb = hexToRgb(contactColor);
        const rgbString = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
        console.log('[ContactLayout] Overriding glass tint with contact color from backgroundColors[2]:', contactColor, '→', rgbString);
        document.documentElement.style.setProperty('--glass-tint-color', rgbString);
      }
    }

    // Cleanup: Restore user's color when leaving contact page
    return () => {
      if (userProfile?.backgroundColors) {
        const userColor = userProfile.backgroundColors[2] || userProfile.backgroundColors[1] || userProfile.backgroundColors[0];
        if (userColor) {
          const rgb = hexToRgb(userColor);
          const rgbString = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
          console.log('[ContactLayout] Restoring user color on unmount:', userColor, '→', rgbString);
          document.documentElement.style.setProperty('--glass-tint-color', rgbString);
        }
      } else {
        // No user colors, reset to default green
        console.log('[ContactLayout] Restoring default green on unmount');
        document.documentElement.style.setProperty('--glass-tint-color', '113, 228, 84');
      }
    };
  }, [contactProfile?.backgroundColors, userProfile?.backgroundColors]);

  return <>{children}</>;
}
