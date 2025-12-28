'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

interface ParticleColors {
  particle: string;      // Color for particles
  connection: string;    // Color for connections
  gradientStart: string; // Gradient start color
  gradientEnd: string;   // Gradient end color
}

export interface ParticleNetworkProps {
  colors?: ParticleColors;
  context?: 'signed-out' | 'profile' | 'profile-default' | 'connect' | 'contact';
}

// Default nekt green colors (for signed-out)
const DEFAULT_COLORS: ParticleColors = {
  particle: 'rgba(200, 255, 200, 0.6)',
  connection: 'rgba(34, 197, 94, 0.15)',
  gradientStart: 'rgba(34, 197, 94, 0.3)', // Light green at top
  gradientEnd: '#0a0f1a'                    // Dark at bottom
};

// Inverted gradient for signed-in users without custom colors (profile-default)
const DEFAULT_COLORS_INVERTED: ParticleColors = {
  particle: 'rgba(200, 255, 200, 0.6)',
  connection: 'rgba(34, 197, 94, 0.15)',
  gradientStart: '#0a0f1a',                 // Dark at top
  gradientEnd: 'rgba(34, 197, 94, 0.3)'     // Light green at bottom
};

// Context-specific configuration
interface ContextConfig {
  particleDensity: number;  // screen_area / this number = particle count
  particleSpeed: number;    // base velocity multiplier
  connectionDistance: number;
  connectionOpacity: number;
  hasGravity: boolean;      // whether to apply directional drift
  gravityStrength: number;  // strength of gravity pull toward center
}

const CONTEXT_CONFIGS: Record<string, ContextConfig> = {
  'signed-out': {
    particleDensity: 20000,
    particleSpeed: 0.3,
    connectionDistance: 150,
    connectionOpacity: 0.15,
    hasGravity: false,
    gravityStrength: 0
  },
  'profile': {
    particleDensity: 15000,
    particleSpeed: 0.3,
    connectionDistance: 150,
    connectionOpacity: 0.2,
    hasGravity: true,
    gravityStrength: 0.02
  },
  'profile-default': {
    particleDensity: 12000, // Denser than signed-out
    particleSpeed: 0.3,
    connectionDistance: 160,
    connectionOpacity: 0.2,
    hasGravity: true,
    gravityStrength: 0.02
  },
  'connect': {
    particleDensity: 10000, // High density
    particleSpeed: 0.8,     // Very fast - imminent connection energy
    connectionDistance: 180,
    connectionOpacity: 0.25,
    hasGravity: false,
    gravityStrength: 0
  },
  'contact': {
    particleDensity: 15000,
    particleSpeed: 0.15,    // Slow
    connectionDistance: 140,
    connectionOpacity: 0.2,  // Match profile
    hasGravity: false,
    gravityStrength: 0
  }
};

/**
 * Parse a color string (rgba or hex) into RGBA components
 */
function parseColor(color: string): { r: number; g: number; b: number; a: number } | null {
  // Handle rgba(r, g, b, a) format
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1]),
      g: parseInt(rgbaMatch[2]),
      b: parseInt(rgbaMatch[3]),
      a: parseFloat(rgbaMatch[4] || '1')
    };
  }

  // Handle hex format #RRGGBB
  const hexMatch = color.match(/^#([0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
      a: 1
    };
  }

  return null;
}

/**
 * Interpolate between two colors
 * @param color1 Starting color
 * @param color2 Ending color
 * @param progress Interpolation progress (0 to 1)
 */
