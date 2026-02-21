import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ANIMATION } from '@nektus/shared-client';
import { StyleSheet, View, Animated, Dimensions, AppState, AppStateStatus } from "react-native";
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

// Context-specific configuration — reduced particle counts for performance
interface ContextConfig {
  particleCount: number;
  particleSpeed: number;
  connectionDistance: number;
  connectionOpacity: number;
}

const CONTEXT_CONFIGS: Record<string, ContextConfig> = {
  "signed-out": {
    particleCount: 14,
    particleSpeed: 0.6,
    connectionDistance: 150,
    connectionOpacity: 0.25,
  },
  profile: {
    particleCount: 12,
    particleSpeed: 0.6,
    connectionDistance: 100,
    connectionOpacity: 0.2,
  },
  "profile-default": {
    particleCount: 10,
    particleSpeed: 0.6,
    connectionDistance: 110,
    connectionOpacity: 0.2,
  },
  connect: {
    particleCount: 10,
    particleSpeed: 1.6,
    connectionDistance: 120,
    connectionOpacity: 0.25,
  },
  contact: {
    particleCount: 12,
    particleSpeed: 0.3,
    connectionDistance: 90,
    connectionOpacity: 0.3,
  },
};

// Color transition duration (matches web's 1000ms)
const COLOR_TRANSITION_DURATION = ANIMATION.CINEMATIC_MS;

// Target ~20fps for particle updates (50ms per frame)
const FRAME_INTERVAL_MS = 50;
// Connection update frequency: every N *rendered* frames (~4fps at 20fps base)
const CONNECTION_UPDATE_INTERVAL = 5;

