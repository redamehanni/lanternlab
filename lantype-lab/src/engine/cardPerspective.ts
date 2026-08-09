/**
 * Perspective 3/4 pour les cartes du Material Lab (CanvasKit M44).
 * CanvasKit stocke les M44 en row-major (voir M44.rc → index 4*row+col).
 */
import type { CanvasKit } from 'canvaskit-wasm';
import type { Rect } from '../materials/types';

export type CardPerspective = {
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  /** Distance camera (px). Plus petit = foreshortening plus fort. */
  perspective: number;
};

export const DEFAULT_PERSPECTIVE: CardPerspective = {
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  perspective: 1200,
};

export type PerspectivePresetId = 'face' | 'threeQuarterLeft' | 'threeQuarterRight' | 'dive';

export const PERSPECTIVE_PRESETS: Record<
  PerspectivePresetId,
  { label: string; values: CardPerspective }
> = {
  face: {
    label: 'Face',
    values: { rotateX: 0, rotateY: 0, rotateZ: 0, perspective: 1200 },
  },
  threeQuarterLeft: {
    label: '3/4 G',
    values: { rotateX: 10, rotateY: 32, rotateZ: -2, perspective: 1100 },
  },
  threeQuarterRight: {
    label: '3/4 D',
    values: { rotateX: 10, rotateY: -32, rotateZ: 2, perspective: 1100 },
  },
  dive: {
    label: 'Plongee',
    values: { rotateX: 24, rotateY: -14, rotateZ: 0, perspective: 1000 },
  },
};

const DEG = Math.PI / 180;
const EPS = 0.05;

export function hasPerspective(p: CardPerspective): boolean {
  return (
    Math.abs(p.rotateX) > EPS ||
    Math.abs(p.rotateY) > EPS ||
    Math.abs(p.rotateZ) > EPS
  );
}

/** Matrice row-major : T(c) · P · Rz · Ry · Rx · T(-c). */
export function buildCardMatrix(
  ck: CanvasKit,
  rect: Rect,
  p: CardPerspective,
): number[] | null {
  if (!hasPerspective(p)) return null;

  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const dist = Math.max(280, p.perspective);

  // Perspective CSS-like : m[3][2] = -1/dist  (row-major → index 14)
  const persp = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, -1 / dist, 1,
  ];

  return ck.M44.multiply(
    ck.M44.translated([cx, cy, 0]),
    persp,
    ck.M44.rotated([0, 0, 1], p.rotateZ * DEG),
    ck.M44.rotated([0, 1, 0], p.rotateY * DEG),
    ck.M44.rotated([1, 0, 0], p.rotateX * DEG),
    ck.M44.translated([-cx, -cy, 0]),
  );
}

export type Point2 = { x: number; y: number };

/** Projette un point local (z=0) par une M44 row-major CanvasKit. */
export function mapPoint(m: number[], x: number, y: number, z = 0): Point2 {
  const x_ = m[0]! * x + m[1]! * y + m[2]! * z + m[3]!;
  const y_ = m[4]! * x + m[5]! * y + m[6]! * z + m[7]!;
  const w_ = m[12]! * x + m[13]! * y + m[14]! * z + m[15]!;
  const inv = Math.abs(w_) > 1e-8 ? 1 / w_ : 1;
  return { x: x_ * inv, y: y_ * inv };
}

export function projectRectCorners(m: number[] | null, rect: Rect): Point2[] {
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
  if (!m) return corners;
  return corners.map((c) => mapPoint(m, c.x, c.y));
}

/** Point dans un quad convexe (corners en ordre). */
export function pointInQuad(p: Point2, quad: Point2[]): boolean {
  if (quad.length < 4) return false;
  let sign = 0;
  for (let i = 0; i < 4; i += 1) {
    const a = quad[i]!;
    const b = quad[(i + 1) % 4]!;
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (Math.abs(cross) < 1e-6) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return sign !== 0;
}

/** Boite englobante elargie du quad (filet de hit-test). */
export function pointInQuadBounds(p: Point2, quad: Point2[], pad = 10): boolean {
  if (!quad.length) return false;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of quad) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x);
    maxY = Math.max(maxY, c.y);
  }
  return (
    p.x >= minX - pad &&
    p.x <= maxX + pad &&
    p.y >= minY - pad &&
    p.y <= maxY + pad
  );
}
