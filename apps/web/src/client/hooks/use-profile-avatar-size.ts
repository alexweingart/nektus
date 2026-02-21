'use client';

import { useState, useEffect } from 'react';

/**
 * Dynamic avatar size matching iOS: 50% of viewport width, clamped 120-300px.
 */
export function useProfileAvatarSize() {
  const [size, setSize] = useState(188); // ~50% of 375px iPhone
  useEffect(() => {
    const update = () => setSize(Math.min(Math.max(window.innerWidth * 0.5, 120), 300));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return size;
}
