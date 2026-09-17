"use client";

import { useEffect, useRef } from "react";
import { mountScene } from "@/lib/scene3d";

const STAR_COUNT = 150;
const NEAR = 0.28;
const RANGE = 2.4;
const SPEED = 0.035;

/**
 * Deterministic star field — a seeded PRNG keeps the layout identical between
 * renders, so the background never reshuffles on a resize.
 */
const STARS = (() => {
  let seed = 0x5ec0de;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  return Array.from({ length: STAR_COUNT }, () => ({
    x: rand() * 2 - 1,
    y: rand() * 2 - 1,
    z0: rand() * RANGE,
    // Most stars are plain white; a few pick up the brand hues.
    tint: rand(),
    twinkle: rand() * Math.PI * 2,
  }));
})();

/**
 * Ambient depth layer: stars drifting slowly toward the viewer. Fixed behind
 * everything, non-interactive, and deliberately dim so text stays readable.
 */
export default function Starfield3D() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    return mountScene(canvas, (ctx, w, h, t) => {
      const cx = w / 2;
      const cy = h / 2;
      // Scale the spread so stars fill wide monitors as well as narrow ones.
      const spread = Math.max(w, h) * 0.9;

      for (const s of STARS) {
        // Wrap depth into [NEAR, NEAR + RANGE) without storing per-frame state.
        let z = (s.z0 - t * SPEED) % RANGE;
        if (z < 0) z += RANGE;
        z += NEAR;

        // Perspective divide: nearer stars sweep further from the vanishing
        // point, which is what reads as forward motion.
        const k = 0.5 / z;
        const x = cx + s.x * spread * k;
        const y = cy + s.y * spread * k;
        if (x < -20 || x > w + 20 || y < -20 || y > h + 20) continue;

        // Nearer stars are bigger and brighter; everything fades at the edges
        // of the depth range so nothing pops in or out.
        const nearness = 1 - (z - NEAR) / RANGE;
        const fade = Math.min(1, nearness * 2.4, (1 - nearness) * 6 + 0.15);
        const twinkle = 0.75 + 0.25 * Math.sin(t * 0.8 + s.twinkle);
        const alpha = fade * twinkle * 0.34;
        if (alpha <= 0.004) continue;

        const rgb =
          s.tint > 0.88 ? "52, 211, 153" : s.tint > 0.76 ? "56, 189, 248" : "255, 255, 255";

        ctx.fillStyle = `rgba(${rgb}, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.35, nearness * 1.5), 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
