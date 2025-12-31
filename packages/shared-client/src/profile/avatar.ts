/**
 * Avatar utility functions
 * Shared between web and iOS for consistent avatar handling
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
