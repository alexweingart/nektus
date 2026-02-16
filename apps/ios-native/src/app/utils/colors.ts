/**
 * Shared color utilities for particle network theming.
 * Used by both the main app (LayoutBackground) and the App Clip.
 */

import type { ParticleNetworkProps } from '../components/ui/layout/ParticleNetworkLite';
import { BACKGROUND_GREEN, BACKGROUND_BLACK } from '../../shared/colors';

// Background theme constants
export const THEME_DARK = BACKGROUND_BLACK;
export const THEME_GREEN = BACKGROUND_GREEN;

/**
 * Convert a hex color string to an rgba string.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Convert profile backgroundColors array to ParticleNetwork colors.
 * EXACTLY matches web - uses same 0.4 alpha on accent1 for middle gradient color.
 */
export function convertToParticleColors(backgroundColors: string[]): NonNullable<ParticleNetworkProps['colors']> {
  const [dominant, accent1, accent2] = backgroundColors;
  return {
    gradientStart: hexToRgba(accent1, 0.4),
    gradientEnd: dominant,
    particle: hexToRgba(accent2, 0.8),
    connection: hexToRgba(accent2, 0.4),
  };
}

/**
 * Default particle colors for signed-out / connect theme.
 */
export const DEFAULT_SIGNED_OUT_COLORS: NonNullable<ParticleNetworkProps['colors']> = {
  gradientStart: THEME_GREEN,
  gradientEnd: THEME_DARK,
  particle: 'rgba(200, 255, 200, 0.6)',
  connection: 'rgba(34, 197, 94, 0.15)',
};
