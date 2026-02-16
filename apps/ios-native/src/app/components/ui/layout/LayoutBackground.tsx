import React, { useMemo, useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ParticleNetwork, ParticleNetworkProps } from "./ParticleNetwork";
import { useProfile } from "../../../../app/context/ProfileContext";
import { useSession } from "../../../../app/providers/SessionProvider";
import { useCurrentRoute } from "../../../../app/context/RouteContext";
import { animationEvents } from "../../../utils/animationEvents";
import { generateProfileColors } from "../../../../shared/colors";
import { hexToRgba, convertToParticleColors, THEME_GREEN, THEME_DARK, DEFAULT_SIGNED_OUT_COLORS } from "../../../utils/colors";

// Default colors for profile/contact context (inverted signed-out colors) - matches web
const DEFAULT_PROFILE_COLORS = {
  gradientStart: THEME_DARK,                 // Dark in middle (inverted)
  gradientEnd: THEME_GREEN,                  // Green at top/bottom (symmetric)
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

  // Store contact colors when match-found event fires (for crossfade)
  const [contactColors, setContactColors] = useState<string[] | null>(null);
  // Track if we've been on Contact screen (to know when we're leaving vs arriving)
  const [wasOnContactScreen, setWasOnContactScreen] = useState(false);

  // Listen for match-found events to capture contact's background colors
  useEffect(() => {
    const unsubscribe = animationEvents.on('match-found', (data) => {
      if (data?.backgroundColors && data.backgroundColors.length >= 3) {
        console.log('[LayoutBackground] Received contact colors:', data.backgroundColors);
        setContactColors(data.backgroundColors);
      }
    });

    return () => unsubscribe();
  }, []);

  // Track Contact screen visits
  const isOnContactScreen = currentRouteName === 'Contact' || currentRouteName === 'SmartSchedule' || currentRouteName === 'AISchedule';

  useEffect(() => {
    if (isOnContactScreen) {
      setWasOnContactScreen(true);
    }
  }, [isOnContactScreen]);

  // Clear contact colors only when LEAVING Contact screen (not before arriving)
  useEffect(() => {
    // Only clear if we were previously on Contact and now we're not
    if (!isOnContactScreen && wasOnContactScreen && contactColors) {
      console.log('[LayoutBackground] Clearing contact colors (left contact screen)');
      setContactColors(null);
      setWasOnContactScreen(false);
    }
  }, [isOnContactScreen, wasOnContactScreen, contactColors]);

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

    // For contact context with contact's colors (from match-found event)
    if ((particleContext === "contact" || particleContext === "connect") && contactColors && contactColors.length >= 3) {
      // Check if colors are custom (not all the same) - indicates extracted from real image
      const [c1, c2, c3] = contactColors;
      const hasCustomColors = !(c1 === c2 && c2 === c3);

      if (hasCustomColors) {
        // Use contact's custom colors (extracted from real profile image)
        return convertToParticleColors(contactColors);
      } else {
        // Has colors but all the same (AI-generated avatar default) - use their color for gradient
        // Matches web: use DEFAULT_PROFILE_COLORS with dominant color at 30% opacity
        const dominantColor = contactColors[0];
        return {
          ...DEFAULT_PROFILE_COLORS,
          gradientEnd: hexToRgba(dominantColor, 0.3),
        };
      }
    }

    // For profile context with custom colors
    if ((particleContext === "profile" || particleContext === "profile-default") &&
        profile && profile.backgroundColors && profile.backgroundColors.length >= 3) {
      // Check if colors are custom (not all the same)
      const [c1, c2, c3] = profile.backgroundColors;
      const hasCustomColors = !(c1 === c2 && c2 === c3);

      if (hasCustomColors) {
        return convertToParticleColors(profile.backgroundColors);
      } else {
        // Has colors but all the same (AI-generated avatar) - use their color for gradient
        const dominantColor = profile.backgroundColors[0];
        return {
          ...DEFAULT_PROFILE_COLORS,
          gradientEnd: hexToRgba(dominantColor, 0.3),
        };
      }
    }

    // For contact context without contact colors - use default profile colors
    if (particleContext === "contact" || particleContext === "connect") {
      return DEFAULT_PROFILE_COLORS;
    }

    // Default for profile contexts without custom colors — generate from name
    if (particleContext === "profile" || particleContext === "profile-default") {
      if (profile) {
        const name = profile.contactEntries?.find((e: any) => e.fieldType === 'name')?.value;
        if (name) {
          return convertToParticleColors(generateProfileColors(name));
        }
      }
      return DEFAULT_PROFILE_COLORS;
    }

    // Fallback
    return DEFAULT_SIGNED_OUT_COLORS;
  }, [particleColors, particleContext, profile, status, contactColors]);

  // Use dominant color as background for proper gradient blending
  const effectiveBackgroundColor = useMemo(() => {
    // Contact context with contact colors
    if ((particleContext === "contact" || particleContext === "connect") && contactColors && contactColors.length >= 3) {
      // Check if colors are custom (not all the same)
      const [c1, c2, c3] = contactColors;
      const hasCustomColors = !(c1 === c2 && c2 === c3);

      if (hasCustomColors) {
        // Custom colors - use dominant
        return contactColors[0];
      } else {
        // AI avatar (uniform colors) - use dark background for particle network visibility
        return backgroundColor;
      }
    }
    // Profile context with profile colors
    if ((particleContext === "profile" || particleContext === "profile-default") &&
        profile && profile.backgroundColors && profile.backgroundColors.length >= 3) {
      // Check if colors are custom (not all the same)
      const [c1, c2, c3] = profile.backgroundColors;
      const hasCustomColors = !(c1 === c2 && c2 === c3);

      if (hasCustomColors) {
        return profile.backgroundColors[0];
      } else {
        // AI avatar (uniform colors) - use dark background
        return backgroundColor;
      }
    }
    // No backgroundColors but has a name — use generated dominant color
    if ((particleContext === "profile" || particleContext === "profile-default") && profile) {
      const name = profile.contactEntries?.find((e: any) => e.fieldType === 'name')?.value;
      if (name) {
        return generateProfileColors(name)[0];
      }
    }
    return backgroundColor;
  }, [particleContext, profile, backgroundColor, contactColors]);

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
