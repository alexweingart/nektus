import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import {
  Canvas,
  Circle,
  Line,
  RadialGradient,
  Rect,
  vec,
} from "@shopify/react-native-skia";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

interface ParticleColors {
  particle: string;
  connection: string;
  gradientStart: string;
  gradientMiddle: string; // Lightened middle stop for radial gradient depth
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
  gradientMiddle: "rgba(34, 197, 94, 0.12)", // ~40% of start opacity for depth
  gradientEnd: "#0a0f1a",
};

// Context-specific configuration
interface ContextConfig {
  particleDensity: number;
  particleSpeed: number;
  connectionDistance: number;
  connectionOpacity: number;
}

const CONTEXT_CONFIGS: Record<string, ContextConfig> = {
  "signed-out": {
    particleDensity: 25000, // Slightly less dense for mobile performance
    particleSpeed: 0.3,
    connectionDistance: 150, // Match web
    connectionOpacity: 0.25, // More visible
  },
  profile: {
    particleDensity: 20000,
    particleSpeed: 0.3,
    connectionDistance: 100,
    connectionOpacity: 0.2,
  },
  "profile-default": {
    particleDensity: 18000,
    particleSpeed: 0.3,
    connectionDistance: 110,
    connectionOpacity: 0.2,
  },
  connect: {
    particleDensity: 15000,
    particleSpeed: 0.8,
    connectionDistance: 120,
    connectionOpacity: 0.25,
  },
  contact: {
    particleDensity: 20000,
    particleSpeed: 0.15,
    connectionDistance: 90,
    connectionOpacity: 0.3,
  },
};

export function ParticleNetwork({
  colors,
  context = "signed-out",
}: ParticleNetworkProps) {
  const { width, height } = useWindowDimensions();
  const renderColors = colors || DEFAULT_COLORS;
  const config = CONTEXT_CONFIGS[context] || CONTEXT_CONFIGS["signed-out"];

  // Animation frame counter
  const frameRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  // Initialize particles
  useEffect(() => {
    const particleCount = Math.floor((width * height) / config.particleDensity);
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * config.particleSpeed,
        vy: (Math.random() - 0.5) * config.particleSpeed,
        size: Math.random() * 2 + 1,
      });
    }
    particlesRef.current = particles;
  }, [width, height, config.particleDensity, config.particleSpeed]);

  // Animation loop
  useEffect(() => {
    let animationId: number;

    const animate = () => {
      const particles = particlesRef.current;

      // Update particle positions
      particles.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around edges
        if (particle.x < 0) particle.x = width;
        if (particle.x > width) particle.x = 0;
        if (particle.y < 0) particle.y = height;
        if (particle.y > height) particle.y = 0;
      });

      frameRef.current++;
      forceUpdate();
      animationId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationId);
  }, [width, height]);

  // Find connections between particles
  const connections = useMemo(() => {
    const particles = particlesRef.current;
    const conns: Array<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      opacity: number;
    }> = [];

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < config.connectionDistance) {
          const distanceFactor = 1 - distance / config.connectionDistance;
          conns.push({
            x1: particles[i].x,
            y1: particles[i].y,
            x2: particles[j].x,
            y2: particles[j].y,
            opacity: distanceFactor * config.connectionOpacity,
          });
        }
      }
    }
    return conns;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameRef.current, config.connectionDistance, config.connectionOpacity]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={{ flex: 1 }}>
        {/* Background radial gradient - ellipse at top like web */}
        {/* Just 2 colors: green at center, dark at edges */}
        {/* Use scaleX transform to compress horizontally, making it elliptical */}
        <Rect x={0} y={0} width={width} height={height}>
          <RadialGradient
            c={vec(width / 2, 0)}
            r={height * 0.9}
            colors={[
              renderColors.gradientStart,
              renderColors.gradientEnd,
            ]}
            transform={[{ scaleX: 0.2 }]}
            origin={vec(width / 2, 0)}
          />
        </Rect>

        {/* Draw connections */}
        {connections.map((conn, index) => (
          <Line
            key={`conn-${index}`}
            p1={vec(conn.x1, conn.y1)}
            p2={vec(conn.x2, conn.y2)}
            color={`rgba(34, 197, 94, ${conn.opacity})`}
            strokeWidth={1}
          />
        ))}

        {/* Draw particles */}
        {particlesRef.current.map((particle, index) => (
          <Circle
            key={`particle-${index}`}
            cx={particle.x}
            cy={particle.y}
            r={particle.size}
            color={renderColors.particle}
          />
        ))}
      </Canvas>
    </View>
  );
}

export default ParticleNetwork;
