import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { StyleSheet, View, Animated, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Line } from "react-native-svg";

// Helper to parse rgba string to components
function parseColor(color: string): { r: number; g: number; b: number; a: number } {
  // Handle rgb/rgba format
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
      a: parseFloat(rgbaMatch[4] ?? '1'),
    };
  }
  // Handle hex format
  const hexMatch = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1], 16),
      g: parseInt(hexMatch[2], 16),
      b: parseInt(hexMatch[3], 16),
      a: 1,
    };
  }
  // Fallback
  return { r: 0, g: 0, b: 0, a: 1 };
}

// Helper to interpolate between two colors
function interpolateColor(
  from: { r: number; g: number; b: number; a: number },
  to: { r: number; g: number; b: number; a: number },
  progress: number
): string {
  const r = Math.round(from.r + (to.r - from.r) * progress);
  const g = Math.round(from.g + (to.g - from.g) * progress);
  const b = Math.round(from.b + (to.b - from.b) * progress);
  const a = from.a + (to.a - from.a) * progress;
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

// Check if two color objects are equal
function colorsEqual(a: ParticleColors, b: ParticleColors): boolean {
  return a.particle === b.particle &&
         a.connection === b.connection &&
         a.gradientStart === b.gradientStart &&
         a.gradientEnd === b.gradientEnd;
}

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
// Color transition duration (matches web's 1000ms)
const COLOR_TRANSITION_DURATION = 1000;

export function ParticleNetworkLite({
  colors,
  context = "signed-out",
}: ParticleNetworkProps) {
  const { width, height } = Dimensions.get("window");
  const targetColors = colors || DEFAULT_COLORS;
  const config = CONTEXT_CONFIGS[context] || CONTEXT_CONFIGS["signed-out"];

  // Track displayed colors (interpolated during transition)
  const [displayColors, setDisplayColors] = useState<ParticleColors>(targetColors);

  // Transition state ref
  const transitionRef = useRef<{
    fromColors: ParticleColors;
    toColors: ParticleColors;
    startTime: number;
    isTransitioning: boolean;
  }>({
    fromColors: targetColors,
    toColors: targetColors,
    startTime: 0,
    isTransitioning: false,
  });

  // Parsed color components for interpolation
  const parsedColorsRef = useRef<{
    from: {
      particle: ReturnType<typeof parseColor>;
      connection: ReturnType<typeof parseColor>;
      gradientStart: ReturnType<typeof parseColor>;
      gradientEnd: ReturnType<typeof parseColor>;
    };
    to: {
      particle: ReturnType<typeof parseColor>;
      connection: ReturnType<typeof parseColor>;
      gradientStart: ReturnType<typeof parseColor>;
      gradientEnd: ReturnType<typeof parseColor>;
    };
  } | null>(null);

  // Detect color changes and start transition
  useEffect(() => {
    if (!colorsEqual(targetColors, transitionRef.current.toColors)) {
      console.log('[ParticleNetworkLite] Starting color transition');
      // Start transition from current display colors to new target
      transitionRef.current = {
        fromColors: displayColors,
        toColors: targetColors,
        startTime: Date.now(),
        isTransitioning: true,
      };
      // Parse colors for interpolation
      parsedColorsRef.current = {
        from: {
          particle: parseColor(displayColors.particle),
          connection: parseColor(displayColors.connection),
          gradientStart: parseColor(displayColors.gradientStart),
          gradientEnd: parseColor(displayColors.gradientEnd),
        },
        to: {
          particle: parseColor(targetColors.particle),
          connection: parseColor(targetColors.connection),
          gradientStart: parseColor(targetColors.gradientStart),
          gradientEnd: parseColor(targetColors.gradientEnd),
        },
      };
    }
  }, [targetColors, displayColors]);

  // Color interpolation animation loop
  useEffect(() => {
    let animationId: number;

    const animateColors = () => {
      const transition = transitionRef.current;
      const parsed = parsedColorsRef.current;

      if (transition.isTransitioning && parsed) {
        const elapsed = Date.now() - transition.startTime;
        // Cubic ease-out: 1 - Math.pow(1 - progress, 3)
        const linearProgress = Math.min(elapsed / COLOR_TRANSITION_DURATION, 1);
        const progress = 1 - Math.pow(1 - linearProgress, 3);

        if (linearProgress >= 1) {
          // Transition complete
          transition.isTransitioning = false;
          setDisplayColors(transition.toColors);
        } else {
          // Interpolate colors
          setDisplayColors({
            particle: interpolateColor(parsed.from.particle, parsed.to.particle, progress),
            connection: interpolateColor(parsed.from.connection, parsed.to.connection, progress),
            gradientStart: interpolateColor(parsed.from.gradientStart, parsed.to.gradientStart, progress),
            gradientEnd: interpolateColor(parsed.from.gradientEnd, parsed.to.gradientEnd, progress),
          });
        }
      }

      animationId = requestAnimationFrame(animateColors);
    };

    animateColors();
    return () => cancelAnimationFrame(animationId);
  }, []);

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
              const baseColor = displayColors.connection;
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
          displayColors.gradientEnd,    // dominant at top (matches safe area)
          displayColors.gradientStart,  // accent in middle
          displayColors.gradientEnd,    // dominant at bottom (matches safe area)
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
            stroke={displayColors.connection.replace(/[\d.]+\)$/, `${conn.opacity})`)}
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
              backgroundColor: displayColors.particle,
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
