import { useEffect } from 'react';

interface UseHtmlBackgroundOptions {
  backgroundImage?: string | null;
  fallbackColor?: string;
}

/**
 * useHtmlBackground - Sets background image on HTML element for safe area coverage
 * 
 * This hook sets the background image directly on the HTML element to ensure
 * it covers the notch, status bar, and overscroll areas on mobile devices.
 * 
 * @param options - Background image URL and fallback color
 */
export const useHtmlBackground = (options: UseHtmlBackgroundOptions = {}) => {
  const {
    backgroundImage,
    fallbackColor = '#004D40'
  } = options;

  useEffect(() => {
    const html = document.documentElement;
    
    // Store original styles to restore later
    const originalStyles = {
      backgroundImage: html.style.backgroundImage,
      backgroundSize: html.style.backgroundSize,
      backgroundPosition: html.style.backgroundPosition,
      backgroundRepeat: html.style.backgroundRepeat,
      backgroundAttachment: html.style.backgroundAttachment,
      backgroundColor: html.style.backgroundColor,
    };

    if (backgroundImage) {
      // Set background image on HTML element
      html.style.backgroundImage = `url(${backgroundImage})`;
      html.style.backgroundSize = 'cover';
      html.style.backgroundPosition = 'center';
      html.style.backgroundRepeat = 'no-repeat';
      html.style.backgroundAttachment = 'fixed';
      html.style.backgroundColor = fallbackColor; // Fallback while image loads
    } else {
      // Use fallback color only
      html.style.backgroundImage = '';
      html.style.backgroundColor = fallbackColor;
    }

    // Cleanup function to restore original styles
    return () => {
      html.style.backgroundImage = originalStyles.backgroundImage;
      html.style.backgroundSize = originalStyles.backgroundSize;
      html.style.backgroundPosition = originalStyles.backgroundPosition;
      html.style.backgroundRepeat = originalStyles.backgroundRepeat;
      html.style.backgroundAttachment = originalStyles.backgroundAttachment;
      html.style.backgroundColor = originalStyles.backgroundColor;
    };
  }, [backgroundImage, fallbackColor]);
};
