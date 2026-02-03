import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { BRAND_DARK_GREEN } from "@/shared/colors"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Pre-computed fallback RGB from brand green constant
const DEFAULT_RGB = (() => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(BRAND_DARK_GREEN)!;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
})();

/**
 * Converts a hex color string to RGB components
 * Used for Liquid Glass dynamic color tinting
 * @param hex - Hex color string (with or without #)
 * @returns Object with r, g, b values (0-255)
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : DEFAULT_RGB;
}
