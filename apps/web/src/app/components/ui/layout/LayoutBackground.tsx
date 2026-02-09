'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useProfile } from '../../../context/ProfileContext';
import { ParticleNetwork } from './ParticleNetwork';
import type { ParticleNetworkProps } from './ParticleNetwork';
import { PullToRefresh } from './PullToRefresh';
import { BACKGROUND_BLACK, BACKGROUND_GREEN, BRAND_LIGHT_GREEN, BRAND_DARK_GREEN } from '@/shared/colors';

// Track first page load to prevent cache restoration on refresh
let isFirstPageLoad = true;

// SessionStorage keys for color caching
const STORAGE_KEYS = {
  safeAreaColor: 'last-safe-area-color',
  safeAreaUserId: 'last-safe-area-userId',
  particleColors: 'last-particle-colors',
  particleColorsUserId: 'last-particle-colors-userId',
} as const;

/**
 * Clear all cached color data from sessionStorage.
 * Call this on logout to prevent stale colors showing for the next user.
 */
export function clearColorCache() {
  sessionStorage.removeItem(STORAGE_KEYS.safeAreaColor);
  sessionStorage.removeItem(STORAGE_KEYS.safeAreaUserId);
  sessionStorage.removeItem(STORAGE_KEYS.particleColors);
  sessionStorage.removeItem(STORAGE_KEYS.particleColorsUserId);

  // Also clear inline CSS styles that persist on the document root
  document.documentElement.style.removeProperty('--glass-tint-color');
  document.documentElement.style.removeProperty('--safe-area-color');
  document.documentElement.style.removeProperty('--safe-area-bg');
  document.documentElement.style.removeProperty('--particle-color');
  document.documentElement.style.backgroundColor = '';
}

interface ContactProfile {
  backgroundColors?: string[];
}

