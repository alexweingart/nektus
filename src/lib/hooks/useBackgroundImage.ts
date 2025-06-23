import { useEffect } from 'react';

/**
 * Sets the background image on the root <html> element.
 * This hook is designed to work with the server-side rendered background
 * by updating the inline style property directly on the client.
 * @param imageUrl The URL of the background image to apply.
 */
export function useBackgroundImage(imageUrl?: string | null) {
  useEffect(() => {
    // Ensure this only runs on the client
    if (typeof window === 'undefined') return;

    const newBg = imageUrl ? `url(${imageUrl})` : '';

    // Only update the DOM if the image URL has actually changed
    if (document.documentElement.style.backgroundImage !== newBg) {
      document.documentElement.style.backgroundImage = newBg;
    }
    
    // When the component unmounts or the URL changes, we can decide
    // whether to clear the background. For this app, we want it to persist,
    // so no cleanup is necessary.

  }, [imageUrl]);
} 