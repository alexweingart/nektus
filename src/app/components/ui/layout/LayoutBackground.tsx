'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { useProfile } from '../../../context/ProfileContext';

/**
 * CSS-based background manager using body::before and body::after
 * Sets CSS variables and toggles classes for smooth transitions
 * No React render delays - backgrounds always present in DOM
 */
export function LayoutBackground() {
  const { data: session, status } = useSession();
  const { profile, isLoading, streamingBackgroundImage, isGoogleInitials } = useProfile();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [contactBackgroundUrl, setContactBackgroundUrl] = useState<string | null>(null);

  // Cache loaded image URLs
  const loadedImagesRef = useRef(new Set<string>());

  // Track previous pathname to detect navigation direction
  const prevPathnameRef = useRef(pathname);

  // Helper function to clean image URL
  const cleanImageUrl = useCallback((url: string): string => {
    return url.replace(/[\n\r\t]/g, '').trim();
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen for match-found event to capture contact background
  useEffect(() => {
    const handleMatchFound = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { contactBackgroundImage } = customEvent.detail || {};

      if (contactBackgroundImage) {
        setContactBackgroundUrl(contactBackgroundImage);
      }
    };

    window.addEventListener('match-found', handleMatchFound as EventListener);
    return () => {
      window.removeEventListener('match-found', handleMatchFound as EventListener);
    };
  }, []);

  // Set user background CSS variable when image loads
  useEffect(() => {
    if (!mounted || !isImageLoaded || isLoading) return;

    const userBackgroundUrl = streamingBackgroundImage || profile?.backgroundImage;
    if (!userBackgroundUrl) return;

    const cleanedUrl = cleanImageUrl(userBackgroundUrl);

    // Set CSS variable
    document.documentElement.style.setProperty('--user-background-image', `url("${cleanedUrl}")`);

    // Only add class to show user background if NOT on a contact page
    // Contact pages manage their own backgrounds via ContactLayout
    const isOnContactPage = pathname.startsWith('/contact/');
    if (!isOnContactPage) {
      document.body.classList.add('has-user-background');
    }

    return () => {
      // Cleanup on unmount
      document.body.classList.remove('has-user-background');
    };
  }, [mounted, isImageLoaded, isLoading, streamingBackgroundImage, profile?.backgroundImage, cleanImageUrl, pathname]);

  // Set contact background CSS variable when available
  useEffect(() => {
    if (!contactBackgroundUrl) return;

    const cleanedUrl = cleanImageUrl(contactBackgroundUrl);
    document.documentElement.style.setProperty('--contact-background-image', `url("${cleanedUrl}")`);
  }, [contactBackgroundUrl, cleanImageUrl]);

  // Toggle contact background visibility based on pathname
  useEffect(() => {
    const prevPathname = prevPathnameRef.current;
    prevPathnameRef.current = pathname;

    if (!contactBackgroundUrl) return;

    const isOnContactPage = pathname === '/connect' || pathname.startsWith('/contact/');

    if (isOnContactPage) {
      document.body.classList.add('show-contact-background');
    } else {
      // Only hide and clear if we're coming BACK from /connect
      const isReturningFromConnect = prevPathname === '/connect' && pathname === '/';

      if (isReturningFromConnect) {
        document.body.classList.remove('show-contact-background');

        // Clear after transition (1s to match CSS transition)
        setTimeout(() => {
          setContactBackgroundUrl(null);
          document.documentElement.style.removeProperty('--contact-background-image');
        }, 1000);
      }
      // Otherwise, keep background ready for navigation
    }
  }, [pathname, contactBackgroundUrl]);

  // Manage default background and particle network visibility
  useEffect(() => {
    if (!mounted) return;

    // Set default background image CSS variable
    document.documentElement.style.setProperty('--default-background-image', 'url("/DefaultBackgroundImage.png")');

    // Wait for both session and profile to be determined (don't show anything while loading)
    if (status === 'loading' || isLoading) {
      return;
    }

    // Determine if avatar is initials or AI-generated
    const isInitialsAvatar = profile?.aiGeneration?.avatarGenerated === true || isGoogleInitials;

    // Check if we have any background (user or contact)
    const userBackgroundUrl = streamingBackgroundImage || profile?.backgroundImage;
    const hasBackground = !!userBackgroundUrl || !!contactBackgroundUrl;

    // Signed out (authenticated status determined) → show particles, no default background
    if (!session) {
      document.body.classList.add('show-particles');
      document.body.classList.remove('show-default-background');
      return;
    }

    // Determine if we're on a contact page
    const isOnContactPage = pathname === '/connect' || pathname.startsWith('/contact/');

    // Signed in logic - different behavior for contact pages vs user pages
    if (isOnContactPage) {
      // CONTACT PAGE LOGIC
      if (contactBackgroundUrl) {
        // Contact has background → show it, no particles, no default
        document.body.classList.remove('show-particles');
        document.body.classList.remove('show-default-background');
      } else {
        // Contact has NO background → show default background, no particles
        document.body.classList.remove('show-particles');
        document.body.classList.add('show-default-background');
      }
    } else {
      // USER PAGE LOGIC
      if (userBackgroundUrl) {
        // User has background → show it, no particles, no default
        document.body.classList.remove('show-particles');
        document.body.classList.remove('show-default-background');
      } else if (isInitialsAvatar) {
        // No background + initials avatar → show default background, no particles
        document.body.classList.remove('show-particles');
        document.body.classList.add('show-default-background');
      } else {
        // No background + real photo → show particles, no default
        document.body.classList.add('show-particles');
        document.body.classList.remove('show-default-background');
      }
    }

    return () => {
      // Cleanup on unmount
      document.body.classList.remove('show-particles');
      document.body.classList.remove('show-default-background');
      document.documentElement.style.removeProperty('--default-background-image');
    };
  }, [mounted, session, status, profile, streamingBackgroundImage, contactBackgroundUrl, isGoogleInitials, pathname]);

  // Handle image load
  const handleImageLoad = useCallback(() => {
    const backgroundImageUrl = streamingBackgroundImage || profile?.backgroundImage;
    if (backgroundImageUrl) {
      const cleanedUrl = cleanImageUrl(backgroundImageUrl);
      setIsImageLoaded(true);
      loadedImagesRef.current.add(cleanedUrl);
    }
  }, [streamingBackgroundImage, profile?.backgroundImage, cleanImageUrl]);

  // User background URL
  const userBackgroundUrl = streamingBackgroundImage || profile?.backgroundImage;

  // Don't render anything if no user background
  if (!mounted || isLoading || !userBackgroundUrl) {
    return null;
  }

  const cleanedUserUrl = cleanImageUrl(userBackgroundUrl);

  return (
    <>
      {/* Hidden img tag for preloading user background */}
      <Image
        src={cleanedUserUrl}
        alt=""
        width={1}
        height={1}
        style={{ display: 'none' }}
        onLoad={handleImageLoad}
        priority
      />
    </>
  );
}
