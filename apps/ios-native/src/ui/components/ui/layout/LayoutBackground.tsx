import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ParticleNetwork, ParticleNetworkProps } from "./ParticleNetwork";
import { useProfile } from "../../../../modules/context/ProfileContext";

// Helper function to convert hex to rgba
function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Convert profile backgroundColors to ParticleNetwork colors
function convertToParticleColors(backgroundColors: string[]) {
  const [dominant, accent1, accent2] = backgroundColors;
  return {
    gradientStart: hexToRgba(accent1, 0.4),
    gradientEnd: dominant,
    gradientMiddle: hexToRgba(accent1, 0.12),
    particle: hexToRgba(accent2, 0.6),
    connection: hexToRgba(accent2, 0.15)
  };
}

// Default colors for profile context (inverted signed-out colors)
const DEFAULT_PROFILE_COLORS = {
  gradientStart: '#0a0f1a', // Inverted: dark at top
  gradientMiddle: 'rgba(34, 197, 94, 0.12)',
  gradientEnd: 'rgba(34, 197, 94, 0.3)', // Inverted: green at bottom
  particle: 'rgba(200, 255, 200, 0.6)',
  connection: 'rgba(34, 197, 94, 0.15)'
};

interface LayoutBackgroundProps {
  children: React.ReactNode;
  /** ParticleNetwork context for background styling */
  particleContext?: ParticleNetworkProps["context"];
  /** Custom ParticleNetwork colors */
  particleColors?: ParticleNetworkProps["colors"];
  /** Whether to show ParticleNetwork background (default: true) */
  showParticles?: boolean;
  /** Background color when particles are hidden */
  backgroundColor?: string;
  /** Apply safe area padding to content (default: true) */
  applySafeArea?: boolean;
}

/**
 * LayoutBackground - wrapper component that handles:
 * - ParticleNetwork positioned as absolute background (edge-to-edge, behind notch)
 * - Safe area padding for content (top, left, right)
 * - Matches web's LayoutBackground pattern
 */
export function LayoutBackground({
  children,
  particleContext = "signed-out",
  particleColors,
  showParticles = true,
  backgroundColor = "#0a0f1a",
  applySafeArea = true,
}: LayoutBackgroundProps) {
  const insets = useSafeAreaInsets();
  const { profile } = useProfile(); // Get profile from context (like web)

  // Determine colors to use
  const effectiveColors = useMemo(() => {
    // If colors explicitly provided, use those
    if (particleColors) {
      return particleColors;
    }

    // For profile context, use profile's background colors if available
    if (particleContext === "profile" && profile?.backgroundColors?.length >= 3) {
      return convertToParticleColors(profile.backgroundColors);
    }

    // Use default profile colors for profile context without custom colors
    if (particleContext === "profile") {
      return DEFAULT_PROFILE_COLORS;
    }

    // For other contexts, use undefined (ParticleNetwork will use context defaults)
    return undefined;
  }, [particleColors, particleContext, profile?.backgroundColors]);

  return (
    <View style={[styles.container, { backgroundColor }]}>
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
