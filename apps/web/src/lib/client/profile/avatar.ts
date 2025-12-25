/**
 * Generates an SVG initials avatar
 * Used for profile images when user hasn't uploaded their own photo
 */

import { getInitials, stringToColor } from '@nektus/shared-utils';

// Re-export for convenience
export { getInitials, stringToColor };

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
