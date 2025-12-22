'use client';

import { useEffect, useRef, useState } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

/**
 * Particle Network Background
 * Creates a subtle network of particles that connect when nearby,
 * representing the concept of connection in the contact exchange app.
 */
export function ParticleNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    // Check for show-particles class on body
    const checkShowClass = () => {
      setShouldShow(document.body.classList.contains('show-particles'));
    };

    // Initial check
    checkShowClass();

    // Watch for class changes using MutationObserver
    const observer = new MutationObserver(checkShowClass);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || prefersReducedMotion || !shouldShow) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match HTML element
    const updateSize = () => {
      canvas.width = window.innerWidth;
      // Use the full screen height from CSS custom property
      const fullHeight = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--full-screen-height') ||
        window.innerHeight.toString()
      );
      canvas.height = fullHeight;

      console.log('=== PARTICLE NETWORK CANVAS ===');
      console.log('Canvas bitmap width:', canvas.width);
      console.log('Canvas bitmap height:', canvas.height);
      console.log('Canvas CSS height:', getComputedStyle(canvas).height);
      console.log('--full-screen-height:', fullHeight);
      console.log('==============================');
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    // Initialize particles
    const particleCount = Math.floor((canvas.width * canvas.height) / 15000); // Density based on screen size
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3, // Slow drift
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 1, // Size 1-3
      });
    }
    particlesRef.current = particles;

    // Log particle distribution
    console.log('=== PARTICLE DISTRIBUTION ===');
    console.log('Total particles:', particles.length);
    const bottomArea = particles.filter(p => p.y > 750).length;
    const middleArea = particles.filter(p => p.y > 400 && p.y <= 750).length;
    const topArea = particles.filter(p => p.y <= 400).length;
    console.log('Particles in bottom area (>750px):', bottomArea);
    console.log('Particles in middle area (400-750px):', middleArea);
    console.log('Particles in top area (<400px):', topArea);
    console.log('=============================');

    // Animation loop
    const animate = () => {
      // Clear with transparency to show CSS background gradient
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particles.forEach((particle) => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        // Draw particle (white with green tint)
        ctx.fillStyle = 'rgba(200, 255, 200, 0.6)';
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw connections
      const maxDistance = 150; // Max distance for connections
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.15)'; // Subtle green
      ctx.lineWidth = 1;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < maxDistance) {
            // Fade connection based on distance
            const opacity = (1 - distance / maxDistance) * 0.2;
            ctx.strokeStyle = `rgba(34, 197, 94, ${opacity})`;

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
  }, [prefersReducedMotion, shouldShow]);

  if (prefersReducedMotion || !shouldShow) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 pointer-events-none"
      style={{
        zIndex: -1,
        width: '100%',
        height: 'var(--full-screen-height, 100vh)',
        background: 'radial-gradient(ellipse at top, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0.12) 40%, rgba(10, 15, 26, 0.8) 70%, #0a0f1a 100%)',
      }}
    />
  );
}
