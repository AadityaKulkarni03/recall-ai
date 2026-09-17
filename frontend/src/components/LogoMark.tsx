"use client";

import { useEffect, useRef } from "react";
import { icosahedron, mountScene, project, rotateX, rotateY } from "@/lib/scene3d";

const { vertices: VERTS, edges: EDGES } = icosahedron();

interface LogoMarkProps {
  size?: number;
  /** Tints the solid cyan while the backend is unreachable. */
  offline?: boolean;
}

/**
 * Small rotating wireframe solid used as the brand mark. Decorative only —
 * the product name next to it carries the meaning.
 */
export default function LogoMark({ size = 40, offline = false }: LogoMarkProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Mirrored into a ref so the draw loop can read the latest value without
  // being torn down and remounted every time the status flips.
  const offlineRef = useRef(offline);
  useEffect(() => {
    offlineRef.current = offline;
  }, [offline]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    return mountScene(canvas, (ctx, w, h, t) => {
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.3;
      const rgb = offlineRef.current ? "94, 117, 144" : "52, 211, 153";

      const pts = VERTS.map((v) =>
        project(rotateX(rotateY(v, t * 0.42), Math.sin(t * 0.3) * 0.4 + 0.25), cx, cy, radius),
      );

      ctx.lineWidth = 1;
      for (const [i, j] of EDGES) {
        const a = pts[i];
        const b = pts[j];
        // Back-facing edges dim out, which is what sells the solid as 3D.
        const alpha = Math.max(0, ((a.scale + b.scale) / 2 - 0.74) * 0.95);
        if (alpha <= 0.004) continue;
        ctx.strokeStyle = `rgba(${rgb}, ${Math.min(0.9, alpha).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      for (const p of pts) {
        const alpha = Math.max(0, (p.scale - 0.78) * 1.5);
        if (alpha <= 0.01) continue;
        ctx.fillStyle = `rgba(${rgb}, ${Math.min(1, alpha).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.6, p.scale * 1.1), 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, []);

  return <canvas ref={ref} aria-hidden="true" style={{ width: size, height: size }} />;
}
