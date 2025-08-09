'use client';

import { useEffect, useState } from 'react';
import { useProfile } from '../../context/ProfileContext';

/**
 * Layout-level background manager
 * Renders persistent custom background div for authenticated users with background images
 * Allows the background to persist across profile page navigations
 */
export function LayoutBackground() {
  const { profile } = useProfile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Apply/remove body background class for clean CSS override
  useEffect(() => {
    if (!mounted) return;

    if (profile?.backgroundImage) {
      // Add CSS class to hide body's green pattern background
      document.body.classList.add('has-custom-background');
    } else {
      // Remove CSS class to restore body's default green pattern
      document.body.classList.remove('has-custom-background');
    }

    return () => {
      // Cleanup: always remove the class when component unmounts
      document.body.classList.remove('has-custom-background');
    };
  }, [mounted, profile?.backgroundImage]);

  // Don't render on server or if no background image
  if (!mounted || !profile?.backgroundImage) {
    return null;
  }

  // Clean the URL and add cache busting for Firebase Storage URLs
  let cleanedUrl = profile.backgroundImage.replace(/[\n\r\t]/g, '').trim();
  if (cleanedUrl.includes('firebase') || cleanedUrl.includes('googleusercontent.com')) {
    const separator = cleanedUrl.includes('?') ? '&' : '?';
    cleanedUrl = `${cleanedUrl}${separator}v=${Date.now()}`;
  }

  return (
    <div
      id="layout-background"
      className="custom-background-overlay"
      style={{
        backgroundImage: `url("${cleanedUrl}")`,
      }}
    />
  );
}