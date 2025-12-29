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

// Theme color constants
const COLORS = {
  // Theme green - darker emerald (solid, no opacity) for gradients and safe areas
  themeGreen: 'rgb(29, 150, 67)',

  // Theme dark background
  themeDark: 'rgb(10, 15, 26)',

  // Particle colors
  particleLight: 'rgba(200, 255, 200, 0.6)',
  particleBright: 'rgba(200, 255, 200, 0.8)',

  // Connection colors
  connectionSubtle: 'rgba(34, 197, 94, 0.15)',
  connectionMedium: 'rgba(34, 197, 94, 0.4)',
} as const;

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
    particle: hexToRgba(accent2, 0.8),          // Bright particles
    connection: hexToRgba(accent2, 0.4)         // Subtle connections (same hue as particles)
  };
}

/**
 * Update the theme-color meta tag for iOS Safari safe areas
 */
function updateThemeColorMeta(color: string) {
  let metaTag = document.querySelector('meta[name="theme-color"]');

  if (!metaTag) {
    metaTag = document.createElement('meta');
    metaTag.setAttribute('name', 'theme-color');
    document.head.appendChild(metaTag);
  }

  metaTag.setAttribute('content', color);
}

/**
 * Default colors for signed-out homepage (dark → theme green → dark)
 */
const DEFAULT_COLORS = {
  particle: COLORS.particleLight,
  connection: COLORS.connectionSubtle,
  gradientStart: COLORS.themeGreen,
  gradientEnd: COLORS.themeDark,
};

/**
 * Inverted colors for contacts without custom backgrounds (theme green → dark → theme green)
 */
