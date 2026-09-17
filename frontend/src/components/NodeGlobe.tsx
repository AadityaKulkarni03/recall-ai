"use client";

import { useEffect, useRef } from "react";
import {
  fibonacciSphere,
  nearestNeighbourEdges,
  mountScene,
  project,
  rotateX,
  rotateY,
} from "@/lib/scene3d";

const NODE_COUNT = 42;
const NODES = fibonacciSphere(NODE_COUNT);
const EDGES = nearestNeighbourEdges(NODES, 2);

// Fixed per-node phase so the pulse looks scattered rather than synchronised.
const PHASES = NODES.map((_, i) => (i * 2.399) % (Math.PI * 2));
// A handful of nodes read as "retrieved" and glow cyan instead of emerald.
const HOT = new Set([3, 11, 19, 28, 37]);

interface NodeGlobeProps {
  /** Rendered size in pixels. */
  size?: number;
}

/**
 * A slowly rotating sphere of connected nodes — the semantic index, drawn as
 * points in embedding space. Purely decorative, so it is hidden from
 * assistive tech.
 */
export default function NodeGlobe({ size = 190 }: NodeGlobeProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    return mountScene(canvas, (ctx, w, h, t) => {
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.34;

      const spinY = t * 0.16;
      const tiltX = 0.32 + Math.sin(t * 0.09) * 0.16;

      const pts = NODES.map((p) => project(rotateX(rotateY(p, spinY), tiltX), cx, cy, radius));

      // Edges first, behind the nodes. Alpha tracks depth so the far side of
      // the sphere recedes instead of cluttering the silhouette.
      ctx.lineWidth = 1;
      for (const [i, j] of EDGES) {
        const a = pts[i];
        const b = pts[j];
        const depth = (a.scale + b.scale) / 2;
        const alpha = Math.max(0, (depth - 0.72) * 0.34);
        if (alpha <= 0.002) continue;
        ctx.strokeStyle = `rgba(52, 211, 153, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Nodes back-to-front, so near ones overlap far ones correctly.
      const order = pts.map((p, i) => i).sort((a, b) => pts[b].z - pts[a].z);
      for (const i of order) {
        const p = pts[i];
        const pulse = 0.55 + 0.45 * Math.sin(t * 1.15 + PHASES[i]);
        const depth = Math.max(0, (p.scale - 0.7) / 0.9);
        const alpha = Math.min(1, depth * pulse * 1.15);
        if (alpha <= 0.01) continue;

        const r = 1.5 * p.scale;
        const hot = HOT.has(i);
        const rgb = hot ? "56, 189, 248" : "52, 211, 153";

        // Halo on the near, bright nodes only — keeps the whole thing calm.
        if (p.scale > 1 && pulse > 0.75) {
          const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 5);
          glow.addColorStop(0, `rgba(${rgb}, ${(alpha * 0.28).toFixed(3)})`);
          glow.addColorStop(1, `rgba(${rgb}, 0)`);
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = `rgba(${rgb}, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="mx-auto"
    />
  );
}
