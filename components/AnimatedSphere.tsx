"use client";
import { useEffect, useRef } from "react";

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  r: number; opacity: number; phase: number;
}

export default function AnimatedSphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const SIZE = Math.min(600, container.clientWidth);
    canvas.width = SIZE;
    canvas.height = SIZE;
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const R = SIZE * 0.367; // ~220 at 600px

    // Generate particles on sphere surface
    const particles: Particle[] = Array.from({ length: 160 }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      return {
        x: R * Math.sin(phi) * Math.cos(theta),
        y: R * Math.sin(phi) * Math.sin(theta),
        z: R * Math.cos(phi),
        vx: (Math.random() - 0.5) * 0.008,
        vy: (Math.random() - 0.5) * 0.008,
        vz: (Math.random() - 0.5) * 0.008,
        r: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.8 + 0.2,
        phase: Math.random() * Math.PI * 2,
      };
    });

    let t = 0;
    let animId: number;

    const draw = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      t += 0.005;

      // Draw nebula core gradient
      const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.9);
      innerGrad.addColorStop(0, "rgba(139,92,246,0.18)");
      innerGrad.addColorStop(0.4, "rgba(59,130,246,0.10)");
      innerGrad.addColorStop(0.75, "rgba(16,185,129,0.04)");
      innerGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = innerGrad;
      ctx.fill();

      // Outer glow ring
      const outerGrad = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.15);
      outerGrad.addColorStop(0, `rgba(139,92,246,${0.12 + 0.06 * Math.sin(t * 1.3)})`);
      outerGrad.addColorStop(0.5, `rgba(59,130,246,${0.06 + 0.03 * Math.sin(t)})`);
      outerGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.15, 0, Math.PI * 2);
      ctx.fillStyle = outerGrad;
      ctx.fill();

      // Rotate particles around Y axis
      const cosY = Math.cos(t * 0.3);
      const sinY = Math.sin(t * 0.3);

      const projected: Array<{ px: number; py: number; pz: number; p: Particle }> = [];
      for (const p of particles) {
        const rx = p.x * cosY + p.z * sinY;
        const ry = p.y;
        const rz = -p.x * sinY + p.z * cosY;
        projected.push({ px: cx + rx, py: cy + ry, pz: rz, p });
      }
      projected.sort((a, b) => a.pz - b.pz);

      // Draw connections between nearby particles
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const a = projected[i]!, b = projected[j]!;
          const dx = a.px - b.px, dy = a.py - b.py;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 55) {
            const alpha = (1 - dist / 55) * 0.15 * (0.5 + 0.5 * ((a.pz + b.pz) / (2 * R) + 0.5));
            ctx.beginPath();
            ctx.moveTo(a.px, a.py);
            ctx.lineTo(b.px, b.py);
            ctx.strokeStyle = `rgba(139,92,246,${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const { px, py, pz, p } of projected) {
        const depth = (pz / R + 1) / 2;
        const pulse = 0.5 + 0.5 * Math.sin(t * 2 + p.phase);
        const alpha = p.opacity * depth * (0.4 + 0.6 * pulse);
        const size = p.r * (0.5 + depth * 0.9);

        const grad = ctx.createRadialGradient(px, py, 0, px, py, size * 3);
        if (depth > 0.6) {
          grad.addColorStop(0, `rgba(200,180,255,${alpha})`);
          grad.addColorStop(0.4, `rgba(139,92,246,${alpha * 0.6})`);
        } else {
          grad.addColorStop(0, `rgba(100,150,255,${alpha * 0.6})`);
          grad.addColorStop(0.4, `rgba(59,130,246,${alpha * 0.3})`);
        }
        grad.addColorStop(1, "rgba(0,0,0,0)");

        ctx.beginPath();
        ctx.arc(px, py, size * 3, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Equatorial ring
      ctx.beginPath();
      ctx.ellipse(cx, cy, R * 1.02, R * 0.18, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(139,92,246,${0.08 + 0.04 * Math.sin(t * 0.7)})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center w-full"
      style={{ maxWidth: 600, aspectRatio: "1 / 1" }}
    >
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, rgba(59,130,246,0.04) 50%, transparent 75%)",
          animation: "sphere-pulse 4s ease-in-out infinite",
        }}
      />
      <canvas
        ref={canvasRef}
        className="relative w-full h-full"
        style={{ animation: "float 6s ease-in-out infinite" }}
      />
    </div>
  );
}
