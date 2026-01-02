/**
 * JavaScript wrapper for SKOverlay native module
 *
 * Provides React Native access to iOS SKOverlay for prompting
 * users to install the full app from an App Clip.
 */

import { NativeModules, Platform } from "react-native";

const { SKOverlayModule } = NativeModules;

/**
 * Show the App Store overlay to prompt full app installation
 *
 * Uses SKOverlay.AppClipConfiguration which automatically shows
 * the install banner for the parent app.
 *
 * Only works on iOS 14+, no-op on other platforms.
 */
export function showAppStoreOverlay(): void {
  if (Platform.OS !== "ios") {
    console.log("[SKOverlayWrapper] Not available on this platform");
    return;
  }

  if (!SKOverlayModule) {
    console.warn("[SKOverlayWrapper] Native module not available");
    return;
  }

  console.log("[SKOverlayWrapper] Showing App Store overlay");
  SKOverlayModule.showAppStoreOverlay();
}

/**
 * Dismiss the App Store overlay if currently showing
 */
export function dismissAppStoreOverlay(): void {
  if (Platform.OS !== "ios" || !SKOverlayModule) {
    return;
  }

  console.log("[SKOverlayWrapper] Dismissing App Store overlay");
  SKOverlayModule.dismissOverlay();
}
