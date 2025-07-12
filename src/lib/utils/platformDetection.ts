/**
 * Platform detection utilities for web apps
 * Used to detect iOS and Android platforms for platform-specific behaviors
 */

export const detectPlatform = () => {
  if (typeof window === 'undefined') {
    return { isIOS: false, isAndroid: false };
  }

  const userAgent = navigator.userAgent.toLowerCase();
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /android/i.test(userAgent);

  return {
    isIOS,
    isAndroid,
    isMobile: isIOS || isAndroid,
    platform: isIOS ? 'ios' : isAndroid ? 'android' : 'web'
  };
};

export const isIOSPlatform = () => detectPlatform().isIOS;
export const isAndroidPlatform = () => detectPlatform().isAndroid;
export const isMobilePlatform = () => detectPlatform().isMobile; 