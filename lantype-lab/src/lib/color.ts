export type Rgb = [number, number, number];
export type Rgba = [number, number, number, number];

/** #RRGGBB ou #RGB vers composantes 0..1. */
export function hexToRgb(hex: string): Rgb {
  let value = hex.trim().replace('#', '');
  if (value.length === 3) {
    value = value
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const int = Number.parseInt(value, 16);
  if (Number.isNaN(int) || value.length !== 6) return [1, 1, 1];
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
}

export function hexToRgba(hex: string, alpha: number): Rgba {
  const [r, g, b] = hexToRgb(hex);
  return [r, g, b, alpha];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}
