'use client';

import { useCallback, useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

interface ParticleNetworkProps {
  className?: string;
  particleCount?: number;
  connectionDistance?: number;
  mouseRadius?: number;
}

export const ParticleNetwork = ({
  className = '',
  particleCount = 80,
  connectionDistance = 150,
  mouseRadius = 200,
}: ParticleNetworkProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animationRef = useRef<number | undefined>(undefined);
  const resizeObserverRef = useRef<ResizeObserver | undefined>(undefined);

  const colors = ['#6F40C9', '#9B6DD7', '#F79D53', '#8B5AC9'];

  const createParticle = useCallback(
    (width: number, height: number): Particle => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      radius: Math.random() * 2 + 1,
      color: colors[Math.floor(Math.random() * colors.length)],
    }),
    [],
  );

  const initParticles = useCallback(
    (width: number, height: number) => {
      particlesRef.current = Array.from({ length: particleCount }, () =>
        createParticle(width, height),
      );
    },
    [particleCount, createParticle],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      if (particlesRef.current.length === 0) {
        initParticles(rect.width, rect.height);
      }
    };

    updateCanvasSize();

    resizeObserverRef.current = new ResizeObserver(updateCanvasSize);
    resizeObserverRef.current.observe(canvas);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      // Update and draw particles
      for (const particle of particlesRef.current) {
        // Mouse interaction - gentle push away
        const dx = mouseRef.current.x - particle.x;
        const dy = mouseRef.current.y - particle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < mouseRadius && dist > 0) {
          const force = (mouseRadius - dist) / mouseRadius;
          particle.vx -= (dx / dist) * force * 0.02;
          particle.vy -= (dy / dist) * force * 0.02;
        }

        // Apply velocity with damping
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.99;
        particle.vy *= 0.99;

        // Add slight random movement
        particle.vx += (Math.random() - 0.5) * 0.02;
        particle.vy += (Math.random() - 0.5) * 0.02;

        // Bounce off edges
        if (particle.x < 0 || particle.x > width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > height) particle.vy *= -1;

        // Keep in bounds
        particle.x = Math.max(0, Math.min(width, particle.x));
        particle.y = Math.max(0, Math.min(height, particle.y));

        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.fill();
      }

      // Draw connections
      for (let i = 0; i < particlesRef.current.length; i++) {
        for (let j = i + 1; j < particlesRef.current.length; j++) {
          const p1 = particlesRef.current[i];
          const p2 = particlesRef.current[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDistance) {
            const opacity = (1 - dist / connectionDistance) * 0.3;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(111, 64, 201, ${opacity})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // Draw mouse connections
      const mouse = mouseRef.current;
      if (mouse.x > 0 && mouse.y > 0) {
        for (const particle of particlesRef.current) {
          const dx = mouse.x - particle.x;
          const dy = mouse.y - particle.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < mouseRadius) {
            const opacity = (1 - dist / mouseRadius) * 0.5;
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(mouse.x, mouse.y);
            const gradient = ctx.createLinearGradient(
              particle.x,
              particle.y,
              mouse.x,
              mouse.y,
            );
            gradient.addColorStop(0, `rgba(111, 64, 201, ${opacity})`);
            gradient.addColorStop(1, `rgba(247, 157, 83, ${opacity})`);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [initParticles, connectionDistance, mouseRadius]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-auto ${className}`}
      style={{ display: 'block' }}
    />
  );
};
