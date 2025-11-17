'use client';

import { useEffect, useState } from 'react';

/**
 * Animated glowing dots that travel along the diagonal line patterns
 * in the background. Creates a subtle, living effect.
 */
export function BackgroundGlowDots() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Don't render dots if user prefers reduced motion
  if (prefersReducedMotion) {
    return null;
  }

  return (
    <svg
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1 }}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Subtle white glow filter for the dots */}
        <filter id="whiteGlow">
          <feGaussianBlur stdDeviation="0.7" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Dot traveling along 45deg line (bottom-left to top-right) */}
      <circle r="0.15" fill="rgba(255, 255, 255, 0.35)" filter="url(#whiteGlow)">
        <animateMotion
          dur="25s"
          repeatCount="indefinite"
          path="M -10 110 L 110 -10"
          calcMode="linear"
        />
        <animate
          attributeName="opacity"
          values="0;1;1;0"
          keyTimes="0;0.1;0.9;1"
          dur="25s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Dot traveling along -45deg line (top-left to bottom-right) */}
      <circle r="0.15" fill="rgba(255, 255, 255, 0.35)" filter="url(#whiteGlow)">
        <animateMotion
          dur="30s"
          repeatCount="indefinite"
          path="M -10 -10 L 110 110"
          calcMode="linear"
        />
        <animate
          attributeName="opacity"
          values="0;1;1;0"
          keyTimes="0;0.1;0.9;1"
          dur="30s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Another dot on 45deg with delay */}
      <circle r="0.15" fill="rgba(255, 255, 255, 0.35)" filter="url(#whiteGlow)">
        <animateMotion
          dur="28s"
          repeatCount="indefinite"
          begin="5s"
          path="M 20 130 L 130 20"
          calcMode="linear"
        />
        <animate
          attributeName="opacity"
          values="0;1;1;0"
          keyTimes="0;0.1;0.9;1"
          dur="28s"
          begin="5s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Another dot on -45deg with delay */}
      <circle r="0.15" fill="rgba(255, 255, 255, 0.35)" filter="url(#whiteGlow)">
        <animateMotion
          dur="32s"
          repeatCount="indefinite"
          begin="8s"
          path="M 110 -10 L -10 110"
          calcMode="linear"
        />
        <animate
          attributeName="opacity"
          values="0;1;1;0"
          keyTimes="0;0.1;0.9;1"
          dur="32s"
          begin="8s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Another dot with different timing */}
      <circle r="0.15" fill="rgba(255, 255, 255, 0.35)" filter="url(#whiteGlow)">
        <animateMotion
          dur="20s"
          repeatCount="indefinite"
          begin="12s"
          path="M -20 120 L 120 -20"
          calcMode="linear"
        />
        <animate
          attributeName="opacity"
          values="0;1;1;0"
          keyTimes="0;0.1;0.9;1"
          dur="20s"
          begin="12s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Additional dot on -45deg */}
      <circle r="0.15" fill="rgba(255, 255, 255, 0.35)" filter="url(#whiteGlow)">
        <animateMotion
          dur="27s"
          repeatCount="indefinite"
          begin="15s"
          path="M 130 30 L 30 130"
          calcMode="linear"
        />
        <animate
          attributeName="opacity"
          values="0;1;1;0"
          keyTimes="0;0.1;0.9;1"
          dur="27s"
          begin="15s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}
