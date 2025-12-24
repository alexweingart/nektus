import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ParticleNetwork, ParticleNetworkProps } from "./ParticleNetwork";

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

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* ParticleNetwork - absolute positioned, extends behind notch/home indicator */}
      {showParticles && (
        <ParticleNetwork context={particleContext} colors={particleColors} />
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
