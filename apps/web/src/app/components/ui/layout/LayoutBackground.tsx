'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useProfile } from '../../../context/ProfileContext';
import { ParticleNetwork } from './ParticleNetwork';
import type { ParticleNetworkProps } from './ParticleNetwork';

// Track first page load to prevent cache restoration on refresh
// Resets on page refresh (module reload), persists during SPA navigation
let isFirstPageLoad = true;

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
 * Black colors for first page load (to crossfade from black → actual colors)
 */
const BLACK_COLORS = {
  particle: 'rgba(0, 0, 0, 0)',      // Transparent particles
  connection: 'rgba(0, 0, 0, 0)',    // Transparent connections
  gradientStart: COLORS.themeDark,   // Black gradient start
  gradientEnd: COLORS.themeDark,     // Black gradient end
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
      const { backgroundColors, loaded } = customEvent.detail || {};

      // Update contactProfile if contact has colors OR if contact is loaded without colors
      if (backgroundColors) {
        setContactProfile({ backgroundColors });
      } else if (loaded) {
        // Contact loaded but has no colors - set empty contactProfile to trigger theme green
        setContactProfile({ backgroundColors: [] });
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

    console.log('[LayoutBackground] Safe area effect running:', {
      pathname,
      isOnContactPage,
      hasContactProfile: !!contactProfile,
      contactColors: contactColors?.length,
      hasProfile: !!profile,
      userColors: userColors?.length,
      isLoading,
      mounted,
      status,
      hasSession: !!session
    });

    // Handle signed-out state FIRST - always use themeDark
    if (status !== 'authenticated') {
      document.documentElement.style.setProperty('--safe-area-bg', COLORS.themeDark);
      document.documentElement.style.backgroundColor = COLORS.themeDark;
      document.documentElement.style.setProperty('--safe-area-color', COLORS.themeDark);
      updateThemeColorMeta(COLORS.themeDark);
      sessionStorage.setItem('last-safe-area-color', COLORS.themeDark);
      sessionStorage.removeItem('last-safe-area-userId');
      console.log('[LayoutBackground] Setting themeDark for signed-out state');
      return;
    }

    if (isOnContactPage && contactColors && contactColors.length >= 3) {
      // On contact page with contact colors - use contact's dominant color
      const [dominant] = contactColors;
      document.documentElement.style.setProperty('--safe-area-bg', dominant);
      document.documentElement.style.backgroundColor = dominant; // Force update
      document.documentElement.style.setProperty('--safe-area-color', dominant);
      updateThemeColorMeta(dominant);
      // Persist for page refreshes
      sessionStorage.setItem('last-safe-area-color', dominant);
      sessionStorage.setItem('last-safe-area-userId', (params?.userId as string) || '');
      console.log('[LayoutBackground] ✅ Setting contact safe area color:', dominant, 'userId:', params?.userId);
    } else if (isOnContactPage && !contactProfile) {
      // On contact page but contact not loaded yet - keep current color or use black during initial load
      // This prevents showing theme green while waiting for contact to load
      const lastColor = sessionStorage.getItem('last-safe-area-color');
      if (lastColor && status === 'authenticated') {
        // On refresh, keep the last color briefly while contact loads
        console.log('[LayoutBackground] ⏳ Contact page loading, keeping last color:', lastColor);
        // Don't update - let the restoration effect or next run handle it
      } else {
        // First time on this contact or signed out - use black while loading
        document.documentElement.style.setProperty('--safe-area-bg', COLORS.themeDark);
        document.documentElement.style.backgroundColor = COLORS.themeDark;
        document.documentElement.style.setProperty('--safe-area-color', COLORS.themeDark);
        updateThemeColorMeta(COLORS.themeDark);
        console.log('[LayoutBackground] ⏳ Contact page loading (no cache), using themeDark');
      }
    } else if (isOnContactPage && contactProfile && (!contactColors || contactColors.length < 3)) {
      // On contact page where contact is loaded but has no colors - use theme green
      document.documentElement.style.setProperty('--safe-area-bg', COLORS.themeGreen);
      document.documentElement.style.backgroundColor = COLORS.themeGreen; // Force update
      document.documentElement.style.setProperty('--safe-area-color', COLORS.themeGreen);
      updateThemeColorMeta(COLORS.themeGreen);
      sessionStorage.setItem('last-safe-area-color', COLORS.themeGreen);
      sessionStorage.setItem('last-safe-area-userId', (params?.userId as string) || '');
      console.log('[LayoutBackground] Setting theme green safe area color for contact page (no custom colors), userId:', params?.userId);
    } else if (!isOnContactPage && userColors && userColors.length >= 3) {
      // Not on contact page - use profile's dominant color (custom or default theme green)
      const [dominant] = userColors;
      document.documentElement.style.setProperty('--safe-area-bg', dominant);
      document.documentElement.style.backgroundColor = dominant; // Force update
      document.documentElement.style.setProperty('--safe-area-color', dominant);
      updateThemeColorMeta(dominant);
      // Persist for page refreshes
      sessionStorage.setItem('last-safe-area-color', dominant);
      sessionStorage.removeItem('last-safe-area-userId'); // Clear userId for non-contact pages
      console.log('[LayoutBackground] Setting profile safe area color:', dominant);
    } else if (!isOnContactPage && profile) {
      // Fallback: profile loaded with no colors - use theme green (even while loading)
      console.log('[LayoutBackground] 🟢 ABOUT TO SET THEME GREEN for profile (no colors)');
      console.log('[LayoutBackground] Before setting - backgroundColor:', document.documentElement.style.backgroundColor);
      console.log('[LayoutBackground] Before setting - --safe-area-bg:', document.documentElement.style.getPropertyValue('--safe-area-bg'));

      // Set both variable and direct backgroundColor (same as custom colors path)
      document.documentElement.style.setProperty('--safe-area-bg', COLORS.themeGreen);
      document.documentElement.style.backgroundColor = COLORS.themeGreen;
      document.documentElement.style.setProperty('--safe-area-color', COLORS.themeGreen);
      updateThemeColorMeta(COLORS.themeGreen);
      sessionStorage.setItem('last-safe-area-color', COLORS.themeGreen);
      sessionStorage.removeItem('last-safe-area-userId');

      console.log('[LayoutBackground] ✅ AFTER SETTING - backgroundColor:', document.documentElement.style.backgroundColor);
      console.log('[LayoutBackground] ✅ AFTER SETTING - --safe-area-bg:', document.documentElement.style.getPropertyValue('--safe-area-bg'));
      console.log('[LayoutBackground] ✅ AFTER SETTING - computed:', getComputedStyle(document.documentElement).backgroundColor);

      // Check if something overwrites it asynchronously
      setTimeout(() => {
        console.log('[LayoutBackground] 🕐 100ms LATER - backgroundColor:', document.documentElement.style.backgroundColor);
        console.log('[LayoutBackground] 🕐 100ms LATER - computed:', getComputedStyle(document.documentElement).backgroundColor);
      }, 100);

      console.log('[LayoutBackground] Setting theme green safe area color for profile page (no colors), profile:', {
        hasProfile: !!profile,
        isLoading,
        userColors,
        backgroundColors: profile?.backgroundColors
      });
    } else {
      console.log('[LayoutBackground] ⚠️ NO SAFE AREA PATH MATCHED:', {
        isOnContactPage,
        hasContactProfile: !!contactProfile,
        contactColorsLength: contactColors?.length,
        hasProfile: !!profile,
        userColorsLength: userColors?.length,
        isLoading,
        'condition1_contact+colors': isOnContactPage && contactColors && contactColors.length >= 3,
        'condition2_contact+noColors': isOnContactPage && contactProfile && (!contactColors || contactColors.length < 3),
        'condition3_profile+colors': !isOnContactPage && userColors && userColors.length >= 3,
        'condition4_profile+noColors': !isOnContactPage && profile
      });
    }
  }, [mounted, pathname, contactProfile, profile, params?.userId, isLoading, session, status]);

  // On mount, restore last safe area color and particle colors if available (prevents flash on navigation)
  useEffect(() => {
    const lastColor = sessionStorage.getItem('last-safe-area-color');
    const lastUserId = sessionStorage.getItem('last-safe-area-userId');
    const lastParticleColors = sessionStorage.getItem('last-particle-colors');
    const currentUserId = params?.userId as string | undefined;

    // If signed out, always use themeDark and don't restore cached colors
    if (status !== 'authenticated') {
      document.documentElement.style.setProperty('--safe-area-bg', COLORS.themeDark);
      document.documentElement.style.backgroundColor = COLORS.themeDark;
      document.documentElement.style.setProperty('--safe-area-color', COLORS.themeDark);
      updateThemeColorMeta(COLORS.themeDark);
      console.log('[LayoutBackground] Mount: Setting themeDark for signed-out state (not restoring cache)');
      return;
    }

    // On first page load (refresh or direct URL), don't restore - start from black
    // On subsequent navigation, restore for smooth transitions
    if (isFirstPageLoad) {
      isFirstPageLoad = false;
      console.log('[LayoutBackground] First page load detected - not restoring colors, will start from black');
      return;
    }

    // Only restore if we're on the same contact/page as when saved
    // For non-contact pages (no userId), always restore
    // For contact pages, only restore if userId matches
    const shouldRestore = !currentUserId || lastUserId === currentUserId;

    if (lastColor && shouldRestore) {
      document.documentElement.style.setProperty('--safe-area-bg', lastColor);
      document.documentElement.style.backgroundColor = lastColor; // Force update
      document.documentElement.style.setProperty('--safe-area-color', lastColor);
      updateThemeColorMeta(lastColor);
      console.log('[LayoutBackground] Restored safe area color from session:', lastColor, 'userId:', currentUserId);
    } else if (!shouldRestore && currentUserId) {
      // On contact page but userId doesn't match - clear old color and set theme green while loading
      document.documentElement.style.setProperty('--safe-area-bg', COLORS.themeGreen);
      document.documentElement.style.backgroundColor = COLORS.themeGreen; // Force update
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
  }, [params?.userId, session, status]);

  // Determine context and background colors
  const getParticleNetworkProps = useCallback((): ParticleNetworkProps => {
    // Wait for INITIAL session check only
    // Ignore status 'loading' if we already have a session (prevents flash during session refresh)
    if (status === 'loading' && !session) {
      return {
        // On first page load, start from black; on navigation, use cached colors
        colors: cachedParticleColors || (isFirstPageLoad ? BLACK_COLORS : DEFAULT_COLORS),
        context: 'signed-out'
      };
    }

    // Signed out - always use default colors (not black, since signed-out pages don't refresh often)
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

    // Determine if on contact page FIRST (before loading check)
    const isOnContactPage = pathname === '/connect' || pathname.startsWith('/contact/');

    // Signed in - wait for profile to load
    // UNLESS navigating from setup (prevent flash during profile load)
    // Use cached colors if available, or black on first page load
    if (isLoading && !isNavigatingFromSetup) {
      // On contact pages, use INVERTED colors while loading (green bottom matches contact style)
      // On profile pages, use regular DEFAULT (black bottom)
      const loadingColors = isOnContactPage ? DEFAULT_COLORS_INVERTED : DEFAULT_COLORS;
      return {
        colors: cachedParticleColors || (isFirstPageLoad ? BLACK_COLORS : loadingColors),
        context: isOnContactPage ? 'contact' : 'signed-out'
      };
    }

    if (isOnContactPage) {
      // Contact page logic
      const contactColors = contactProfile?.backgroundColors;

      // Check if colors exist and are custom (not all the same)
      const hasCustomColors = contactColors &&
                             contactColors.length >= 3 &&
                             !(contactColors[0] === contactColors[1] && contactColors[1] === contactColors[2]);

      if (hasCustomColors) {
        // Use contact's custom colors
        const particleColors = convertToParticleColors(contactColors);
        return {
          colors: particleColors,
          context: pathname === '/connect' ? 'connect' : 'contact'
        };
      } else {
        // No contact colors or all colors are the same - use default inverted gradient (profile-style)
        return {
          colors: DEFAULT_COLORS_INVERTED,
          context: pathname === '/connect' ? 'connect' : 'contact'
        };
      }
    } else {
      // User profile page logic
      const userColors = profile?.backgroundColors;

      // Check if colors exist and are custom (not all the same theme green)
      const hasCustomColors = userColors &&
                             userColors.length >= 3 &&
                             !(userColors[0] === userColors[1] && userColors[1] === userColors[2]);

      if (hasCustomColors) {
        // Use custom extracted colors for gradient
        return {
          colors: convertToParticleColors(userColors),
          context: 'profile'
        };
      } else {
        // AI-generated or no colors - use default green gradient
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

  // Debug logging for particle colors
  console.log('[LayoutBackground] Rendering with particle colors:', {
    pathname,
    gradientEnd: particleProps.colors.gradientEnd,
    gradientStart: particleProps.colors.gradientStart,
    htmlBackground: document.documentElement.style.backgroundColor,
    safeAreaBg: document.documentElement.style.getPropertyValue('--safe-area-bg'),
    hasContactProfile: !!contactProfile,
    contactColors: contactProfile?.backgroundColors,
    isFirstPageLoad
  });

  // V2: No wrapper div - ParticleNetwork is fixed, children scroll naturally
  return (
    <>
      <ParticleNetwork {...particleProps} />
      {children}
    </>
  );
}
