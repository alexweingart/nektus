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
 * Check if we're in an embedded browser (like in-app browsers)
 */
export const isEmbeddedBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  const userAgent = navigator.userAgent.toLowerCase();
  return EMBEDDED_BROWSER_INDICATORS.some(indicator => userAgent.includes(indicator));
}; 