// Theme color constants derived from shared color palette
const COLORS = {
  themeGreen: BACKGROUND_GREEN,
  themeDark: BACKGROUND_BLACK,
  particleLight: hexToRgba(BRAND_LIGHT_GREEN, 0.6),
  connectionSubtle: hexToRgba(BRAND_DARK_GREEN, 0.15),
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
 * Convert background colors array to ParticleNetwork colors
 */
function convertToParticleColors(backgroundColors: string[]) {
  const [dominant, accent1, accent2] = backgroundColors;

  return {
    gradientStart: hexToRgba(accent1, 0.4),
    gradientEnd: dominant,
    particle: hexToRgba(accent2, 0.8),
    connection: hexToRgba(accent2, 0.4)
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
 * Black colors for first page load (to crossfade from black → actual colors)
 */
const BLACK_COLORS = {
  particle: 'rgba(0, 0, 0, 0)',
  connection: 'rgba(0, 0, 0, 0)',
  gradientStart: COLORS.themeDark,
  gradientEnd: COLORS.themeDark,
};

/**
 * Background manager that orchestrates ParticleNetwork with context-aware settings
 * and personalized colors extracted from profile images.
 */
export function LayoutBackground({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const { profile, isLoading, isNavigatingFromSetup, getContact } = useProfile();
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const handleRefresh = useCallback(async () => {
    router.refresh();
    await new Promise(resolve => setTimeout(resolve, 500));
  }, [router]);

  const [contactProfile, setContactProfile] = useState<ContactProfile | null>(null);
  const [cachedParticleColors, setCachedParticleColors] = useState<ParticleNetworkProps['colors'] | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen for match-found event to capture contact profile data
  useEffect(() => {
    const handleMatchFound = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { backgroundColors, loaded } = customEvent.detail || {};

      if (backgroundColors) {
        setContactProfile({ backgroundColors });
      } else if (loaded) {
        setContactProfile({ backgroundColors: [] });
      }
    };

    window.addEventListener('match-found', handleMatchFound as EventListener);
    return () => {
      window.removeEventListener('match-found', handleMatchFound as EventListener);
    };
  }, []);

  // Load contact colors from URL for contact routes
  useEffect(() => {
    const isContactRoute = pathname?.startsWith('/c/') && params?.userId;

    if (isContactRoute && getContact) {
      const userId = params.userId as string;
      const contact = getContact(userId);

      if (contact?.backgroundColors) {
        setContactProfile({ backgroundColors: contact.backgroundColors });
      } else {
        setContactProfile(null);
      }
    }
  }, [pathname, params?.userId, getContact]);

  // Clear contact profile when navigating away from contact pages
  useEffect(() => {
    const isOnContactPage = pathname?.startsWith('/x/') || pathname?.startsWith('/c/');

    if (!isOnContactPage && contactProfile) {
      const timeout = setTimeout(() => {
        setContactProfile(null);
      }, 1000);

      return () => clearTimeout(timeout);
    }
  }, [pathname, contactProfile]);

  // Set default background CSS variable for prefers-reduced-motion fallback
  useEffect(() => {
    if (!mounted) return;

    document.documentElement.style.setProperty('--default-background-image', 'url("/default-background-image.png")');

    return () => {
      document.documentElement.style.removeProperty('--default-background-image');
    };
  }, [mounted]);

  // Update safe area colors
  useEffect(() => {
    if (!mounted) return;

    const isOnContactPage = pathname?.startsWith('/x/') || pathname?.startsWith('/c/');
    const contactColors = contactProfile?.backgroundColors;
    const userColors = profile?.backgroundColors;

    // Helper to apply a color to all safe-area properties
    const applySafeAreaColor = (color: string) => {
      document.documentElement.style.setProperty('--safe-area-bg', color);
      document.documentElement.style.backgroundColor = color;
      document.documentElement.style.setProperty('--safe-area-color', color);
      updateThemeColorMeta(color);
    };

    // Handle signed-out state
    if (status !== 'authenticated') {
      if (isOnContactPage && contactColors && contactColors.length >= 3) {
        const [dominant, , accent2] = contactColors;
        applySafeAreaColor(dominant);
        document.documentElement.style.setProperty('--particle-color', accent2);
        sessionStorage.setItem(STORAGE_KEYS.safeAreaColor, dominant);
        return;
      }

      // Default signed-out: use themeDark and clear user-specific color tints
      applySafeAreaColor(COLORS.themeDark);
      document.documentElement.style.removeProperty('--glass-tint-color');
      document.documentElement.style.removeProperty('--particle-color');
      sessionStorage.setItem(STORAGE_KEYS.safeAreaColor, COLORS.themeDark);
      sessionStorage.removeItem(STORAGE_KEYS.safeAreaUserId);
      return;
    }

    if (isOnContactPage && contactColors && contactColors.length >= 3) {
      const [dominant, , accent2] = contactColors;
      applySafeAreaColor(dominant);
      document.documentElement.style.setProperty('--particle-color', accent2);
      sessionStorage.setItem(STORAGE_KEYS.safeAreaColor, dominant);
      sessionStorage.setItem(STORAGE_KEYS.safeAreaUserId, (params?.userId as string) || '');
    } else if (isOnContactPage && !contactProfile) {
      // Contact not loaded yet - use cached or themeDark
      const lastColor = sessionStorage.getItem(STORAGE_KEYS.safeAreaColor);
      const lastUserId = sessionStorage.getItem(STORAGE_KEYS.safeAreaUserId);
      const currentUserId = (params?.userId as string) || '';

      if (lastColor && lastUserId === currentUserId && status === 'authenticated') {
        applySafeAreaColor(lastColor);
      } else {
        applySafeAreaColor(COLORS.themeDark);
      }
    } else if (isOnContactPage && contactProfile && (!contactColors || contactColors.length < 3)) {
      // Contact loaded but no colors - use themeDark
      applySafeAreaColor(COLORS.themeDark);
      sessionStorage.setItem(STORAGE_KEYS.safeAreaColor, COLORS.themeDark);
      sessionStorage.setItem(STORAGE_KEYS.safeAreaUserId, (params?.userId as string) || '');
    } else if (!isOnContactPage && userColors && userColors.length >= 3) {
      const [dominant, , accent2] = userColors;
      applySafeAreaColor(dominant);
      document.documentElement.style.setProperty('--particle-color', accent2);
      sessionStorage.setItem(STORAGE_KEYS.safeAreaColor, dominant);
      sessionStorage.setItem(STORAGE_KEYS.safeAreaUserId, session?.user?.id || '');
    } else if (!isOnContactPage && profile) {
      // Profile loaded with no colors - use themeDark
      applySafeAreaColor(COLORS.themeDark);
      sessionStorage.setItem(STORAGE_KEYS.safeAreaColor, COLORS.themeDark);
      sessionStorage.setItem(STORAGE_KEYS.safeAreaUserId, session?.user?.id || '');
    } else if (status === 'authenticated') {
      // Fallback while profile is loading
      applySafeAreaColor(COLORS.themeDark);
    }
  }, [mounted, pathname, contactProfile, profile, params?.userId, isLoading, session, status]);

  // On mount, restore last safe area color and particle colors
  useEffect(() => {
    const lastColor = sessionStorage.getItem(STORAGE_KEYS.safeAreaColor);
    const lastSafeAreaUserId = sessionStorage.getItem(STORAGE_KEYS.safeAreaUserId);
    const lastParticleColors = sessionStorage.getItem(STORAGE_KEYS.particleColors);
    const lastParticleColorsUserId = sessionStorage.getItem(STORAGE_KEYS.particleColorsUserId);
    const currentUserId = params?.userId as string | undefined;
    const currentAuthUserId = session?.user?.id;
    const isOnContactPage = pathname?.startsWith('/x/') || pathname?.startsWith('/c/');

    if (status !== 'authenticated') {
      document.documentElement.style.setProperty('--safe-area-bg', COLORS.themeDark);
      document.documentElement.style.backgroundColor = COLORS.themeDark;
      document.documentElement.style.setProperty('--safe-area-color', COLORS.themeDark);
      document.documentElement.style.removeProperty('--glass-tint-color');
      document.documentElement.style.removeProperty('--particle-color');
      updateThemeColorMeta(COLORS.themeDark);
      return;
    }

    if (isFirstPageLoad) {
      isFirstPageLoad = false;
      document.documentElement.style.setProperty('--safe-area-bg', COLORS.themeDark);
      document.documentElement.style.backgroundColor = COLORS.themeDark;
      document.documentElement.style.setProperty('--safe-area-color', COLORS.themeDark);
      updateThemeColorMeta(COLORS.themeDark);
      return;
    }

    // On contact pages, always use themeDark as fallback - let the main effect handle contact colors
    if (isOnContactPage) {
      document.documentElement.style.setProperty('--safe-area-bg', COLORS.themeDark);
      document.documentElement.style.backgroundColor = COLORS.themeDark;
      document.documentElement.style.setProperty('--safe-area-color', COLORS.themeDark);
      updateThemeColorMeta(COLORS.themeDark);
      return;
    }

    // For profile pages, check against auth userId
    const shouldRestoreSafeArea = lastSafeAreaUserId === currentAuthUserId;

    // For particle colors, always check against the authenticated user
    const shouldRestoreParticleColors = lastParticleColorsUserId === currentAuthUserId;

    if (lastColor && shouldRestoreSafeArea) {
      document.documentElement.style.setProperty('--safe-area-bg', lastColor);
      document.documentElement.style.backgroundColor = lastColor;
      document.documentElement.style.setProperty('--safe-area-color', lastColor);
      updateThemeColorMeta(lastColor);
    } else if (!shouldRestoreSafeArea && currentUserId) {
      document.documentElement.style.setProperty('--safe-area-bg', COLORS.themeGreen);
      document.documentElement.style.backgroundColor = COLORS.themeGreen;
      document.documentElement.style.setProperty('--safe-area-color', COLORS.themeGreen);
      updateThemeColorMeta(COLORS.themeGreen);
    }

    if (lastParticleColors && shouldRestoreParticleColors) {
      try {
        const parsed = JSON.parse(lastParticleColors);
        setCachedParticleColors(parsed);
      } catch {
        // Ignore parse errors
      }
    } else if (!shouldRestoreParticleColors) {
      setCachedParticleColors(null);
    }
  }, [params?.userId, pathname, session, status]);

  // Determine context and background colors
  const getParticleNetworkProps = useCallback((): ParticleNetworkProps => {
    if (status === 'loading' && !session) {
      return {
        colors: cachedParticleColors || (isFirstPageLoad ? BLACK_COLORS : DEFAULT_COLORS),
        context: 'signed-out'
      };
    }

    if (!session) {
      const isOnContactPage = pathname?.startsWith('/x/') || pathname?.startsWith('/c/');

      if (isOnContactPage) {
        const contactColors = contactProfile?.backgroundColors;

        if (contactColors && contactColors.length >= 3) {
          return {
            colors: convertToParticleColors(contactColors),
            context: 'connect'
          };
        } else {
          // Use dark colors while waiting for contact colors to load
          return {
            colors: cachedParticleColors || BLACK_COLORS,
            context: 'connect'
          };
        }
      }

      return {
        colors: DEFAULT_COLORS,
        context: 'signed-out'
      };
    }

    const isOnContactPage = pathname?.startsWith('/x/') || pathname.startsWith('/c/');

    if (isLoading && !isNavigatingFromSetup) {
      // On contact pages, use dark colors while loading - don't show user's profile colors
      if (isOnContactPage) {
        const contactColors = contactProfile?.backgroundColors;
        if (contactColors && contactColors.length >= 3) {
          return {
            colors: convertToParticleColors(contactColors),
            context: pathname?.startsWith('/x/') ? 'connect' : 'contact'
          };
        }
        return {
          colors: BLACK_COLORS,
          context: pathname?.startsWith('/x/') ? 'connect' : 'contact'
        };
      }
      // For non-contact pages, use profile colors if available
      const userColors = profile?.backgroundColors;
      if (userColors && userColors.length >= 3) {
        return {
          colors: convertToParticleColors(userColors),
          context: 'profile'
        };
      }
      // Otherwise fall back to black for first load fade effect
      return {
        colors: cachedParticleColors || (isFirstPageLoad ? BLACK_COLORS : DEFAULT_COLORS),
        context: 'signed-out'
      };
    }

    if (isOnContactPage) {
      const contactColors = contactProfile?.backgroundColors;

      if (contactColors && contactColors.length >= 3) {
        return {
          colors: convertToParticleColors(contactColors),
          context: pathname?.startsWith('/x/') ? 'connect' : 'contact'
        };
      } else {
        // Use dark colors while waiting for contact colors to load
        return {
          colors: BLACK_COLORS,
          context: pathname?.startsWith('/x/') ? 'connect' : 'contact'
        };
      }
    } else {
      const userColors = profile?.backgroundColors;

      if (userColors && userColors.length >= 3) {
        return {
          colors: convertToParticleColors(userColors),
          context: 'profile'
        };
      } else {
        return {
          colors: DEFAULT_COLORS,
          context: 'profile-default'
        };
      }
    }
  }, [status, session, isLoading, isNavigatingFromSetup, pathname, profile, contactProfile, cachedParticleColors]);

  // Persist particle colors to sessionStorage (with user ID for multi-account support)
  useEffect(() => {
    if (!mounted) return;

    const props = getParticleNetworkProps();

    if (props.context !== 'signed-out' && session?.user?.id) {
      sessionStorage.setItem(STORAGE_KEYS.particleColors, JSON.stringify(props.colors));
      sessionStorage.setItem(STORAGE_KEYS.particleColorsUserId, session.user.id);
    }
  }, [mounted, getParticleNetworkProps, session?.user?.id]);

  // Manage default background visibility for prefers-reduced-motion fallback
  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const updateDefaultBackground = () => {
      if (mediaQuery.matches) {
        document.body.classList.add('show-default-background');
      } else {
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

  return (
    <>
      <ParticleNetwork {...particleProps} />
      <PullToRefresh onRefresh={handleRefresh}>
        {children}
      </PullToRefresh>
    </>
  );
}
