/**
 * AppClip.tsx - App Clip Entry Point
 *
 * This is a minimal entry point for the iOS App Clip.
 * It renders the OnboardingView starting at step 1 (Sign in with Apple).
 *
 * The App Clip handles:
 * - Step 1: Sign in with Apple (auto-triggered)
 * - Step 2: Show SKOverlay for full app installation
 *
 * Step 3 (Contact Sharing) happens in the full app after handoff.
 */

import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppClipOnboardingView } from "./app/components/views/AppClipOnboardingView";

export default function AppClip() {
  // App Clip uses minimal onboarding without Firebase SDK or expo-contacts

  const handleComplete = () => {
    // Onboarding complete in App Clip means user has:
    // 1. Signed in with Apple
    // 2. Been prompted to install the full app
    // Session is stored for handoff - full app will continue from step 3
    console.log("[AppClip] Onboarding steps 1-2 complete, awaiting full app install");
  };

  return (
    <SafeAreaProvider>
      <AppClipOnboardingView onComplete={handleComplete} />
    </SafeAreaProvider>
  );
}
