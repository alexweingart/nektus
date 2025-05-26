// Fallback content for when OpenAI API is unavailable or quota is exceeded

// Fallback bios based on the user's name
export const generateFallbackBio = (name: string): string => {
  const fallbackBios = [
    `${name} - Connecting through technology`,
    `${name} - Digital innovator and connector`,
    `${name} - Building meaningful connections`,
    `${name} - Passionate about connecting people`,
    `${name} - Bringing people together through tech`,
  ];
  
  // Select a bio based on a hash of the user's name for consistency
  const nameHash = name.split('').reduce((sum: number, char: string) => sum + char.charCodeAt(0), 0);
  return fallbackBios[nameHash % fallbackBios.length];
};

// Fallback background images 
export const getFallbackBackground = (name: string): string => {
  const fallbackBackgrounds = [
    '/gradient-bg.jpg',
    '/gradient-blue.jpg',
    '/gradient-purple.jpg'
  ];
  
  // Select a background based on a hash of the user's name for consistency
  const nameHash = name.split('').reduce((sum: number, char: string) => sum + char.charCodeAt(0), 0);
  return fallbackBackgrounds[nameHash % fallbackBackgrounds.length];
};

// Fallback avatar images (if we had custom avatar images)
export const getFallbackAvatar = (name: string, currentPicture?: string): string => {
  // If there's already a picture, use it
  if (currentPicture && currentPicture.length > 0) {
    return currentPicture;
  }
  
  // Otherwise use the default avatar
  return '/default-avatar.png';
};
