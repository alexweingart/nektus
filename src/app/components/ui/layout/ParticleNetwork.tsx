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

  // Update colors ref during render (before effects run)
  const currentColorsRef = useRef<ParticleColors>(DEFAULT_COLORS);
  currentColorsRef.current = colors || DEFAULT_COLORS;

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

    // Animation loop
    const animate = () => {
      const particles = particlesRef.current;

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

    // Cancel any existing animation before starting new one
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      console.log('🎨 ParticleNetwork: Cancelled previous animation loop');
    }

    animate();
    console.log('🎨 ParticleNetwork: Animation loop started', { context, particleColor: currentColorsRef.current.particle });

    return () => {
      console.log('🎨 ParticleNetwork: Cleanup - cancelling animation');
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
