'use client';

import { useEffect, useRef, useState } from 'react';

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

// Default nekt green colors
const DEFAULT_COLORS: ParticleColors = {
  particle: 'rgba(200, 255, 200, 0.6)',
  connection: 'rgba(34, 197, 94, 0.15)',
  gradientStart: 'rgba(34, 197, 94, 0.3)',
  gradientEnd: '#0a0f1a'
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
    connectionOpacity: 0.3,  // Strong connections
    hasGravity: false,
    gravityStrength: 0
  }
};

/**
 * Particle Network Background
 * Creates a subtle network of particles that connect when nearby,
 * with context-aware motion patterns and personalized colors.
 */
export function ParticleNetwork({ colors, context = 'signed-out' }: ParticleNetworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Color interpolation refs
  const currentColorsRef = useRef<ParticleColors>(colors || DEFAULT_COLORS);
  const targetColorsRef = useRef<ParticleColors>(colors || DEFAULT_COLORS);
  const colorTransitionStartRef = useRef<number>(0);
  const isTransitioningRef = useRef(false);

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

  // Handle color changes with interpolation
  useEffect(() => {
    const newColors = colors || DEFAULT_COLORS;

    // Check if colors actually changed
    const colorsChanged =
      currentColorsRef.current.particle !== newColors.particle ||
      currentColorsRef.current.connection !== newColors.connection ||
      currentColorsRef.current.gradientStart !== newColors.gradientStart ||
      currentColorsRef.current.gradientEnd !== newColors.gradientEnd;

    if (colorsChanged) {
      // Start color transition
      targetColorsRef.current = newColors;
      colorTransitionStartRef.current = Date.now();
      isTransitioningRef.current = true;
    }
  }, [colors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || prefersReducedMotion) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match HTML element
    const updateSize = () => {
      canvas.width = window.innerWidth;
      const fullHeight = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--full-screen-height') ||
        window.innerHeight.toString()
      );
      canvas.height = fullHeight;

      // Reinitialize particles when canvas resizes
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
    updateSize();
    window.addEventListener('resize', updateSize);

    // Helper function to interpolate between two rgba colors
    const interpolateColor = (color1: string, color2: string, progress: number): string => {
      // Extract rgba values
      const extractRgba = (color: string) => {
        if (color.startsWith('rgba')) {
          const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/);
          if (match) {
            return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), parseFloat(match[4] || '1')];
          }
        } else if (color.startsWith('#')) {
          const hex = color.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          return [r, g, b, 1];
        }
        return [0, 0, 0, 1];
      };

      const [r1, g1, b1, a1] = extractRgba(color1);
      const [r2, g2, b2, a2] = extractRgba(color2);

      const r = Math.round(r1 + (r2 - r1) * progress);
      const g = Math.round(g1 + (g2 - g1) * progress);
      const b = Math.round(b1 + (b2 - b1) * progress);
      const a = a1 + (a2 - a1) * progress;

      return `rgba(${r}, ${g}, ${b}, ${a})`;
    };

    // Animation loop
    const animate = () => {
      const particles = particlesRef.current;

      // Handle color interpolation (1 second transition)
      if (isTransitioningRef.current) {
        const elapsed = Date.now() - colorTransitionStartRef.current;
        const transitionDuration = 1000; // 1 second
        const progress = Math.min(elapsed / transitionDuration, 1);

        // Lerp colors
        currentColorsRef.current = {
          particle: interpolateColor(currentColorsRef.current.particle, targetColorsRef.current.particle, progress),
          connection: interpolateColor(currentColorsRef.current.connection, targetColorsRef.current.connection, progress),
          gradientStart: interpolateColor(currentColorsRef.current.gradientStart, targetColorsRef.current.gradientStart, progress),
          gradientEnd: interpolateColor(currentColorsRef.current.gradientEnd, targetColorsRef.current.gradientEnd, progress)
        };

        if (progress >= 1) {
          isTransitioningRef.current = false;
        }
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

        // Draw particle with current color
        ctx.fillStyle = currentColorsRef.current.particle;
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
            const baseColor = currentColorsRef.current.connection;
            const match = baseColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/);

            if (match) {
              const [, r, g, b, a] = match;
              const finalOpacity = parseFloat(a || '1') + (distanceFactor * config.connectionOpacity);
              ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${finalOpacity})`;
            } else {
              ctx.strokeStyle = currentColorsRef.current.connection;
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

    animate();

    return () => {
      window.removeEventListener('resize', updateSize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [prefersReducedMotion, config, context]);

  if (prefersReducedMotion) {
    return null;
  }

  // Build gradient from current colors
  const gradientStyle = `radial-gradient(ellipse at top, ${currentColorsRef.current.gradientStart} 0%, ${currentColorsRef.current.gradientStart.replace('0.3', '0.12')} 40%, ${currentColorsRef.current.gradientEnd} 70%, ${currentColorsRef.current.gradientEnd} 100%)`;

  return (
    <canvas
      ref={canvasRef}
      className="fixed pointer-events-none"
      style={{
        zIndex: -1,
        top: 'calc(-1 * var(--safe-area-inset-top, 0px))',
        left: 0,
        right: 0,
        width: '100%',
        height: 'calc(100vh + var(--safe-area-inset-top, 0px) + var(--safe-area-inset-bottom, 0px))',
        background: gradientStyle,
      }}
    />
  );
}
