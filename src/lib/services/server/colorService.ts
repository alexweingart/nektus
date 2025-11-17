// We now rely on the Node-friendly `get-image-colors` package which performs k-means
// clustering on the image's pixels and works directly with Buffers (no DOM/canvas
// required). This produces results consistent with the official Color Thief demo.
import getColors from 'get-image-colors';
import type { Color } from 'chroma-js';
import { fileTypeFromBuffer } from 'file-type';

// Helper to convert RGB array to HEX string
const rgbToHex = (r: number, g: number, b: number): string => 
  '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');

/**
 * Extracts the dominant (most frequent) colour from an image buffer.
 * Falls back to a naive byte-sampling strategy if library extraction fails.
 */
export async function getDominantColor(imageBuffer: Buffer): Promise<string> {
  try {
    const detected = await fileTypeFromBuffer(imageBuffer);
    const mime = detected?.mime || 'image/jpeg';
    const [color] = await getColors(imageBuffer, { count: 1, type: mime });
    return color.hex();
  } catch (error) {
    console.error('Error getting dominant color with get-image-colors, falling back:', error);
    const r = imageBuffer[0] || 0;
    const g = imageBuffer[Math.floor(imageBuffer.length / 2)] || 0;
    const b = imageBuffer[imageBuffer.length - 1] || 0;
    return rgbToHex(r, g, b);
  }
}

/**
 * Extracts a colour palette from an image buffer.
 * Returns `colorCount` distinct HEX colours ordered by prominence.
 * Falls back to the previous byte-sampling implementation on failure so the
 * calling code never breaks.
 */
export async function getColorPalette(
  imageBuffer: Buffer,
  colorCount: number = 3
): Promise<string[]> {
  try {
    const detected = await fileTypeFromBuffer(imageBuffer);
    const mime = detected?.mime || 'image/jpeg';
    const colors = await getColors(imageBuffer, { count: colorCount, type: mime }) as Color[];
    return colors.map((c: Color) => c.hex());
  } catch (error) {
    console.error('Error getting color palette with get-image-colors, falling back:', error);

    // --- Legacy byte-sampling fallback ---
    const palette: Array<[number, number, number]> = [];
    const step = Math.floor(imageBuffer.length / (colorCount * 3));
    for (let i = 0; i < colorCount; i++) {
      const pos = i * step * 3;
      if (pos < imageBuffer.length - 3) {
        const r = imageBuffer[pos] || 0;
        const g = imageBuffer[pos + 1] || 0;
        const b = imageBuffer[pos + 2] || 0;
        palette.push([r, g, b]);
      } else {
        palette.push([i * 85, 255 - i * 85, 128]);
      }
    }
    return palette.map(([r, g, b]) => rgbToHex(r, g, b));
  }
}

// Converts a HEX colour string to RGB tuple
export function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  const bigint = parseInt(cleaned, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b];
}

// Convert RGB 0-255 to HSV where h ∈ [0,360), s,v ∈ [0,1]
function rgbToHsv(r: number, g: number, b: number) {
  const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm), min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    switch (max) {
      case rNorm: h = ((gNorm - bNorm) / delta) % 6; break;
      case gNorm: h = (bNorm - rNorm) / delta + 2; break;
      case bNorm: h = (rNorm - gNorm) / delta + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return { h, s, v };
}

/**
 * From a palette, returns the `count` most colourful accents (high saturation & brightness).
 * Expects palette to be an array of HEX strings.
 */
export function pickAccentColors(palette: string[], count = 2): string[] {
  return palette
    .map(hex => {
      const [r, g, b] = hexToRgb(hex);
      const { s, v } = rgbToHsv(r, g, b);
      const score = s * Math.pow(v, 1.5); // emphasise bright colours
      return { hex, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(c => c.hex);
}

/**
 * Determines if a color is achromatic (black, grey, or white).
 * Uses HSV color space to check saturation - low saturation indicates achromatic colors.
 * @param hex HEX color string (e.g. '#FFFFFF')
 * @returns true if the color is achromatic (black/grey/white)
 */
export function isAchromatic(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  const { s } = rgbToHsv(r, g, b);

  // A color is achromatic if its saturation is very low
  // Threshold of 0.15 catches greys, blacks, and whites while allowing muted colors
  return s < 0.15;
}

/**
 * Filters a color palette to remove achromatic colors (black, grey, white).
 * Returns only chromatic (colorful) colors from the palette.
 * Falls back to a vibrant default green if all colors are filtered out.
 * @param palette Array of HEX color strings
 * @returns Array of chromatic HEX color strings (guaranteed at least 1 color)
 */
export function filterChromaticColors(palette: string[]): string[] {
  const chromatic = palette.filter(hex => !isAchromatic(hex));

  // If all colors were filtered out (rare case of completely grey/B&W image),
  // return a vibrant default color to ensure we always have something colorful
  if (chromatic.length === 0) {
    console.log('[COLOR] All palette colors were achromatic, using default vibrant color');
    return [getDefaultBackgroundColor()];
  }

  return chromatic;
}

/**
 * Returns a complementary background color for profile image generation.
 * This should harmonize with our default background's green accent theme.
 * Based on the default background green (#22c55e), returns a warm contrasting color.
 */
export function getDefaultBackgroundColor(): string {
  // Green color that matches the app's theme
  // This creates good contrast while remaining consistent with the brand
  return '#71E454'; // Green that matches the app's accent color
} 