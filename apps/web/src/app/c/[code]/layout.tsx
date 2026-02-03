'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useProfile } from '@/app/context/ProfileContext';
import { hexToRgb } from '@/client/cn';
import { BRAND_DARK_GREEN_RGB } from '@/shared/colors';

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

  // Liquid Glass: Override global color with contact's color
  useEffect(() => {
    if (contactBackgroundColors) {
      // Use accent2 to match particle dots
      const contactColor = contactBackgroundColors[2] || contactBackgroundColors[1] || contactBackgroundColors[0];
      if (contactColor) {
        const rgb = hexToRgb(contactColor);
        const rgbString = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
        console.log('[ContactLayout] Overriding glass tint with contact color:', contactColor, '->', rgbString);
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
          console.log('[ContactLayout] Restoring user color on unmount:', userColor, '->', rgbString);
          document.documentElement.style.setProperty('--glass-tint-color', rgbString);
        }
      } else {
        // No user colors, reset to default green
        console.log('[ContactLayout] Restoring default green on unmount');
        document.documentElement.style.setProperty('--glass-tint-color', BRAND_DARK_GREEN_RGB);
      }
    };
  }, [contactBackgroundColors, userProfile?.backgroundColors]);

  return <>{children}</>;
}
