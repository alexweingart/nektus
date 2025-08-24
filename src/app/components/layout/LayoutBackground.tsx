'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useProfile } from '../../context/ProfileContext';

/**
 * Layout-level background manager
 * Renders persistent custom background div for authenticated users with background images
 * Preloads images before displaying to prevent black screen flashes
 * Uses ref-based caching to prevent re-loading during navigation
 */
export function LayoutBackground() {
  const { profile, isLoading, streamingBackgroundImage } = useProfile();
  const [mounted, setMounted] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showBackground, setShowBackground] = useState(false);
  
  // Cache loaded image URLs to prevent re-loading during navigation
  const loadedImagesRef = useRef(new Set<string>());

  // Helper function to get base URL for comparison (without cache busting)
  const getBaseUrl = (url: string): string => {
    return url.replace(/[\n\r\t]/g, '').trim();
  };

  // Stable timestamp for cache busting - only changes when base URL changes
  const stableTimestampRef = useRef<{ url: string; timestamp: number } | null>(null);
  
  // Helper function to clean and prepare image URL with stable cache busting
  const cleanImageUrl = (url: string): string => {
    const baseUrl = getBaseUrl(url);
    
    // Only generate new timestamp if base URL changed
    if (!stableTimestampRef.current || stableTimestampRef.current.url !== baseUrl) {
      stableTimestampRef.current = {
        url: baseUrl,
        timestamp: Date.now()
      };
    }
    
    let cleanedUrl = baseUrl;
    if (cleanedUrl.includes('firebase') || cleanedUrl.includes('googleusercontent.com')) {
      const separator = cleanedUrl.includes('?') ? '&' : '?';
      cleanedUrl = `${cleanedUrl}${separator}v=${stableTimestampRef.current.timestamp}`;
    }
    return cleanedUrl;
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle hidden img loading events
  const handleImageLoad = useCallback(() => {
    const backgroundImageUrl = streamingBackgroundImage || profile?.backgroundImage;
    if (backgroundImageUrl) {
      const cleanedUrl = cleanImageUrl(backgroundImageUrl);
      
      // Add delay to ensure progressive JPEG is fully rendered
      setTimeout(() => {
        setIsImageLoaded(true);
        setImageError(false);
        // Cache this URL as successfully loaded
        loadedImagesRef.current.add(cleanedUrl);
        
        // Trigger blur-to-sharp transition quickly
        setTimeout(() => {
          setShowBackground(true);
        }, 100); // Quick transition for fast blur-up
      }, 0); // No delay
    }
  }, [streamingBackgroundImage, profile?.backgroundImage]);

  const handleImageError = useCallback(() => {
    setImageError(true);
    setIsImageLoaded(false);
  }, []);

  // Store previous URL to detect actual changes
  const prevUrlRef = useRef<string>('');
  
  // Reset states only when background image URL actually changes
  useEffect(() => {
    const backgroundImageUrl = streamingBackgroundImage || profile?.backgroundImage;
    
    if (!mounted || !backgroundImageUrl || isLoading) {
      setIsImageLoaded(false);
      setImageError(false);
      setShowBackground(false);
      prevUrlRef.current = '';
      return;
    }

    const baseUrl = getBaseUrl(backgroundImageUrl);
    const cleanedUrl = cleanImageUrl(backgroundImageUrl);
    
    // Only reset if the base URL actually changed (ignore cache busting)
    if (prevUrlRef.current === baseUrl) {
      return; // Same base URL, no need to reset
    }
    
    prevUrlRef.current = baseUrl;

    // Skip setup if image was already loaded this session
    if (loadedImagesRef.current.has(cleanedUrl)) {
      setIsImageLoaded(true);
      setImageError(false);
      setShowBackground(true); // Show immediately for cached images
      return;
    }

    // Start loading state - the hidden img will trigger load events
    setImageError(false);
    setIsImageLoaded(false);
    setShowBackground(false);
  }, [mounted, streamingBackgroundImage, profile?.backgroundImage]);

  // Only hide green background AFTER profile loads AND custom image is loaded and ready
  useEffect(() => {
    if (!mounted) return;

    // CRITICAL: Never hide green background during profile loading to prevent black flash
    if (isLoading) {
      document.body.classList.remove('has-custom-background');
      return;
    }

    return () => {
      // Cleanup: no DOM manipulation needed for direct div approach
    };
  }, [mounted, streamingBackgroundImage, profile?.backgroundImage, isImageLoaded, imageError]);

  // Don't render on server, during profile loading, if no background image, or on error
  const backgroundImageUrl = streamingBackgroundImage || profile?.backgroundImage;
  if (!mounted || isLoading || !backgroundImageUrl || imageError) {
    return null;
  }

  const cleanedUrl = cleanImageUrl(backgroundImageUrl);

  return (
    <>
      {/* Hidden img tag for immediate loading - loads before DOM ready unlike background-image */}
      <Image
        src={cleanedUrl}
        alt=""
        width={1}
        height={1}
        style={{ display: 'none' }}
        onLoad={handleImageLoad}
        onError={handleImageError}
        priority
      />
      
      {/* Background overlay with fast blur-up technique */}
      {isImageLoaded && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `url("${cleanedUrl}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            zIndex: 1, // Above safe-area elements but behind content
            opacity: showBackground ? 1 : 0, // Start at 0% opacity
            pointerEvents: 'none', // Critical: allows clicks to pass through
            transition: 'opacity 1s ease-out' // Simple 1 second fade-in
          }}
        />
      )}
    </>
  );
}