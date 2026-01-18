import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ParticleNetworkLite as ParticleNetwork, ParticleNetworkProps } from "./ParticleNetworkLite";
import { useProfile } from "../../../../app/context/ProfileContext";
import { useSession } from "../../../../app/providers/SessionProvider";
import { useCurrentRoute } from "../../../../app/context/RouteContext";

// Helper function to convert hex to rgba
function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Convert profile backgroundColors to ParticleNetwork colors
// EXACTLY matches web - uses same 0.4 alpha on accent1 for middle gradient color
function convertToParticleColors(backgroundColors: string[]) {
  const [dominant, accent1, accent2] = backgroundColors;
  return {
    gradientStart: hexToRgba(accent1, 0.4),   // EXACTLY matches web (0.4 alpha)
    gradientEnd: dominant,                     // Dominant at top and bottom (symmetric)
    particle: hexToRgba(accent2, 0.8),        // Matches web
    connection: hexToRgba(accent2, 0.4)       // Matches web
  };
}

// Default colors for signed-out context - matches web
const DEFAULT_SIGNED_OUT_COLORS = {
  gradientStart: 'rgba(34, 197, 94, 0.3)',   // Green in middle
  gradientEnd: 'rgb(10, 15, 26)',            // Dark at top/bottom
  particle: 'rgba(200, 255, 200, 0.6)',
  connection: 'rgba(34, 197, 94, 0.15)'
};

// Default colors for profile/contact context (inverted signed-out colors) - matches web
const DEFAULT_PROFILE_COLORS = {
  gradientStart: 'rgb(10, 15, 26)',          // Dark in middle (inverted)
  gradientEnd: 'rgba(34, 197, 94, 0.3)',     // Green at top/bottom (symmetric)
  particle: 'rgba(200, 255, 200, 0.8)',      // Brighter particles
  connection: 'rgba(34, 197, 94, 0.4)'       // More visible connections
};

// Map route names to particle contexts
const ROUTE_TO_CONTEXT: Record<string, ParticleNetworkProps["context"]> = {
  // Unauthenticated
  Home: "signed-out",
  Privacy: "signed-out",
  Terms: "signed-out",
  // Setup
  ProfileSetup: "profile-default",
  // Authenticated
  Profile: "profile",
  EditProfile: "profile",
  Contact: "contact",
  History: "profile",
  Calendar: "profile",
  Location: "profile",
  SmartSchedule: "contact",
  AISchedule: "contact",
};

interface LayoutBackgroundProps {
  children: React.ReactNode;
  /** Override ParticleNetwork context (auto-detected from route if not provided) */
  particleContext?: ParticleNetworkProps["context"];
  /** Custom ParticleNetwork colors (auto-detected from profile if not provided) */
  particleColors?: ParticleNetworkProps["colors"];
  /** Whether to show ParticleNetwork background (default: true) */
  showParticles?: boolean;
  /** Background color fallback */
  backgroundColor?: string;
  /** Apply safe area padding to content (default: true) */
  applySafeArea?: boolean;
}

/**
 * LayoutBackground - wrapper component that handles:
 * - ParticleNetwork positioned as absolute background (edge-to-edge, behind notch)
 * - Safe area padding for content (top, left, right)
 * - Auto-detects route to set appropriate particle context (like web)
 * - Matches web's LayoutBackground pattern
 */
export function LayoutBackground({
  children,
  particleContext: overrideContext,
  particleColors,
  showParticles = true,
  backgroundColor = "#0a0f1a",
  applySafeArea = true,
}: LayoutBackgroundProps) {
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { status } = useSession();

  // Get current route name from context (tracked at NavigationContainer level)
  const currentRouteName = useCurrentRoute();

  // Determine particle context from route (or use override)
  const particleContext = useMemo(() => {
    if (overrideContext) return overrideContext;
    if (!currentRouteName) return "signed-out";
    return ROUTE_TO_CONTEXT[currentRouteName] || "signed-out";
  }, [overrideContext, currentRouteName]);

  // Determine colors to use based on context and profile
  const effectiveColors = useMemo(() => {
    // If colors explicitly provided, use those
    if (particleColors) {
      return particleColors;
    }

    // For signed-out context
    if (particleContext === "signed-out" || status === "unauthenticated") {
      return DEFAULT_SIGNED_OUT_COLORS;
    }

    // For profile context with custom colors
    if ((particleContext === "profile" || particleContext === "profile-default") &&
        profile && profile.backgroundColors && profile.backgroundColors.length >= 3) {
      // Check if colors are custom (not all the same)
      const [c1, c2, c3] = profile.backgroundColors;
      const hasCustomColors = !(c1 === c2 && c2 === c3);
      if (hasCustomColors) {
        return convertToParticleColors(profile.backgroundColors);
      }
    }

    // For contact context - use default profile colors (inverted)
    if (particleContext === "contact" || particleContext === "connect") {
      return DEFAULT_PROFILE_COLORS;
    }

    // Default for profile contexts without custom colors
    if (particleContext === "profile" || particleContext === "profile-default") {
      return DEFAULT_PROFILE_COLORS;
    }

    // Fallback
    return DEFAULT_SIGNED_OUT_COLORS;
  }, [particleColors, particleContext, profile, status]);

  // Use dominant color as background for proper gradient blending
  const effectiveBackgroundColor = useMemo(() => {
    if ((particleContext === "profile" || particleContext === "profile-default") &&
        profile && profile.backgroundColors && profile.backgroundColors.length >= 3) {
      return profile.backgroundColors[0];
    }
    return backgroundColor;
  }, [particleContext, profile, backgroundColor]);

  return (
    <View style={[styles.container, { backgroundColor: effectiveBackgroundColor }]}>
      {/* ParticleNetwork - absolute positioned, extends behind notch/home indicator */}
      {showParticles && (
        <ParticleNetwork context={particleContext} colors={effectiveColors} />
      )}

      {/* Content - with safe area padding */}
      <View
        style={[
          styles.content,
          applySafeArea && {
            paddingTop: insets.top,
            paddingLeft: insets.left,
            paddingRight: insets.right,
            // Note: bottom padding is handled by individual views (for footer handling)
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    zIndex: 1, // Above ParticleNetwork
  },
});

export default LayoutBackground;