export function ParticleNetwork({
  colors,
  context = "signed-out",
}: ParticleNetworkProps) {
  const { width, height } = Dimensions.get("window");
  // Memoize by value so referentially-different-but-equal objects don't restart transitions
  const targetColors = useMemo(
    () => colors || DEFAULT_COLORS,
    [colors?.particle, colors?.connection, colors?.gradientStart, colors?.gradientEnd]
  );
  const config = CONTEXT_CONFIGS[context] || CONTEXT_CONFIGS["signed-out"];

  // Track displayed colors (interpolated during transition)
  const [displayColors, setDisplayColors] = useState<ParticleColors>(targetColors);
  // Ref to current display colors so transition can read latest without re-triggering effect
  const displayColorsRef = useRef<ParticleColors>(targetColors);
  displayColorsRef.current = displayColors;

  // App state — fully stop animation loop when backgrounded
  const isActiveRef = useRef(AppState.currentState === 'active');

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

  // Ref to hold the color transition RAF id so we can cancel it
  const colorAnimIdRef = useRef<number | null>(null);

  // Detect color changes and start transition
  useEffect(() => {
    if (!colorsEqual(targetColors, transitionRef.current.toColors)) {
      // Cancel any in-progress transition before starting a new one
      if (colorAnimIdRef.current !== null) {
        cancelAnimationFrame(colorAnimIdRef.current);
        colorAnimIdRef.current = null;
      }

      const currentDisplay = displayColorsRef.current;

      // Start transition from current display colors to new target
      transitionRef.current = {
        fromColors: currentDisplay,
        toColors: targetColors,
        startTime: Date.now(),
        isTransitioning: true,
      };
      // Parse colors for interpolation
      parsedColorsRef.current = {
        from: {
          particle: parseColor(currentDisplay.particle),
          connection: parseColor(currentDisplay.connection),
          gradientStart: parseColor(currentDisplay.gradientStart),
          gradientEnd: parseColor(currentDisplay.gradientEnd),
        },
        to: {
          particle: parseColor(targetColors.particle),
          connection: parseColor(targetColors.connection),
          gradientStart: parseColor(targetColors.gradientStart),
          gradientEnd: parseColor(targetColors.gradientEnd),
        },
      };

      // Start color animation loop (runs independently of React render cycle)
      const animateColors = () => {
        const transition = transitionRef.current;
        const parsed = parsedColorsRef.current;

        if (!transition.isTransitioning || !parsed) {
          colorAnimIdRef.current = null;
          return; // Stop loop when transition is done
        }

        const elapsed = Date.now() - transition.startTime;
        const linearProgress = Math.min(elapsed / COLOR_TRANSITION_DURATION, 1);
        const progress = 1 - Math.pow(1 - linearProgress, 3); // Cubic ease-out

        if (linearProgress >= 1) {
          transition.isTransitioning = false;
          setDisplayColors(transition.toColors);
          colorAnimIdRef.current = null;
          return; // Stop loop
        }

        setDisplayColors({
          particle: interpolateColor(parsed.from.particle, parsed.to.particle, progress),
          connection: interpolateColor(parsed.from.connection, parsed.to.connection, progress),
          gradientStart: interpolateColor(parsed.from.gradientStart, parsed.to.gradientStart, progress),
          gradientEnd: interpolateColor(parsed.from.gradientEnd, parsed.to.gradientEnd, progress),
        });

        colorAnimIdRef.current = requestAnimationFrame(animateColors);
      };

      colorAnimIdRef.current = requestAnimationFrame(animateColors);
    }

    // Only cancel on unmount, NOT on every re-render
    return () => {
      if (colorAnimIdRef.current !== null) {
        cancelAnimationFrame(colorAnimIdRef.current);
        colorAnimIdRef.current = null;
      }
    };
  }, [targetColors]); // Only re-run when target colors change (not on displayColors updates)

  // Track connections via ref to avoid React re-renders on every update
  const connectionsRef = useRef<Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    opacity: number;
  }>>([]);
  const [connectionsTick, setConnectionsTick] = useState(0);

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
        size: Math.random() * 4 + 2,
        currentX: startX,
        currentY: startY,
      });
    }
    return result;
  }, [config.particleCount, config.particleSpeed, width, height]);

  // Cache parsed connection base opacity to avoid regex inside O(N²) loop
  const connectionBaseOpacity = useMemo(() => {
    const match = displayColors.connection.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/);
    return match ? parseFloat(match[4] || '1') : 0.15;
  }, [displayColors.connection]);

  // Animation loop — throttled to ~20fps, fully stops when backgrounded
  const animationIdRef = useRef<number | null>(null);

  const startAnimation = useCallback(() => {
    if (animationIdRef.current !== null) return; // already running
    let frameCount = 0;
    let lastFrameTime = 0;

    const animate = (timestamp: number) => {
      // Throttle: skip frames until enough time has passed
      if (timestamp - lastFrameTime < FRAME_INTERVAL_MS) {
        animationIdRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameTime = timestamp;
      frameCount++;

      // Update particle positions
      particles.forEach((particle) => {
        particle.currentX += particle.vx;
        particle.currentY += particle.vy;

        if (particle.currentX < 0) particle.currentX = width;
        if (particle.currentX > width) particle.currentX = 0;
        if (particle.currentY < 0) particle.currentY = height;
        if (particle.currentY > height) particle.currentY = 0;

        particle.x.setValue(particle.currentX);
        particle.y.setValue(particle.currentY);
      });

      // Update connections every N rendered frames (~4fps)
      if (frameCount % CONNECTION_UPDATE_INTERVAL === 0) {
        const newConnections: Array<{ x1: number; y1: number; x2: number; y2: number; opacity: number }> = [];
        const distSq = config.connectionDistance * config.connectionDistance;

        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].currentX - particles[j].currentX;
            const dy = particles[i].currentY - particles[j].currentY;
            const dSq = dx * dx + dy * dy;

            if (dSq < distSq) {
              const distance = Math.sqrt(dSq);
              const distanceFactor = 1 - distance / config.connectionDistance;
              const finalOpacity = connectionBaseOpacity + (distanceFactor * config.connectionOpacity);

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

        connectionsRef.current = newConnections;
        setConnectionsTick(prev => prev + 1);
      }

      animationIdRef.current = requestAnimationFrame(animate);
    };

    animationIdRef.current = requestAnimationFrame(animate);
  }, [particles, width, height, config.connectionDistance, config.connectionOpacity, connectionBaseOpacity]);

  const stopAnimation = useCallback(() => {
    if (animationIdRef.current !== null) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
  }, []);

  // Start/stop based on app state — fully stops the loop when backgrounded
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      isActiveRef.current = nextState === 'active';
      if (nextState === 'active') {
        startAnimation();
      } else {
        stopAnimation();
      }
    });

    // Start immediately if app is active
    if (isActiveRef.current) {
      startAnimation();
    }

    return () => {
      sub.remove();
      stopAnimation();
    };
  }, [startAnimation, stopAnimation]);

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
        {connectionsRef.current.map((conn, index) => (
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

export default ParticleNetwork;
