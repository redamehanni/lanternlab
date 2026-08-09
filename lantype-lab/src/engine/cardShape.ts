/**
 * Silhouette de carte — arrondi ou coupe d'angle droite (chanfrein).
 * CanvasKit recent : Path est immuable → construction via PathBuilder.
 */
import type { CanvasKit, Path } from 'canvaskit-wasm';
import type { Rect } from '../materials/types';

export type CardCorner = {
  /** 0 = arrondi, 1 = coupe droite. */
  type: number;
  radius: number;
  chamfer: number;
};

export function makeCardPath(
  ck: CanvasKit,
  rect: Rect,
  corner: CardCorner,
  inset = 0,
): Path {
  const x = rect.x + inset;
  const y = rect.y + inset;
  const w = Math.max(1, rect.width - inset * 2);
  const h = Math.max(1, rect.height - inset * 2);
  const builder = new ck.PathBuilder();

  if (corner.type < 0.5) {
    const r = Math.max(0, Math.min(corner.radius - inset, w / 2, h / 2));
    builder.addRRect(ck.RRectXY(ck.LTRBRect(x, y, x + w, y + h), r, r));
    return builder.detachAndDelete();
  }

  const c = Math.max(
    0,
    Math.min(corner.chamfer, w / 2 - 0.5, h / 2 - 0.5),
  );
  if (c < 0.5) {
    builder.addRect(ck.LTRBRect(x, y, x + w, y + h));
    return builder.detachAndDelete();
  }

  builder.moveTo(x + c, y);
  builder.lineTo(x + w - c, y);
  builder.lineTo(x + w, y + c);
  builder.lineTo(x + w, y + h - c);
  builder.lineTo(x + w - c, y + h);
  builder.lineTo(x + c, y + h);
  builder.lineTo(x, y + h - c);
  builder.lineTo(x, y + c);
  builder.close();
  return builder.detachAndDelete();
}
