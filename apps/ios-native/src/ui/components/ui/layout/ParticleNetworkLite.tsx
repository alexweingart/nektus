import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View, Animated, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface Particle {
  x: Animated.Value;
  y: Animated.Value;
  vx: number;
  vy: number;
  size: number;
}

interface ParticleColors {
  particle: string;
  connection: string;
  gradientStart: string;
  gradientMiddle: string;
  gradientEnd: string;
}

export interface ParticleNetworkProps {
  colors?: ParticleColors;
  context?: "signed-out" | "profile" | "profile-default" | "connect" | "contact";
}

// Default nekt green colors (for signed-out)
const DEFAULT_COLORS: ParticleColors = {
  particle: "rgba(200, 255, 200, 0.6)",
  connection: "rgba(34, 197, 94, 0.15)",
  gradientStart: "rgba(34, 197, 94, 0.3)",
  gradientMiddle: "rgba(34, 197, 94, 0.12)",
  gradientEnd: "#0a0f1a",
};

// Context-specific configuration
interface ContextConfig {
  particleCount: number;
  particleSpeed: number;
}

const CONTEXT_CONFIGS: Record<string, ContextConfig> = {
  "signed-out": {
    particleCount: 30, // Reduced for performance
    particleSpeed: 0.3,
  },
  profile: {
    particleCount: 25,
    particleSpeed: 0.3,
  },
  "profile-default": {
    particleCount: 20,
    particleSpeed: 0.3,
  },
  connect: {
    particleCount: 20,
    particleSpeed: 0.8,
  },
  contact: {
    particleCount: 25,
    particleSpeed: 0.15,
  },
};

/**
 * Lightweight ParticleNetwork using Animated API
 *
 * This is a simplified version that replaces @shopify/react-native-skia
 * with native Animated components for much better build performance.
 *
 * Trade-offs:
 * - Fewer particles (30 vs ~50) for performance
 * - No particle connections (too expensive with View components)
 * - Simpler gradient (elliptical not supported in LinearGradient)
 * - Still provides the same visual atmosphere
 */
export function ParticleNetworkLite({
  colors,
  context = "signed-out",
}: ParticleNetworkProps) {
  const { width, height } = Dimensions.get("window");
  const renderColors = colors || DEFAULT_COLORS;
  const config = CONTEXT_CONFIGS[context] || CONTEXT_CONFIGS["signed-out"];

  // Initialize particles
  const particles = useMemo(() => {
    const result: Particle[] = [];
    for (let i = 0; i < config.particleCount; i++) {
      result.push({
        x: new Animated.Value(Math.random() * width),
        y: new Animated.Value(Math.random() * height),
        vx: (Math.random() - 0.5) * config.particleSpeed,
        vy: (Math.random() - 0.5) * config.particleSpeed,
        size: Math.random() * 2 + 1,
      });
    }
    return result;
  }, [config.particleCount, config.particleSpeed, width, height]);

  // Animation loop
  useEffect(() => {
    let animationId: number;
    const particleData = particles.map((p) => ({
      x: 0,
      y: 0,
      vx: p.vx,
      vy: p.vy,
    }));

    // Get initial values
    particles.forEach((particle, i) => {
      // @ts-ignore - accessing private _value
      particleData[i].x = particle.x._value || 0;
      // @ts-ignore - accessing private _value
      particleData[i].y = particle.y._value || 0;
    });

    const animate = () => {
      particles.forEach((particle, i) => {
        const data = particleData[i];

        // Update position
        data.x += data.vx;
        data.y += data.vy;

        // Wrap around edges
        if (data.x < 0) data.x = width;
        if (data.x > width) data.x = 0;
        if (data.y < 0) data.y = height;
        if (data.y > height) data.y = 0;

        // Update animated values
        particle.x.setValue(data.x);
        particle.y.setValue(data.y);
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationId);
  }, [particles, width, height]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Background gradient */}
      <LinearGradient
        colors={[
          renderColors.gradientStart,
          renderColors.gradientMiddle,
          renderColors.gradientEnd,
        ]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Particles */}
      {particles.map((particle, index) => (
        <Animated.View
          key={`particle-${index}`}
          style={[
            styles.particle,
            {
              width: particle.size,
              height: particle.size,
              backgroundColor: renderColors.particle,
              transform: [
                { translateX: particle.x },
                { translateY: particle.y },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: "absolute",
    borderRadius: 999,
  },
});

export default ParticleNetworkLite;
