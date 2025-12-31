/**
 * Generates an SVG initials avatar
 * Used for profile images when user hasn't uploaded their own photo
 *
 * TODO: Refactor to re-export shared functions from @nektus/shared-client
 * Pattern:
 *   1. Re-export: export { getInitials, stringToColor } from '@nektus/shared-client';
 *   2. Keep only web-specific functions here: generateInitialsAvatar, dataUrlToBuffer
 *   3. These web-specific functions use Node.js Buffer, which won't work on iOS
 */

/**
 * Extracts initials from a name
 * @param name - The user's name
 * @returns 1-2 character initials (uppercase)
 */
export function getInitials(name: string): string {
  if (!name || !name.trim()) return '?';

  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    // Single word: take first 2 characters
    return parts[0].substring(0, 2).toUpperCase();
  }

  // Multiple words: take first letter of first and last word
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Generates a deterministic color from a string
 * Creates pastel colors suitable for avatar backgrounds
 * @param str - Input string (typically user's name)
 * @returns HSL color string
 */
export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Generate a pastel color (high lightness, medium saturation)
  const hue = hash % 360;
  const saturation = 60 + (hash % 20); // 60-80%
  const lightness = 70 + (hash % 10);  // 70-80%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Generates an SVG initials avatar as a data URL
 * @param name - The user's name
 * @param size - Size in pixels (default 200)
 */
export function generateInitialsAvatar(name: string, size: number = 200): string {
  const initials = getInitials(name);
  const backgroundColor = stringToColor(name);

  // Text color: use dark gray for better contrast on pastel backgrounds
  const textColor = '#1f2937';

  // Font size is roughly 40% of the image size
  const fontSize = Math.floor(size * 0.4);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="${backgroundColor}"/>
      <text
        x="50%"
        y="50%"
        dominant-baseline="central"
        text-anchor="middle"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="${fontSize}"
        font-weight="600"
        fill="${textColor}"
      >${initials}</text>
    </svg>
  `.trim();

  // Convert SVG to base64 data URL
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Converts a data URL to a Buffer (for server-side use)
 */
export function dataUrlToBuffer(dataUrl: string): Buffer {
  const base64Data = dataUrl.split(',')[1];
  return Buffer.from(base64Data, 'base64');
}
