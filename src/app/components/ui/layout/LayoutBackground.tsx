'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
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
 * Background manager that orchestrates ParticleNetwork with context-aware settings
 * and personalized colors extracted from profile images
 */
export function LayoutBackground() {
  const { data: session, status } = useSession();
  const { profile, isLoading } = useProfile();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [contactProfile, setContactProfile] = useState<ContactProfile | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen for match-found event to capture contact profile data
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

  // Clear contact profile when navigating away from contact pages
  useEffect(() => {
    const isOnContactPage = pathname === '/connect' || pathname.startsWith('/contact/');

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

  // Determine context and background colors
  const getParticleNetworkProps = useCallback((): ParticleNetworkProps => {
    // Wait for session to be determined
    if (status === 'loading') {
      return { context: 'signed-out' };
    }

    // Signed out
    if (!session) {
      return { context: 'signed-out' };
    }

    // Signed in - wait for profile to load
    if (isLoading) {
      return { context: 'signed-out' };
    }

    // Determine if on contact page
    const isOnContactPage = pathname === '/connect' || pathname.startsWith('/contact/');

    if (isOnContactPage) {
      // Contact page logic
      const contactColors = contactProfile?.backgroundColors;

      if (contactColors && contactColors.length >= 3) {
        return {
          colors: convertToParticleColors(contactColors),
          context: pathname === '/connect' ? 'connect' : 'contact'
        };
      } else {
        // Contact has no custom colors - use default with appropriate context
        return {
          context: pathname === '/connect' ? 'connect' : 'contact'
        };
      }
    } else {
      // User profile page logic
      const userColors = profile?.backgroundColors;

      if (userColors && userColors.length >= 3) {
        // User has custom colors
        return {
          colors: convertToParticleColors(userColors),
          context: 'profile'
        };
      } else {
        // User has no custom colors - use default nekt colors with profile-default context
        // This differentiates from signed-out via density, motion, and connections
        return {
          context: 'profile-default'
        };
      }
    }
  }, [status, session, isLoading, pathname, profile, contactProfile]);

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

  return <ParticleNetwork {...particleProps} />;
}
