import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, Animated, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Line } from "react-native-svg";

interface Particle {
  x: Animated.Value;
  y: Animated.Value;
  vx: number;
  vy: number;
  size: number;
  currentX: number; // Track actual position for connections
  currentY: number;
}

interface ParticleColors {
  particle: string;
  connection: string;
  gradientStart: string;
  gradientEnd: string;
}

export interface ParticleNetworkProps {
  colors?: ParticleColors;
  context?: "signed-out" | "profile" | "profile-default" | "connect" | "contact";
}

// Default nekt green colors (for signed-out) - matches web
const DEFAULT_COLORS: ParticleColors = {
  particle: "rgba(200, 255, 200, 0.6)",
  connection: "rgba(34, 197, 94, 0.15)",
  gradientStart: "rgba(34, 197, 94, 0.3)",  // Accent color (middle of gradient)
  gradientEnd: "rgb(10, 15, 26)",           // Dark color (top and bottom of gradient)
};

// Context-specific configuration
interface ContextConfig {
  particleCount: number;
  particleSpeed: number;
  connectionDistance: number;
  connectionOpacity: number;
}

const CONTEXT_CONFIGS: Record<string, ContextConfig> = {
  "signed-out": {
    particleCount: 30,
    particleSpeed: 0.6, // 2x web speed (0.3)
    connectionDistance: 150,
    connectionOpacity: 0.25,
  },
  profile: {
    particleCount: 25,
    particleSpeed: 0.6, // 2x web speed (0.3)
    connectionDistance: 100,
    connectionOpacity: 0.2,
  },
  "profile-default": {
    particleCount: 20,
    particleSpeed: 0.6, // 2x web speed (0.3)
    connectionDistance: 110,
    connectionOpacity: 0.2,
  },
  connect: {
    particleCount: 20,
    particleSpeed: 1.6, // 2x web speed (0.8)
    connectionDistance: 120,
    connectionOpacity: 0.25,
  },
  contact: {
    particleCount: 25,
    particleSpeed: 0.3, // 2x web speed (0.15)
    connectionDistance: 90,
    connectionOpacity: 0.3,
  },
};

/**
 * Lightweight ParticleNetwork using Animated API + SVG
 *
 * This version replaces @shopify/react-native-skia with native components
 * while maintaining particle connections using SVG for efficient line rendering.
 *
 * Features:
 * - Animated particles with realistic movement
 * - SVG-based particle connections (efficient rendering)
 * - LinearGradient background
 * - Configurable speed and connection distance
 */
export function ParticleNetworkLite({
  colors,
  context = "signed-out",
}: ParticleNetworkProps) {
  const { width, height } = Dimensions.get("window");
  const renderColors = colors || DEFAULT_COLORS;
  const config = CONTEXT_CONFIGS[context] || CONTEXT_CONFIGS["signed-out"];

  // Track connections for rendering
  const [connections, setConnections] = useState<Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    opacity: number;
  }>>([]);

  // Initialize particles
  const particles = useMemo(() => {
    const result: Particle[] = [];
    for (let i = 0; i < config.particleCount; i++) {
      const startX = Math.random() * width;
      const startY = Math.random() * height;
      result.push({
        x: new Animated.Value(startX),
        y: new Animated.Value(startY),
        vx: (Math.random() - 0.5) * config.particleSpeed,
        vy: (Math.random() - 0.5) * config.particleSpeed,
        size: Math.random() * 4 + 2, // Increased from (2 + 1) to (4 + 2) for better visibility
        currentX: startX,
        currentY: startY,
      });
    }
    return result;
  }, [config.particleCount, config.particleSpeed, width, height]);

  // Animation loop
  useEffect(() => {
    let animationId: number;
    let frameCount = 0;

    const animate = () => {
      frameCount++;

      // Update particle positions
      particles.forEach((particle) => {
        // Update position
        particle.currentX += particle.vx;
        particle.currentY += particle.vy;

        // Wrap around edges
        if (particle.currentX < 0) particle.currentX = width;
        if (particle.currentX > width) particle.currentX = 0;
        if (particle.currentY < 0) particle.currentY = height;
        if (particle.currentY > height) particle.currentY = 0;

        // Update animated values
        particle.x.setValue(particle.currentX);
        particle.y.setValue(particle.currentY);
      });

      // Update connections every 2 frames for performance
      if (frameCount % 2 === 0) {
        const newConnections: typeof connections = [];

        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].currentX - particles[j].currentX;
            const dy = particles[i].currentY - particles[j].currentY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < config.connectionDistance) {
              const distanceFactor = 1 - distance / config.connectionDistance;

              // Parse base opacity from connection color (matching web behavior)
              const baseColor = renderColors.connection;
              const match = baseColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/);
              const baseOpacity = match ? parseFloat(match[4] || '1') : 0.15;

              // Add distance-based opacity to base (matching web)
              const finalOpacity = baseOpacity + (distanceFactor * config.connectionOpacity);

              newConnections.push({
                x1: particles[i].currentX,
                y1: particles[i].currentY,
                x2: particles[j].currentX,
                y2: particles[j].currentY,
                opacity: finalOpacity,
              });
            }
          }
        }

        setConnections(newConnections);
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationId);
  }, [particles, width, height, config.connectionDistance, config.connectionOpacity]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Background gradient - matches web's symmetric pattern */}
      <LinearGradient
        colors={[
          renderColors.gradientEnd,    // dominant at top (matches safe area)
          renderColors.gradientStart,  // accent in middle
          renderColors.gradientEnd,    // dominant at bottom (matches safe area)
        ]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Particle connections using SVG */}
      <Svg style={StyleSheet.absoluteFill}>
        {connections.map((conn, index) => (
          <Line
            key={`conn-${index}`}
            x1={conn.x1}
            y1={conn.y1}
            x2={conn.x2}
            y2={conn.y2}
            stroke={renderColors.connection.replace(/[\d.]+\)$/, `${conn.opacity})`)}
            strokeWidth={1}
          />
        ))}
      </Svg>

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
