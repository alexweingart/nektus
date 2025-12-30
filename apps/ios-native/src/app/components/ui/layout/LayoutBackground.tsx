import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ParticleNetworkLite as ParticleNetwork, ParticleNetworkProps } from "./ParticleNetworkLite";
import { useProfile } from "../../../../app/context/ProfileContext";

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

// Default colors for profile context (inverted signed-out colors) - matches web
const DEFAULT_PROFILE_COLORS = {
  gradientStart: '#0a0f1a',                   // Dark in middle (inverted)
  gradientEnd: 'rgba(34, 197, 94, 0.3)',     // Green at top/bottom (symmetric)
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
      console.log('[LayoutBackground] Using explicitly provided colors:', particleColors);
      return particleColors;
    }

    // For profile context, use profile's background colors if available
    if (particleContext === "profile" && profile?.backgroundColors?.length >= 3) {
      const converted = convertToParticleColors(profile.backgroundColors);
      console.log('[LayoutBackground] Using profile colors:', {
        original: profile.backgroundColors,
        converted
      });
      return converted;
    }

    // Use default profile colors for profile context without custom colors
    if (particleContext === "profile") {
      console.log('[LayoutBackground] Using default profile colors (no custom colors found)');
      return DEFAULT_PROFILE_COLORS;
    }

    // For other contexts, use undefined (ParticleNetwork will use context defaults)
    console.log('[LayoutBackground] Using context defaults for:', particleContext);
    return undefined;
  }, [particleColors, particleContext, profile?.backgroundColors]);

  // Use dominant color as background for proper gradient blending
  const effectiveBackgroundColor = useMemo(() => {
    if (particleContext === "profile" && profile?.backgroundColors?.length >= 3) {
      // Use dominant color (backgroundColors[0]) as container background
      // This ensures semi-transparent gradient colors blend correctly
      return profile.backgroundColors[0];
    }
    return backgroundColor;
  }, [particleContext, profile?.backgroundColors, backgroundColor]);

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
