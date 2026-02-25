'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useProfile } from '@/app/context/ProfileContext';
import { hexToRgb } from '@/client/cn';

/**
 * Layout for contact pages - applies contact's background image
 * Shared across: /c/[code], /c/[code]/smart-schedule, /c/[code]/ai-schedule
 */
export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const { data: session } = useSession();
  const { profile: userProfile } = useProfile();
  const code = params.code as string;
  const [contactBackgroundColors, setContactBackgroundColors] = useState<string[] | null>(null);

  // Fetch profile colors by shortCode
  useEffect(() => {
    async function fetchProfileColors() {
      if (!session || !code) return;

      try {
        const response = await fetch(`/api/profile/shortcode/${code}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.profile?.backgroundColors) {
            setContactBackgroundColors(data.profile.backgroundColors);

            // Dispatch match-found event for background colors
            window.dispatchEvent(new CustomEvent('match-found', {
              detail: { backgroundColors: data.profile.backgroundColors }
            }));
          }
        }
      } catch (error) {
        console.error('[ContactLayout] Error fetching profile colors:', error);
      }
    }

    fetchProfileColors();
  }, [session, code]);

  // Liquid Glass: Clear user's tint immediately on mount, apply contact's when loaded
  useEffect(() => {
    // Clear user's color right away so it doesn't show on the contact page
    document.documentElement.style.removeProperty('--glass-tint-color');

    // Cleanup: Restore user's color when leaving contact page
    return () => {
      if (userProfile?.backgroundColors) {
        const userColor = userProfile.backgroundColors[0];
        if (userColor) {
          const rgb = hexToRgb(userColor);
          const rgbString = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
          document.documentElement.style.setProperty('--glass-tint-color', rgbString);
        }
      } else {
        document.documentElement.style.removeProperty('--glass-tint-color');
      }
    };
  }, [userProfile?.backgroundColors]);

  // Apply contact's glass tint once their colors load
  useEffect(() => {
    if (contactBackgroundColors) {
      const contactColor = contactBackgroundColors[0];
      if (contactColor) {
        const rgb = hexToRgb(contactColor);
        const rgbString = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
        document.documentElement.style.setProperty('--glass-tint-color', rgbString);
      }
    }
  }, [contactBackgroundColors]);

  return <>{children}</>;
}
