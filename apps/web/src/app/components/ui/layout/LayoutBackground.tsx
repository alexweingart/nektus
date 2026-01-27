'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useProfile } from '../../../context/ProfileContext';
import { ParticleNetwork } from './ParticleNetwork';
import type { ParticleNetworkProps } from './ParticleNetwork';
import { PullToRefresh } from './PullToRefresh';

// Track first page load to prevent cache restoration on refresh
let isFirstPageLoad = true;

interface ContactProfile {
  backgroundColors?: string[];
}

// Theme color constants
const COLORS = {
  // Theme green - muted green for gradients and safe areas
  // 40% bright green blended with dark: rgb(34,197,94) * 0.4 + rgb(10,15,26) * 0.6
  themeGreen: 'rgb(20, 88, 53)',

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
 * Inverted colors for profiles/contacts without custom backgrounds (theme green → dark → theme green)
 */
const DEFAULT_COLORS_INVERTED = {
  particle: COLORS.particleBright,
  connection: COLORS.connectionMedium,
  gradientStart: COLORS.themeDark,
  gradientEnd: COLORS.themeGreen,
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

    document.documentElement.style.setProperty('--default-background-image', 'url("/DefaultBackgroundImage.png")');

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

    // Helper to check if colors are custom (not all the same)
    const hasCustomColors = (colors: string[] | undefined) => {
      if (!colors || colors.length < 3) return false;
      return !(colors[0] === colors[1] && colors[1] === colors[2]);
    };

    // Handle signed-out state
    if (status !== 'authenticated') {
      if (isOnContactPage && contactColors && contactColors.length >= 3) {
        if (hasCustomColors(contactColors)) {
          const [dominant, , accent2] = contactColors;
          document.documentElement.style.setProperty('--safe-area-bg', dominant);
          document.documentElement.style.backgroundColor = dominant;
          document.documentElement.style.setProperty('--safe-area-color', dominant);
          document.documentElement.style.setProperty('--particle-color', accent2);
          updateThemeColorMeta(dominant);
          sessionStorage.setItem('last-safe-area-color', dominant);
        } else {
          document.documentElement.style.setProperty('--safe-area-bg', COLORS.themeGreen);
          document.documentElement.style.backgroundColor = COLORS.themeGreen;
          document.documentElement.style.setProperty('--safe-area-color', COLORS.themeGreen);
          updateThemeColorMeta(COLORS.themeGreen);
          sessionStorage.setItem('last-safe-area-color', COLORS.themeGreen);
        }
        return;
      }

      // Default signed-out: use themeDark
      document.documentElement.style.setProperty('--safe-area-bg', COLORS.themeDark);
      document.documentElement.style.backgroundColor = COLORS.themeDark;
      document.documentElement.style.setProperty('--safe-area-color', COLORS.themeDark);
      updateThemeColorMeta(COLORS.themeDark);
      sessionStorage.setItem('last-safe-area-color', COLORS.themeDark);
      sessionStorage.removeItem('last-safe-area-userId');
      return;
    }

    if (isOnContactPage && contactColors && contactColors.length >= 3) {
      if (hasCustomColors(contactColors)) {
        const [dominant, , accent2] = contactColors;
        document.documentElement.style.setProperty('--safe-area-bg', dominant);
        document.documentElement.style.backgroundColor = dominant;
        document.documentElement.style.setProperty('--safe-area-color', dominant);
        document.documentElement.style.setProperty('--particle-color', accent2);
        updateThemeColorMeta(dominant);
        sessionStorage.setItem('last-safe-area-color', dominant);
      } else {
        document.documentElement.style.setProperty('--safe-area-bg', COLORS.themeGreen);
        document.documentElement.style.backgroundColor = COLORS.themeGreen;
        document.documentElement.style.setProperty('--safe-area-color', COLORS.themeGreen);
        updateThemeColorMeta(COLORS.themeGreen);
        sessionStorage.setItem('last-safe-area-color', COLORS.themeGreen);
      }
      sessionStorage.setItem('last-safe-area-userId', (params?.userId as string) || '');
    } else if (isOnContactPage && !contactProfile) {
      // Contact not loaded yet - use cached or themeDark
      const lastColor = sessionStorage.getItem('last-safe-area-color');
      const lastUserId = sessionStorage.getItem('last-safe-area-userId');
      const currentUserId = (params?.userId as string) || '';

      if (lastColor && lastUserId === currentUserId && status === 'authenticated') {
        document.documentElement.style.setProperty('--safe-area-bg', lastColor);
        document.documentElement.style.backgroundColor = lastColor;
        document.documentElement.style.setProperty('--safe-area-color', lastColor);
        updateThemeColorMeta(lastColor);
      } else {
        document.documentElement.style.setProperty('--safe-area-bg', COLORS.themeDark);
        document.documentElement.style.backgroundColor = COLORS.themeDark;
        document.documentElement.style.setProperty('--safe-area-color', COLORS.themeDark);
        updateThemeColorMeta(COLORS.themeDark);
      }
    } else if (isOnContactPage && contactProfile && (!contactColors || contactColors.length < 3)) {
      // Contact loaded but no colors - use themeGreen
      document.documentElement.style.setProperty('--safe-area-bg', COLORS.themeGreen);
      document.documentElement.style.backgroundColor = COLORS.themeGreen;
      document.documentElement.style.setProperty('--safe-area-color', COLORS.themeGreen);
      updateThemeColorMeta(COLORS.themeGreen);
      sessionStorage.setItem('last-safe-area-color', COLORS.themeGreen);
      sessionStorage.setItem('last-safe-area-userId', (params?.userId as string) || '');
    } else if (!isOnContactPage && userColors && userColors.length >= 3) {
      if (hasCustomColors(userColors)) {
        const [dominant, , accent2] = userColors;
        document.documentElement.style.setProperty('--safe-area-bg', dominant);
        document.documentElement.style.backgroundColor = dominant;
        document.documentElement.style.setProperty('--safe-area-color', dominant);
        document.documentElement.style.setProperty('--particle-color', accent2);
        updateThemeColorMeta(dominant);
        sessionStorage.setItem('last-safe-area-color', dominant);
      } else {
        document.documentElement.style.setProperty('--safe-area-bg', COLORS.themeGreen);
        document.documentElement.style.backgroundColor = COLORS.themeGreen;
        document.documentElement.style.setProperty('--safe-area-color', COLORS.themeGreen);
        updateThemeColorMeta(COLORS.themeGreen);
        sessionStorage.setItem('last-safe-area-color', COLORS.themeGreen);
      }
      sessionStorage.removeItem('last-safe-area-userId');
    } else if (!isOnContactPage && profile) {
      // Profile loaded with no colors - use themeGreen
      document.documentElement.style.setProperty('--safe-area-bg', COLORS.themeGreen);
      document.documentElement.style.backgroundColor = COLORS.themeGreen;
      document.documentElement.style.setProperty('--safe-area-color', COLORS.themeGreen);
      updateThemeColorMeta(COLORS.themeGreen);
      sessionStorage.setItem('last-safe-area-color', COLORS.themeGreen);
      sessionStorage.removeItem('last-safe-area-userId');
    } else if (status === 'authenticated') {
      // Fallback while profile is loading
      document.documentElement.style.setProperty('--safe-area-bg', COLORS.themeDark);
      document.documentElement.style.backgroundColor = COLORS.themeDark;
      document.documentElement.style.setProperty('--safe-area-color', COLORS.themeDark);
      updateThemeColorMeta(COLORS.themeDark);
    }
  }, [mounted, pathname, contactProfile, profile, params?.userId, isLoading, session, status]);

  // On mount, restore last safe area color and particle colors
  useEffect(() => {
    const lastColor = sessionStorage.getItem('last-safe-area-color');
    const lastUserId = sessionStorage.getItem('last-safe-area-userId');
    const lastParticleColors = sessionStorage.getItem('last-particle-colors');
    const currentUserId = params?.userId as string | undefined;

    if (status !== 'authenticated') {
      document.documentElement.style.setProperty('--safe-area-bg', COLORS.themeDark);
      document.documentElement.style.backgroundColor = COLORS.themeDark;
      document.documentElement.style.setProperty('--safe-area-color', COLORS.themeDark);
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

    const shouldRestore = !currentUserId || lastUserId === currentUserId;

    if (lastColor && shouldRestore) {
      document.documentElement.style.setProperty('--safe-area-bg', lastColor);
      document.documentElement.style.backgroundColor = lastColor;
      document.documentElement.style.setProperty('--safe-area-color', lastColor);
      updateThemeColorMeta(lastColor);
    } else if (!shouldRestore && currentUserId) {
      document.documentElement.style.setProperty('--safe-area-bg', COLORS.themeGreen);
      document.documentElement.style.backgroundColor = COLORS.themeGreen;
      document.documentElement.style.setProperty('--safe-area-color', COLORS.themeGreen);
      updateThemeColorMeta(COLORS.themeGreen);
    }

    if (lastParticleColors && shouldRestore) {
      try {
        const parsed = JSON.parse(lastParticleColors);
        setCachedParticleColors(parsed);
      } catch {
        // Ignore parse errors
      }
    } else if (!shouldRestore) {
      setCachedParticleColors(null);
    }
  }, [params?.userId, session, status]);

  // Determine context and background colors
  const getParticleNetworkProps = useCallback((): ParticleNetworkProps => {
    // Helper to check if colors are custom
    const hasCustomColors = (colors: string[] | undefined) => {
      if (!colors || colors.length < 3) return false;
      return !(colors[0] === colors[1] && colors[1] === colors[2]);
    };

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
        const hasColors = contactColors && contactColors.length >= 3;

        if (hasColors && hasCustomColors(contactColors)) {
          return {
            colors: convertToParticleColors(contactColors),
            context: 'connect'
          };
        } else if (hasColors || contactProfile) {
          // Uniform colors (AI-generated) or no colors - use default muted green
          return {
            colors: DEFAULT_COLORS_INVERTED,
            context: 'connect'
          };
        } else {
          return {
            colors: cachedParticleColors || (isFirstPageLoad ? BLACK_COLORS : DEFAULT_COLORS_INVERTED),
            context: 'connect'
          };
        }
      }

      return {
        colors: DEFAULT_COLORS,
        context: 'signed-out'
      };
    }

    if (pathname === '/setup') {
      return {
        colors: DEFAULT_COLORS_INVERTED,
        context: 'profile-default'
      };
    }

    const isOnContactPage = pathname?.startsWith('/x/') || pathname.startsWith('/c/');

    if (isLoading && !isNavigatingFromSetup) {
      const loadingColors = isOnContactPage ? DEFAULT_COLORS_INVERTED : DEFAULT_COLORS;
      return {
        colors: cachedParticleColors || (isFirstPageLoad ? BLACK_COLORS : loadingColors),
        context: isOnContactPage ? 'contact' : 'signed-out'
      };
    }

    if (isOnContactPage) {
      const contactColors = contactProfile?.backgroundColors;
      const hasColors = contactColors && contactColors.length >= 3;

      if (hasColors && hasCustomColors(contactColors)) {
        return {
          colors: convertToParticleColors(contactColors),
          context: pathname?.startsWith('/x/') ? 'connect' : 'contact'
        };
      } else {
        // Uniform colors (AI-generated) or no colors - use default muted green
        return {
          colors: DEFAULT_COLORS_INVERTED,
          context: pathname?.startsWith('/x/') ? 'connect' : 'contact'
        };
      }
    } else {
      const userColors = profile?.backgroundColors;
      const hasColors = userColors && userColors.length >= 3;

      if (hasColors && hasCustomColors(userColors)) {
        return {
          colors: convertToParticleColors(userColors),
          context: 'profile'
        };
      } else {
        // Uniform colors (AI-generated) or no colors - use default muted green
        return {
          colors: DEFAULT_COLORS_INVERTED,
          context: 'profile-default'
        };
      }
    }
  }, [status, session, isLoading, isNavigatingFromSetup, pathname, profile, contactProfile, cachedParticleColors]);

  // Persist particle colors to sessionStorage
  useEffect(() => {
    if (!mounted) return;

    const props = getParticleNetworkProps();

    if (props.context !== 'signed-out') {
      sessionStorage.setItem('last-particle-colors', JSON.stringify(props.colors));
    }
  }, [mounted, getParticleNetworkProps]);

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
