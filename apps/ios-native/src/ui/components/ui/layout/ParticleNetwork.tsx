import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import {
  Canvas,
  Circle,
  Fill,
  Line,
  RadialGradient,
  Rect,
  Skia,
  Shader,
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

// SKSL shader for elliptical gradient (matches web's radial-gradient(ellipse at top, ...))
const ellipticalGradientSource = `
  uniform vec2 resolution;
  uniform vec2 center;
  uniform float radiusX;
  uniform float radiusY;
  uniform vec4 colorStart;
  uniform vec4 colorEnd;

  vec4 main(vec2 fragCoord) {
    // Calculate normalized distance from center using ellipse formula
    float dx = (fragCoord.x - center.x) / radiusX;
    float dy = (fragCoord.y - center.y) / radiusY;
    float dist = sqrt(dx * dx + dy * dy);

    // Clamp and interpolate between colors
    float t = clamp(dist, 0.0, 1.0);
    return mix(colorStart, colorEnd, t);
  }
`;

// Create shader at runtime to handle potential compilation issues
const getEllipticalGradientShader = () => {
  try {
    return Skia.RuntimeEffect.Make(ellipticalGradientSource);
  } catch (e) {
    console.warn("Failed to create elliptical gradient shader:", e);
    return null;
  }
};

// Parse rgba string to vec4 for shader uniforms
function parseRgbaToVec4(rgbaString: string): number[] {
  const match = rgbaString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
  if (!match) {
    return [0, 0, 0, 1];
  }
  const [, r, g, b, a = "1"] = match;
  return [
    parseInt(r) / 255,
    parseInt(g) / 255,
    parseInt(b) / 255,
    parseFloat(a),
  ];
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

  // Create elliptical gradient shader (memoized)
  const ellipticalShader = useMemo(() => getEllipticalGradientShader(), []);

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
        {/* Background elliptical gradient - emanates from top center */}
        {ellipticalShader ? (
          <Fill>
            <Shader
              source={ellipticalShader}
              uniforms={{
                resolution: vec(width, height),
                center: vec(width / 2, 0),
                radiusX: width * 0.4,
                radiusY: height * 0.8,
                colorStart: parseRgbaToVec4(renderColors.gradientStart),
                colorEnd: parseRgbaToVec4(renderColors.gradientEnd),
              }}
            />
          </Fill>
        ) : (
          /* Fallback to circular radial gradient */
          <Rect x={0} y={0} width={width} height={height}>
            <RadialGradient
              c={vec(width / 2, 0)}
              r={height * 1.2}
              colors={[renderColors.gradientStart, renderColors.gradientEnd]}
            />
          </Rect>
        )}

        {/* Draw connections */}
        {connections.map((conn, index) => (
          <Line
            key={`conn-${index}`}
            p1={vec(conn.x1, conn.y1)}
            p2={vec(conn.x2, conn.y2)}
            color={renderColors.connection.replace(/[\d.]+\)$/, `${conn.opacity})`)}
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
