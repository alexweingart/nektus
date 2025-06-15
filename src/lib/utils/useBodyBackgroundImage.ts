import { useEffect } from 'react';

export function useBodyBackgroundImage(backgroundImageUrl?: string) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Create or update a style element for the body::before pseudo-element and html
    const styleId = 'body-background-style';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    if (backgroundImageUrl) {
      styleElement.textContent = `
        html {
          background-image: url(${backgroundImageUrl}) !important;
          background-size: cover !important;
          background-position: center !important;
          background-repeat: no-repeat !important;
          background-attachment: fixed !important;
        }
        body::before {
          background-image: url(${backgroundImageUrl}) !important;
          background-color: #004D40 !important;
        }
      `;
    } else {
      styleElement.textContent = `
        html {
          background-image: none !important;
          background-color: #004D40 !important;
        }
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
