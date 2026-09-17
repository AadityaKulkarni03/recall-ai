/**
 * Minimal 3D toolkit — perspective projection on a 2D canvas.
 *
 * No WebGL, no dependencies. Points live in a unit-ish space centred on the
 * origin; `project` flattens them to screen pixels with a real perspective
 * divide, so nearer geometry is genuinely larger and brighter.
 */

export type Vec3 = { x: number; y: number; z: number };

/** A point after the perspective divide. */
export interface Projected {
  x: number;
  y: number;
  /** Perspective factor: >1 is nearer than the origin, <1 is further. */
  scale: number;
  /** Original camera-space depth, for painter's-algorithm sorting. */
  z: number;
}

/** Distance from camera to origin, in the same units as the geometry. */
export const CAMERA_DIST = 2.8;

export function rotateX(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}

export function rotateY(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}

/**
 * Flatten a camera-space point to screen pixels.
 * `radius` is how many pixels one geometry unit spans at the origin.
 */
export function project(
  p: Vec3,
  cx: number,
  cy: number,
  radius: number,
  dist = CAMERA_DIST,
): Projected {
  const scale = dist / (dist + p.z);
  return { x: cx + p.x * radius * scale, y: cy + p.y * radius * scale, scale, z: p.z };
}

/**
 * Evenly distribute `n` points over a unit sphere.
 *
 * Uses the golden-angle spiral, which avoids the clustering you get at the
 * poles from naive lat/long sampling.
 */
export function fibonacciSphere(n: number): Vec3[] {
  const pts: Vec3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / Math.max(n - 1, 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    pts.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r });
  }
  return pts;
}

/**
 * Connect each point to its nearest neighbours, deduped so every edge is
 * stored once. Produces the "node graph" look without drawing lines twice.
 */
export function nearestNeighbourEdges(pts: Vec3[], perNode: number): [number, number][] {
  const seen = new Set<string>();
  const edges: [number, number][] = [];

  for (let i = 0; i < pts.length; i++) {
    const dists = pts
      .map((p, j) => {
        const dx = p.x - pts[i].x;
        const dy = p.y - pts[i].y;
        const dz = p.z - pts[i].z;
        return { j, d: dx * dx + dy * dy + dz * dz };
      })
      .filter((c) => c.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, perNode);

    for (const { j } of dists) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([i, j]);
    }
  }
  return edges;
}

/** Unit icosahedron — 12 vertices, 30 edges. Used for the logo mark. */
export function icosahedron(): { vertices: Vec3[]; edges: [number, number][] } {
  const t = (1 + Math.sqrt(5)) / 2;
  const raw: [number, number, number][] = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];
  const len = Math.sqrt(1 + t * t);
  const vertices = raw.map(([x, y, z]) => ({ x: x / len, y: y / len, z: z / len }));

  // Every pair at the minimum separation is an edge of the solid.
  const edges: [number, number][] = [];
  const edgeLen = 2 / len;
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      const dx = vertices[i].x - vertices[j].x;
      const dy = vertices[i].y - vertices[j].y;
      const dz = vertices[i].z - vertices[j].z;
      if (Math.abs(Math.sqrt(dx * dx + dy * dy + dz * dz) - edgeLen) < 1e-6) {
        edges.push([i, j]);
      }
    }
  }
  return { vertices, edges };
}

/** Draw callback. `w`/`h` are CSS pixels; `t` is seconds since mount. */
export type DrawFn = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
) => void;

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Drive a canvas with a requestAnimationFrame loop.
 *
 * Handles HiDPI scaling, container resizes, pausing while the tab is hidden,
 * and `prefers-reduced-motion` (one static frame instead of an animation).
 * Returns a cleanup function — call it on unmount.
 */
export function mountScene(canvas: HTMLCanvasElement, draw: DrawFn): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  let raf = 0;
  let w = 0;
  let h = 0;
  const start = performance.now();
  const still = prefersReducedMotion();

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    if (w === 0 || h === 0) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    // Draw in CSS pixels; the transform handles the device ratio.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (still) render(0);
  };

  const render = (t: number) => {
    ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h, t);
  };

  const frame = (now: number) => {
    render((now - start) / 1000);
    raf = requestAnimationFrame(frame);
  };

  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!raf && !still) {
      raf = requestAnimationFrame(frame);
    }
  };

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  document.addEventListener("visibilitychange", onVisibility);
  resize();

  // Reduced motion gets a single composed frame, never a loop.
  if (!still) raf = requestAnimationFrame(frame);

  return () => {
    if (raf) cancelAnimationFrame(raf);
    observer.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