function interpolateColor(color1: string, color2: string, progress: number): string {
  const rgba1 = parseColor(color1);
  const rgba2 = parseColor(color2);

  if (!rgba1 || !rgba2) return color2; // Fallback to target color

  // Ease out cubic for smoother finish
  const eased = 1 - Math.pow(1 - progress, 3);

  const r = Math.round(rgba1.r + (rgba2.r - rgba1.r) * eased);
  const g = Math.round(rgba1.g + (rgba2.g - rgba1.g) * eased);
  const b = Math.round(rgba1.b + (rgba2.b - rgba1.b) * eased);
  const a = rgba1.a + (rgba2.a - rgba1.a) * eased;

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Interpolate between two color sets
 */
function interpolateColorSet(from: ParticleColors, to: ParticleColors, progress: number): ParticleColors {
  return {
    particle: interpolateColor(from.particle, to.particle, progress),
    connection: interpolateColor(from.connection, to.connection, progress),
    gradientStart: interpolateColor(from.gradientStart, to.gradientStart, progress),
    gradientEnd: interpolateColor(from.gradientEnd, to.gradientEnd, progress)
  };
}

/**
 * Check if two color sets are equal
 */
function colorsEqual(a: ParticleColors, b: ParticleColors): boolean {
  return a.particle === b.particle &&
         a.connection === b.connection &&
         a.gradientStart === b.gradientStart &&
         a.gradientEnd === b.gradientEnd;
}

/**
 * Particle Network Background
 * Creates a subtle network of particles that connect when nearby,
 * with context-aware motion patterns and personalized colors.
 */
export function ParticleNetwork({ colors, context = 'signed-out' }: ParticleNetworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [cssColors, setCssColors] = useState<ParticleColors | null>(null);

  // Transition state for smooth color interpolation
  const transitionRef = useRef({
    fromColors: DEFAULT_COLORS,
    toColors: DEFAULT_COLORS,
    startTime: 0,
    duration: 1000, // 1 second
    isTransitioning: false
  });

  // Helper to get colors from CSS variables (set by ProfileContext)
  const getColorsFromCSSVariables = (): ParticleColors | null => {
    if (typeof window === 'undefined') return null;

    const gradientStart = getComputedStyle(document.documentElement).getPropertyValue('--gradient-start-color').trim();
    const gradientEnd = getComputedStyle(document.documentElement).getPropertyValue('--gradient-end-color').trim();
    const particle = getComputedStyle(document.documentElement).getPropertyValue('--particle-color').trim();
    const connection = getComputedStyle(document.documentElement).getPropertyValue('--connection-color').trim();

    // Only use CSS variables if all are set
    if (gradientStart && gradientEnd && particle && connection) {
      return {
        gradientStart,
        gradientEnd,
        particle,
        connection
      };
    }

    return null;
  };

  // Watch for CSS variable changes (when ProfileContext sets them)
  useEffect(() => {
    const checkCssColors = () => {
      const newCssColors = getColorsFromCSSVariables();
      if (newCssColors) {
        setCssColors(newCssColors);
      }
    };

    // Check immediately
    checkCssColors();

    // Also check periodically in case CSS variables change
    const interval = setInterval(checkCssColors, 100);

    return () => clearInterval(interval);
  }, []);

  // Detect color changes and start transition
  // Priority: 1) colors prop, 2) CSS variables (from ProfileContext), 3) defaults
  const newColors = colors || cssColors || (context === 'profile-default' ? DEFAULT_COLORS_INVERTED : DEFAULT_COLORS);
  if (!colorsEqual(newColors, transitionRef.current.toColors)) {
    // Get current interpolated colors as starting point
    const now = performance.now();
    let currentColors = transitionRef.current.toColors;

    if (transitionRef.current.isTransitioning) {
      // Mid-transition, use current interpolated state as new starting point
      const elapsed = now - transitionRef.current.startTime;
      const progress = Math.min(elapsed / transitionRef.current.duration, 1);
      currentColors = interpolateColorSet(
        transitionRef.current.fromColors,
        transitionRef.current.toColors,
        progress
      );
    }

    // Start new transition
    transitionRef.current = {
      fromColors: currentColors,
      toColors: newColors,
      startTime: now,
      duration: prefersReducedMotion ? 0 : 1000, // Instant if reduced motion
      isTransitioning: true
    };
  }

  // Helper to get current interpolated colors
  const getCurrentColors = (): ParticleColors => {
    if (!transitionRef.current.isTransitioning) {
      return transitionRef.current.toColors;
    }

    const elapsed = performance.now() - transitionRef.current.startTime;
    const progress = Math.min(elapsed / transitionRef.current.duration, 1);

    if (progress >= 1) {
      transitionRef.current.isTransitioning = false;
      return transitionRef.current.toColors;
    }

    return interpolateColorSet(
      transitionRef.current.fromColors,
      transitionRef.current.toColors,
      progress
    );
  };

  // Get config for current context
  const config = CONTEXT_CONFIGS[context] || CONTEXT_CONFIGS['signed-out'];

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || prefersReducedMotion) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // V2: Lock background height to initial viewport (prevents resize when keyboard opens)
    const initialHeight = window.innerHeight;

    // Initialize particles once
    const initParticles = () => {
      const particleCount = Math.floor((canvas.width * canvas.height) / config.particleDensity);
      const particles: Particle[] = [];

      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * config.particleSpeed,
          vy: (Math.random() - 0.5) * config.particleSpeed,
          size: Math.random() * 2 + 1,
        });
      }
      particlesRef.current = particles;
    };

    // Set canvas size to match HTML element
    const updateSize = () => {
      const previousWidth = canvas.width;
      const previousHeight = canvas.height;

      canvas.width = window.innerWidth;
      canvas.height = initialHeight;  // Lock bitmap height to initial viewport

      // Don't set canvas.style.height - let CSS (minHeight: -webkit-fill-available) handle it

      // Only reinitialize particles if canvas size changed significantly (more than 50px)
      // This prevents reinitialization during pull-to-refresh gestures
      if (Math.abs(previousWidth - canvas.width) > 50 || Math.abs(previousHeight - canvas.height) > 50) {
        initParticles();
      }
    };

    // Initial setup
    canvas.width = window.innerWidth;
    canvas.height = initialHeight;
    initParticles();

    // No need to maintain style.height - CSS handles it with minHeight: -webkit-fill-available

    window.addEventListener('resize', updateSize);

    // Animation loop
    const animate = () => {
      const particles = particlesRef.current;

      // Get current interpolated colors
      const renderColors = getCurrentColors();

      // V2: 3-color gradient for matching safe areas (dark → light → dark)
      const gradientStyle = `linear-gradient(to bottom, ${renderColors.gradientEnd} 0%, ${renderColors.gradientStart} 50%, ${renderColors.gradientEnd} 100%)`;
      if (backgroundRef.current) {
        backgroundRef.current.style.background = gradientStyle;
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      particles.forEach((particle) => {
        // Apply gravity (drift toward center) for certain contexts
        if (config.hasGravity) {
          const dx = centerX - particle.x;
          const dy = centerY - particle.y;
          particle.vx += dx * config.gravityStrength * 0.00001;
          particle.vy += dy * config.gravityStrength * 0.00001;

          // Limit velocity
          const maxVel = config.particleSpeed * 1.5;
          particle.vx = Math.max(-maxVel, Math.min(maxVel, particle.vx));
          particle.vy = Math.max(-maxVel, Math.min(maxVel, particle.vy));
        }

        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        // Draw particle with interpolated color
        ctx.fillStyle = renderColors.particle;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw connections
      ctx.lineWidth = 1;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < config.connectionDistance) {
            // Fade connection based on distance
            const distanceFactor = 1 - distance / config.connectionDistance;

            // Parse base connection color and apply distance-based opacity
            const baseColor = renderColors.connection;
            const match = baseColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/);

            if (match) {
              const [, r, g, b, a] = match;
              const finalOpacity = parseFloat(a || '1') + (distanceFactor * config.connectionOpacity);
              ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${finalOpacity})`;
            } else {
              ctx.strokeStyle = renderColors.connection;
            }

            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Cancel any existing animation before starting new one
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animate();

    return () => {
      window.removeEventListener('resize', updateSize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
    };
  }, [prefersReducedMotion, config]);

  if (prefersReducedMotion) {
    return null;
  }

  // V2: Initial linear gradient (will be updated by animation loop)
  const initialColors = getCurrentColors();
  // Create gradient that starts and ends with same color for matching safe areas
  // Format: dark (top/safe) → light (middle) → dark (bottom/safe)
  const initialGradient = `linear-gradient(to bottom, ${initialColors.gradientEnd} 0%, ${initialColors.gradientStart} 50%, ${initialColors.gradientEnd} 100%)`;

  return (
    <>
      {/* Background gradient div */}
      <div
        ref={backgroundRef}
        className="particle-network-canvas"
        style={{
          background: initialGradient,
          zIndex: -1
        }}
      />
      {/* Canvas for particles and connections */}
      <canvas
        ref={canvasRef}
        className="particle-network-canvas"
        style={{
          zIndex: 0
        }}
      />
    </>
  );
}
