import { useEffect } from 'react';

export function useBodyBackground(backgroundImageUrl?: string) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const body = document.body;
    
    if (backgroundImageUrl) {
      body.style.backgroundImage = `url(${backgroundImageUrl})`;
      body.style.backgroundColor = '#004D40'; // Fallback
    } else {
      body.style.backgroundImage = '';
      body.style.backgroundColor = '#004D40';
    }

    // Cleanup function
    return () => {
      if (typeof window !== 'undefined') {
        const body = document.body;
        body.style.backgroundImage = '';
        body.style.backgroundColor = '#004D40';
      }
    };
  }, [backgroundImageUrl]);
}
