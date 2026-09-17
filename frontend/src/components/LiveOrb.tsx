"use client";

import { useEffect, useRef, type RefObject } from "react";
import { fibonacciSphere, mountScene, project, rotateX, rotateY } from "@/lib/scene3d";

const SHELL = fibonacciSphere(80);
const PHASES = SHELL.map((_, i) => (i * 1.7231) % (Math.PI * 2));
const RING_SEGMENTS = 64;

interface LiveOrbProps {
  /** Live microphone amplitude, 0–1. Read per frame to avoid re-rendering. */
  levelRef: RefObject<number>;
  size?: number;
}

/**
 * Pulsing 3D particle shell that breathes with the microphone input.
 *
 * The level is read from a ref rather than props so the audio analyser can
 * update it at 60fps without triggering React renders.
 */
export default function LiveOrb({ levelRef, size = 120 }: LiveOrbProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Smoothed level — raw amplitude is far too jittery to drive geometry.
  const smooth = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    return mountScene(canvas, (ctx, w, h, t) => {
      const cx = w / 2;
      const cy = h / 2;
      const base = Math.min(w, h) * 0.3;

      const target = Math.min(1, Math.max(0, levelRef.current ?? 0));
      smooth.current += (target - smooth.current) * 0.12;
      const lvl = smooth.current;

      const spinY = t * 0.5;
      const tiltX = 0.4;

      // Equatorial ring, drawn behind the particles.
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(248, 113, 113, ${(0.12 + lvl * 0.3).toFixed(3)})`;
      ctx.beginPath();
      for (let i = 0; i <= RING_SEGMENTS; i++) {
        const a = (i / RING_SEGMENTS) * Math.PI * 2;
        const p = project(
          rotateX(rotateY({ x: Math.cos(a), y: 0, z: Math.sin(a) }, spinY), tiltX),
          cx,
          cy,
          base * (1.25 + lvl * 0.25),
        );
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      // Particle shell. Each point rides its own wave so the surface ripples
      // instead of inflating as one rigid ball.
      const radius = base * (1 + lvl * 0.3);
      for (let i = 0; i < SHELL.length; i++) {
        const wobble = 1 + Math.sin(t * 2.2 + PHASES[i]) * (0.03 + lvl * 0.14);
        const v = SHELL[i];
        const p = project(
          rotateX(rotateY({ x: v.x * wobble, y: v.y * wobble, z: v.z * wobble }, spinY), tiltX),
          cx,
          cy,
          radius,
        );

        const depth = Math.max(0, (p.scale - 0.7) / 0.9);
        const alpha = Math.min(1, depth * (0.35 + lvl * 0.65));
        if (alpha <= 0.01) continue;

        ctx.fillStyle = `rgba(248, 113, 113, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.scale * (1 + lvl * 0.8)), 0, Math.PI * 2);
        ctx.fill();
      }

      // Core glow, scaled by loudness.
      const coreR = base * (0.35 + lvl * 0.5);
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      core.addColorStop(0, `rgba(248, 113, 113, ${(0.12 + lvl * 0.3).toFixed(3)})`);
      core.addColorStop(1, "rgba(248, 113, 113, 0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [levelRef]);

  return <canvas ref={ref} aria-hidden="true" style={{ width: size, height: size }} />;
}
