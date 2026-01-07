/**
 * Platform detection utilities for web apps
 * Used to detect iOS and Android platforms for platform-specific behaviors
 */

const EMBEDDED_BROWSER_INDICATORS = [
  'gsa/', 'googleapp', 'fb', 'fban', 'fbav', 'instagram', 'twitter', 'line/', 'wechat', 'weibo', 'webview'
];

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

/**
 * Get the iOS version from user agent
 * Returns null if not iOS or version cannot be determined
 */
export const getIOSVersion = (): number | null => {
  if (typeof window === 'undefined') return null;

  const userAgent = navigator.userAgent;

  // Check if it's iOS
  if (!/iPad|iPhone|iPod/.test(userAgent)) return null;

  // Extract version from "OS X_Y_Z" pattern (e.g., "OS 17_0_1")
  const match = userAgent.match(/OS (\d+)[_.](\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }

  return null;
};

/**
 * Check if device is iOS 17 or higher
 * Returns false for non-iOS devices or if version cannot be determined
 */
export const isIOS17OrHigher = (): boolean => {
  const version = getIOSVersion();
  return version !== null && version >= 17;
};

/**
 * Check if we're in an embedded browser (like in-app browsers)
 */
export const isEmbeddedBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  const userAgent = navigator.userAgent.toLowerCase();
  return EMBEDDED_BROWSER_INDICATORS.some(indicator => userAgent.includes(indicator));
}; 