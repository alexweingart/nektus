import React, { useMemo, useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ParticleNetwork, ParticleNetworkProps } from "./ParticleNetwork";
import { useProfile } from "../../../../app/context/ProfileContext";
import { useSession } from "../../../../app/providers/SessionProvider";
import { useCurrentRoute } from "../../../../app/context/RouteContext";
import { animationEvents } from "../../../utils/animationEvents";
import { generateProfileColors } from "../../../../shared/colors";
import { convertToParticleColors, THEME_GREEN, THEME_DARK, DEFAULT_SIGNED_OUT_COLORS } from "../../../utils/colors";

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
      console.log('[LayoutBackground] Using contact colors:', contactColors);
      return convertToParticleColors(contactColors);
    }

    // For profile context with custom colors
    if ((particleContext === "profile" || particleContext === "profile-default") &&
        profile && profile.backgroundColors && profile.backgroundColors.length >= 3) {
      console.log('[LayoutBackground] Using profile backgroundColors:', profile.backgroundColors);
      return convertToParticleColors(profile.backgroundColors);
    }

    // For contact context without contact colors - use dark while loading
    if (particleContext === "contact" || particleContext === "connect") {
      return {
        gradientStart: THEME_DARK,
        gradientEnd: THEME_DARK,
        particle: 'rgba(0, 0, 0, 0)',
        connection: 'rgba(0, 0, 0, 0)',
      };
    }

    // Default for profile contexts without custom colors — generate from name
    if (particleContext === "profile" || particleContext === "profile-default") {
      if (profile) {
        const name = profile.contactEntries?.find((e: any) => e.fieldType === 'name')?.value;
        if (name) {
          return convertToParticleColors(generateProfileColors(name));
        }
        // Profile exists but no name yet — use dark colors to avoid green flash
        return {
          gradientStart: THEME_DARK,
          gradientEnd: THEME_DARK,
          particle: 'rgba(0, 0, 0, 0)',
          connection: 'rgba(0, 0, 0, 0)',
        };
      }
      // Profile still loading — use dark colors, never flash green
      return {
        gradientStart: THEME_DARK,
        gradientEnd: THEME_DARK,
        particle: 'rgba(0, 0, 0, 0)',
        connection: 'rgba(0, 0, 0, 0)',
      };
    }

    // Fallback
    return DEFAULT_SIGNED_OUT_COLORS;
  }, [particleColors, particleContext, profile, status, contactColors]);

  // Use dominant color as background for proper gradient blending
  // This solid bg should match the gradient's gradientEnd (top/bottom of gradient)
  const effectiveBackgroundColor = useMemo(() => {
    // Contact context with contact colors — use dominant
    if ((particleContext === "contact" || particleContext === "connect") && contactColors && contactColors.length >= 3) {
      return contactColors[0];
    }
    // Profile context with profile colors — use dominant
    if ((particleContext === "profile" || particleContext === "profile-default") &&
        profile && profile.backgroundColors && profile.backgroundColors.length >= 3) {
      return profile.backgroundColors[0];
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
