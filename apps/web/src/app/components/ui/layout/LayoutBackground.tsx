'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useProfile } from '../../../context/ProfileContext';
import { ParticleNetwork } from './ParticleNetwork';
import type { ParticleNetworkProps } from './ParticleNetwork';

interface ContactProfile {
  backgroundColors?: string[];
}

/**
 * Helper function to convert hex color to rgba with alpha
 */
function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Convert background colors array to ParticleNetwork colors using Option A mapping
 * @param backgroundColors Array of [dominant, accent1, accent2]
 * @returns ParticleNetwork color configuration
 */
function convertToParticleColors(backgroundColors: string[]) {
  const [dominant, accent1, accent2] = backgroundColors;

  return {
    gradientStart: hexToRgba(accent1, 0.4),      // Bright accent at top
    gradientEnd: dominant,                       // Main color fills background
    particle: hexToRgba(accent2, 0.6),          // Bright particles
    connection: hexToRgba(accent2, 0.15)        // Subtle connections (same hue as particles)
  };
}

/**
 * Default inverted colors for profile-style backgrounds (dark at top, light at bottom)
 * Used for contacts without custom backgrounds
 */
const DEFAULT_COLORS_INVERTED = {
  particle: 'rgba(200, 255, 200, 0.6)',
  connection: 'rgba(34, 197, 94, 0.15)',
  gradientStart: '#0a0f1a',                 // Dark at top
  gradientEnd: 'rgba(34, 197, 94, 0.3)'     // Light green at bottom
};

/**
 * Background manager that orchestrates ParticleNetwork with context-aware settings
 * and personalized colors extracted from profile images.
 *
 * V2: Simplified to just render ParticleNetwork + children, no wrapper div.
 */
export function LayoutBackground({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const { profile, isLoading, isNavigatingFromSetup, getContact } = useProfile();
  const pathname = usePathname();
  const params = useParams();
  const [mounted, setMounted] = useState(false);
  const [contactProfile, setContactProfile] = useState<ContactProfile | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen for match-found event to capture contact profile data (for /connect route)
  useEffect(() => {
    const handleMatchFound = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { backgroundColors } = customEvent.detail || {};

      if (backgroundColors) {
        setContactProfile({ backgroundColors });
      }
    };

    window.addEventListener('match-found', handleMatchFound as EventListener);
    return () => {
      window.removeEventListener('match-found', handleMatchFound as EventListener);
    };
  }, []);

  // Load contact colors from URL for contact routes (/contact/[userId]/*)
  useEffect(() => {
    const isContactRoute = pathname?.startsWith('/contact/') && params?.userId;

    if (isContactRoute && getContact) {
      const userId = params.userId as string;
      const contact = getContact(userId);

      if (contact?.backgroundColors) {
        setContactProfile({ backgroundColors: contact.backgroundColors });
      } else {
        // Clear contact profile if navigating to a contact without colors
        setContactProfile(null);
      }
    }
  }, [pathname, params?.userId, getContact]);

  // Clear contact profile when navigating away from contact pages
  useEffect(() => {
    const isOnContactPage = pathname === '/connect' || pathname?.startsWith('/contact/');

    if (!isOnContactPage && contactProfile) {
      // Clear after a delay to allow transition
      const timeout = setTimeout(() => {
        setContactProfile(null);
      }, 1000);

      return () => clearTimeout(timeout);
    }
  }, [pathname, contactProfile]);

  // Set default background CSS variable for prefers-reduced-motion fallback
  useEffect(() => {
    if (!mounted) return;

    document.documentElement.style.setProperty('--default-background-image', 'url("/DefaultBackgroundImage.png")');

    return () => {
      document.documentElement.style.removeProperty('--default-background-image');
    };
  }, [mounted]);

  // Update safe area colors for contact pages
  useEffect(() => {
    if (!mounted) return;

    const isOnContactPage = pathname === '/connect' || pathname?.startsWith('/contact/');
    const contactColors = contactProfile?.backgroundColors;
    const userColors = profile?.backgroundColors;

    if (isOnContactPage && contactColors && contactColors.length >= 3) {
      // On contact page with contact colors - use contact's dominant color
      const [dominant] = contactColors;
      document.documentElement.style.backgroundColor = dominant;
      console.log('[LayoutBackground] Setting contact safe area color:', dominant);
    } else if (!isOnContactPage && userColors && userColors.length >= 3) {
      // Left contact page - reset to user's dominant color
      const [dominant] = userColors;
      document.documentElement.style.backgroundColor = dominant;
      console.log('[LayoutBackground] Resetting to user safe area color:', dominant);
    }
  }, [mounted, pathname, contactProfile, profile]);

  // Determine context and background colors
  const getParticleNetworkProps = useCallback((): ParticleNetworkProps => {
    // Wait for INITIAL session check only
    // Ignore status 'loading' if we already have a session (prevents flash during session refresh)
    if (status === 'loading' && !session) {
      return { context: 'signed-out' };
    }

    // Signed out
    if (!session) {
      return { context: 'signed-out' };
    }

    // Special case: setup page should use inverted gradient like profile
    if (pathname === '/setup') {
      return { context: 'profile-default' };
    }

    // Signed in - wait for profile to load
    // UNLESS navigating from setup (prevent flash during profile load)
    if (isLoading && !isNavigatingFromSetup) {
      return { context: 'signed-out' };
    }

    // Determine if on contact page
    const isOnContactPage = pathname === '/connect' || pathname.startsWith('/contact/');

    if (isOnContactPage) {
      // Contact page logic
      const contactColors = contactProfile?.backgroundColors;

      if (contactColors && contactColors.length >= 3) {
        // Use contact's colors
        const particleColors = convertToParticleColors(contactColors);
        return {
          colors: particleColors,
          context: pathname === '/connect' ? 'connect' : 'contact'
        };
      } else {
        // No contact colors - use default inverted gradient (profile-style)
        return {
          colors: DEFAULT_COLORS_INVERTED,
          context: pathname === '/connect' ? 'connect' : 'contact'
        };
      }
    } else {
      // User profile page logic
      const userColors = profile?.backgroundColors;

      if (userColors && userColors.length >= 3) {
        return {
          colors: convertToParticleColors(userColors),
          context: 'profile'
        };
      } else {
        return {
          context: 'profile-default'
        };
      }
    }
  }, [status, session, isLoading, isNavigatingFromSetup, pathname, profile, contactProfile]);

  // Manage default background visibility for prefers-reduced-motion fallback
  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const updateDefaultBackground = () => {
      if (mediaQuery.matches) {
        // Show default background for reduced motion users
        document.body.classList.add('show-default-background');
      } else {
        // Hide default background for normal users (ParticleNetwork shows instead)
        document.body.classList.remove('show-default-background');
      }
    };

    updateDefaultBackground();
    mediaQuery.addEventListener('change', updateDefaultBackground);

    return () => {
      mediaQuery.removeEventListener('change', updateDefaultBackground);
      document.body.classList.remove('show-default-background');
    };
  }, [mounted]);

  if (!mounted) {
    return null;
  }

  const particleProps = getParticleNetworkProps();

  // V2: No wrapper div - ParticleNetwork is fixed, children scroll naturally
  return (
    <>
      <ParticleNetwork {...particleProps} />
      {children}
    </>
  );
}
