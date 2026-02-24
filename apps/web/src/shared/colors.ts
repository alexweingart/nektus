// Canonical color constants for the Nektus app.
// All client and server files should import from here.

// Brand colors (from logo gradient)
export const BRAND_LIGHT_GREEN = '#E7FED2';
export const BRAND_DARK_GREEN = '#71E454';
export const BRAND_DARK_GREEN_RGB = '113, 228, 84'; // for CSS var usage

// Default accent color (used for links, loading indicators when no profile color)
export const DEFAULT_ACCENT_GREEN = '#10B981';  // emerald-500

// Background colors (particle network gradient endpoints)
export const BACKGROUND_BLACK = '#0a0f1a';    // rgb(10, 15, 26)
export const BACKGROUND_GREEN = '#145835';    // rgb(20, 88, 53)
export const BACKGROUND_GREEN_RGB = '20, 88, 53';

// Text colors
export const TEXT_BLACK = '#004D40';
export const TEXT_WHITE = '#ffffff';
export const TEXT_RED = '#ef4444';
export const TEXT_GREY = '#666666';

// Border
export const BORDER = '#d5dbe5';

/**
 * Convert HSL values to a hex color string.
 * @param h Hue in degrees [0, 360)
 * @param s Saturation as a percentage [0, 100]
 * @param l Lightness as a percentage [0, 100]
 */
export function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }

  const toHex = (v: number) => {
    const hex = Math.round((v + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Ensure a hex color has readable lightness by clamping to a range.
 * Converts to HSL, clamps lightness between min and max, and converts back.
 * - For dark backgrounds: ensureReadableColor(hex, 60) — lightens dark colors
 * - For light backgrounds: ensureReadableColor(hex, 40, 40) — darkens light colors
 */
export function ensureReadableColor(hex: string, minLightness = 60, maxLightness = 100): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  l = Math.max(l, minLightness / 100);
  l = Math.min(l, maxLightness / 100);

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r2: number, g2: number, b2: number;
  if (s === 0) {
    r2 = g2 = b2 = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r2 = hue2rgb(p, q, h + 1 / 3);
    g2 = hue2rgb(p, q, h);
    b2 = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex2 = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${toHex2(r2)}${toHex2(g2)}${toHex2(b2)}`;
}

/**
 * Generate 3 distinct complementary profile colors seeded from a user's name.
 * Returns [dominant, accent1, accent2] in the same format as colors extracted from photos.
 *
 * - dominant (index 0): dark, rich — used as gradientEnd (main background)
 * - accent1 (index 1): shifted hue, also dark — used as gradientStart at 40% opacity
 * - accent2 (index 2): near-complement, bright and vivid — particles + connections
 */
export function generateProfileColors(name: string): [string, string, string] {
  // Hash the name using djb2 algorithm (better distribution than simple polynomial)
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash) ^ name.charCodeAt(i);
    hash = hash >>> 0; // Convert to unsigned 32-bit integer
  }

  // Derive base hue from hash (0-359)
  const baseHue = hash % 360;

  // Use different bits of the hash for variation
  const hash2 = Math.abs(hash >> 8);
  const hash3 = Math.abs(hash >> 16);

  // dominant: dark, rich background color
  const dominantHue = baseHue;
  const dominantSat = 45 + (hash2 % 25);       // 45-69%
  const dominantLight = 12 + (hash3 % 7);       // 12-18%

  // accent1: shifted hue ~60-80°, significantly lighter than dominant for strong contrast
  const accent1Hue = (baseHue + 55 + (hash2 % 25)) % 360;  // 55-79° shift
  const accent1Sat = 45 + (hash3 % 20);         // 45-64%
  const accent1Light = 55 + (hash2 % 15);        // 55-69% (very visible)

  // accent2: mirrored split ~-55-79°, symmetric with accent1
  const accent2Hue = (baseHue - 55 - (hash3 % 25) + 360) % 360;  // -55 to -79° shift
  const accent2Sat = 45 + (hash2 % 15);         // 45-59% (more muted)
  const accent2Light = 50 + (hash3 % 13);        // 50-62%

  return [
    hslToHex(dominantHue, dominantSat, dominantLight),
    hslToHex(accent1Hue, accent1Sat, accent1Light),
    hslToHex(accent2Hue, accent2Sat, accent2Light),
  ];
}
