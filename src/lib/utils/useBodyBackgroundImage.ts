import { useEffect } from 'react';

export function useBodyBackgroundImage(backgroundImageUrl?: string) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Create or update a style element for the body::before pseudo-element
    const styleId = 'body-background-style';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    if (backgroundImageUrl) {
      styleElement.textContent = `
        body::before {
          background-image: url(${backgroundImageUrl}) !important;
          background-color: #004D40 !important;
        }
      `;
    } else {
      styleElement.textContent = `
        body::before {
          background-image: none !important;
          background-color: #004D40 !important;
        }
      `;
    }

    // Cleanup function
    return () => {
      if (typeof window !== 'undefined') {
        const element = document.getElementById(styleId);
        if (element) {
          element.remove();
        }
      }
    };
  }, [backgroundImageUrl]);
}
