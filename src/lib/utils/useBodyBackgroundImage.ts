import { useEffect } from 'react';

export function useBodyBackgroundImage(backgroundImageUrl?: string) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Determine which URL to use: prop or stored
    let urlToUse = backgroundImageUrl;
    try {
      const stored = localStorage.getItem('lastBgUrl');
      if (!urlToUse && stored) {
        urlToUse = stored;
      }
    } catch {}

    // Persist new URL
    if (backgroundImageUrl) {
      try { localStorage.setItem('lastBgUrl', backgroundImageUrl); } catch {}
    }

    const styleId = 'body-background-style';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    if (urlToUse) {
      styleElement.textContent = `
        html {
          background-image: url(${urlToUse}) !important;
          background-size: cover !important;
          background-position: center !important;
          background-repeat: no-repeat !important;
          background-attachment: fixed !important;
          background-color: #000 !important;
        }
        body::before {
          background-image: url(${urlToUse}) !important;
          background-color: #000 !important;
        }
      `;
    } else {
      // Remove overrides to fallback to CSS
      styleElement.textContent = '';
    }

    return () => {
      // Cleanup style element
      if (typeof window !== 'undefined') {
        const el = document.getElementById(styleId);
        if (el) el.remove();
      }
    };
  }, [backgroundImageUrl]);
}