const DEFAULT_COLORS_INVERTED = {
  particle: COLORS.particleBright,
  connection: COLORS.connectionMedium,
  gradientStart: COLORS.themeDark,
  gradientEnd: COLORS.themeGreen,
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
  const [cachedParticleColors, setCachedParticleColors] = useState<ParticleNetworkProps['colors'] | null>(null);

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
      document.documentElement.style.setProperty('--safe-area-color', dominant);
      updateThemeColorMeta(dominant);
      // Persist for page refreshes
      sessionStorage.setItem('last-safe-area-color', dominant);
      sessionStorage.setItem('last-safe-area-userId', (params?.userId as string) || '');
      console.log('[LayoutBackground] Setting contact safe area color:', dominant, 'userId:', params?.userId);
    } else if (isOnContactPage && contactProfile && (!contactColors || contactColors.length < 3)) {
      // On contact page where contact is loaded but has no colors - use theme green
      document.documentElement.style.backgroundColor = COLORS.themeGreen;
      document.documentElement.style.setProperty('--safe-area-color', COLORS.themeGreen);
      updateThemeColorMeta(COLORS.themeGreen);
      sessionStorage.setItem('last-safe-area-color', COLORS.themeGreen);
      sessionStorage.setItem('last-safe-area-userId', (params?.userId as string) || '');
      console.log('[LayoutBackground] Setting theme green safe area color for contact page (no custom colors), userId:', params?.userId);
    } else if (!isOnContactPage && userColors && userColors.length >= 3) {
      // Not on contact page - use profile's dominant color (custom or default theme green)
      const [dominant] = userColors;
      document.documentElement.style.backgroundColor = dominant;
      document.documentElement.style.setProperty('--safe-area-color', dominant);
      updateThemeColorMeta(dominant);
      // Persist for page refreshes
      sessionStorage.setItem('last-safe-area-color', dominant);
      sessionStorage.removeItem('last-safe-area-userId'); // Clear userId for non-contact pages
      console.log('[LayoutBackground] Setting profile safe area color:', dominant);
    } else if (!isOnContactPage && profile) {
      // Fallback: profile loaded but no colors - use theme green
      document.documentElement.style.backgroundColor = COLORS.themeGreen;
      document.documentElement.style.setProperty('--safe-area-color', COLORS.themeGreen);
      updateThemeColorMeta(COLORS.themeGreen);
      sessionStorage.setItem('last-safe-area-color', COLORS.themeGreen);
      sessionStorage.removeItem('last-safe-area-userId');
      console.log('[LayoutBackground] Setting theme green safe area color for profile page (fallback - no colors)');
    }
  }, [mounted, pathname, contactProfile, profile, params?.userId]);

  // On mount, restore last safe area color and particle colors if available (prevents flash on refresh)
  useEffect(() => {
    const lastColor = sessionStorage.getItem('last-safe-area-color');
    const lastUserId = sessionStorage.getItem('last-safe-area-userId');
    const lastParticleColors = sessionStorage.getItem('last-particle-colors');
    const currentUserId = params?.userId as string | undefined;

    // Only restore if we're on the same contact/page as when saved
    // For non-contact pages (no userId), always restore
    // For contact pages, only restore if userId matches
    const shouldRestore = !currentUserId || lastUserId === currentUserId;

    if (lastColor && shouldRestore) {
      document.documentElement.style.backgroundColor = lastColor;
      document.documentElement.style.setProperty('--safe-area-color', lastColor);
      updateThemeColorMeta(lastColor);
      console.log('[LayoutBackground] Restored safe area color from session:', lastColor, 'userId:', currentUserId);
    } else if (!shouldRestore && currentUserId) {
      // On contact page but userId doesn't match - clear old color and set theme green while loading
      document.documentElement.style.backgroundColor = COLORS.themeGreen;
      document.documentElement.style.setProperty('--safe-area-color', COLORS.themeGreen);
      updateThemeColorMeta(COLORS.themeGreen);
      console.log('[LayoutBackground] Setting theme green while loading contact (userId mismatch). Last:', lastUserId, 'Current:', currentUserId);
    }

    // Restore particle colors
    if (lastParticleColors && shouldRestore) {
      try {
        const parsed = JSON.parse(lastParticleColors);
        setCachedParticleColors(parsed);
        console.log('[LayoutBackground] Restored particle colors from session:', parsed);
      } catch (e) {
        console.error('[LayoutBackground] Failed to parse cached particle colors:', e);
      }
    } else if (!shouldRestore) {
      // Clear cached colors if userId doesn't match
      setCachedParticleColors(null);
    }
  }, [params?.userId]);

  // Determine context and background colors
  const getParticleNetworkProps = useCallback((): ParticleNetworkProps => {
    // Wait for INITIAL session check only
    // Ignore status 'loading' if we already have a session (prevents flash during session refresh)
    if (status === 'loading' && !session) {
      return {
        colors: cachedParticleColors || DEFAULT_COLORS,
        context: 'signed-out'
      };
    }

    // Signed out
    if (!session) {
      return {
        colors: DEFAULT_COLORS,
        context: 'signed-out'
      };
    }

    // Special case: setup page should use inverted gradient like profile
    if (pathname === '/setup') {
      return {
        colors: DEFAULT_COLORS_INVERTED,
        context: 'profile-default'
      };
    }

    // Signed in - wait for profile to load
    // UNLESS navigating from setup (prevent flash during profile load)
    // Use cached colors if available to prevent flash on refresh
    if (isLoading && !isNavigatingFromSetup) {
      return {
        colors: cachedParticleColors || DEFAULT_COLORS,
        context: 'signed-out'
      };
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

      // Use profile colors (whether custom extracted or default theme green)
      if (userColors && userColors.length >= 3) {
        return {
          colors: convertToParticleColors(userColors),
          context: 'profile'
        };
      } else {
        // Fallback: no colors available - use default green gradient
        return {
          colors: DEFAULT_COLORS_INVERTED,
          context: 'profile-default'
        };
      }
    }
  }, [status, session, isLoading, isNavigatingFromSetup, pathname, profile, contactProfile, cachedParticleColors]);

  // Persist particle colors to sessionStorage to prevent flash on refresh
  useEffect(() => {
    if (!mounted) return;

    const props = getParticleNetworkProps();

    // Only cache non-default colors (profile and contact colors)
    if (props.context !== 'signed-out') {
      sessionStorage.setItem('last-particle-colors', JSON.stringify(props.colors));
      console.log('[LayoutBackground] Cached particle colors to session:', props.colors);
    }
  }, [mounted, getParticleNetworkProps]);

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
