/**
 * Scene CanvasKit — boucle de rendu a 60 fps.
 *
 * Le state React n'est jamais lu dans la boucle : tout passe par une ref
 * mutee. Ainsi, deplacer un curseur ne declenche aucun re-render React,
 * seulement une mise a jour de valeurs lues a la frame suivante.
 */
import type {
  Canvas,
  CanvasKit,
  Image,
  Paint,
  RuntimeEffect,
  Surface,
} from 'canvaskit-wasm';
import type { LightEnvironment } from '../lighting/environments';
import { ambientFor } from '../lighting/environments';
import { hexToRgba } from '../lib/color';
import type { MaterialModule, Params, Rect, RenderPlan } from '../materials/types';
import { packUniforms } from './uniforms';
import type { LabCard } from './labCards';
import {
  buildCardMatrix,
  mapPoint,
  pointInQuad,
  pointInQuadBounds,
  projectRectCorners,
  type CardPerspective,
} from './cardPerspective';
import { makeCardPath, type CardCorner } from './cardShape';

type GlowPlan = NonNullable<RenderPlan['glow']>;

/** Hash deterministe 0..1 pour etincelles de halo. */
function hash21(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Intervalles on/off pour PathEffect.MakeDash — irreguliers si irr > 0. */
function buildDashIntervals(base: number, irregularity: number): number[] {
  const dash = Math.max(0.5, base);
  const irr = Math.max(0, Math.min(1, irregularity));
  if (irr < 0.01) return [dash, dash];

  const intervals: number[] = [];
  let seed = 0.417 + irr * 1.913;
  const next = () => {
    seed = (seed * 17.13 + 0.37) % 1;
    return seed;
  };
  for (let i = 0; i < 12; i += 1) {
    const onJitter = (next() - 0.5) * 2 * irr;
    // Irregularite forte → melange points courts et tirets longs.
    const onScale = irr > 0.55 && next() > 0.55 ? 0.22 + next() * 0.35 : 1 + onJitter;
    const on = Math.max(0.4, dash * onScale);
    const offJitter = (next() - 0.5) * 2 * irr;
    const off = Math.max(0.4, dash * (0.7 + offJitter * 1.35));
    intervals.push(on, off);
  }
  return intervals;
}

export type CompareMode = 'single' | 'ab' | 'beforeAfter';
export type FrameMode = 'desktop' | 'phone';
export type { LabCard } from './labCards';

export type SceneConfig = {
  material: MaterialModule;
  params: Params;
  /** Second preset pour A/B et Before/After. */
  paramsB: Params | null;
  compareMode: CompareMode;
  /** Cadre du simulateur — desktop plein panneau ou telephone. */
  frameMode: FrameMode;
  /** Position du separateur Before/After (0..1). */
  split: number;
  layerCode: number;
  environment: LightEnvironment;
  /** Position du reflet a deplacer a la souris (uv 0..1), null = non. */
  draggingReflect: boolean;
  /** Mode glisser le fond (pan). */
  draggingBackground: boolean;
  /** Cartes nommees dans le simulateur. */
  cards: LabCard[];
  /** Carte selectionnee (drag + sliders). */
  activeCardId: string | null;
  /** Zoom du fond : 1 = cover classique. */
  bgZoom: number;
  /** Pan du fond (px scene). */
  bgPan: [number, number];
};

export type SceneCallbacks = {
  onReflectDrag?: (uv: [number, number]) => void;
  onSplitDrag?: (ratio: number) => void;
  onActiveCard?: (id: string) => void;
  onCardOffset?: (id: string, offset: { offsetX: number; offsetY: number }) => void;
  onBgPan?: (pan: [number, number]) => void;
  onBgZoom?: (zoom: number) => void;
};

type EffectCache = {
  source: string;
  effect: RuntimeEffect;
};

export class Stage {
  private ck: CanvasKit;
  private canvasEl: HTMLCanvasElement;
  private surface: Surface;
  private bgImage: Image | null = null;
  private bgPaint: Paint;
  private effectCache: EffectCache | null = null;
  private raf = 0;
  private start = performance.now();
  private config: SceneConfig;
  private callbacks: SceneCallbacks;
  private dpr = 1;
  private width = 1;
  private height = 1;
  private pointerDown = false;
  private splitDragging = false;
  private cardDragging = false;
  private cardDragOrigin: {
    id: string;
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null = null;
  private bgDragging = false;
  private bgDragOrigin: { x: number; y: number; px: number; py: number } | null = null;
  /** Offsets locaux pendant un drag (id → offset). */
  private liveOffsets = new Map<string, { offsetX: number; offsetY: number }>();
  private bgPan: [number, number] = [0, 0];
  private static readonly HANDLE_R = 11;

  constructor(
    ck: CanvasKit,
    canvasEl: HTMLCanvasElement,
    initial: SceneConfig,
    callbacks: SceneCallbacks = {},
  ) {
    this.ck = ck;
    this.canvasEl = canvasEl;
    this.config = initial;
    this.callbacks = callbacks;
    this.bgPan = initial.bgPan ?? [0, 0];
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.surface = this.makeSurface();
    this.bgPaint = new ck.Paint();
    this.bgPaint.setAntiAlias(true);

    this.bindPointer();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  setConfig(next: Partial<SceneConfig>) {
    this.config = { ...this.config, ...next };
    if (next.bgPan && !this.bgDragging) {
      this.bgPan = next.bgPan;
    }
    // Si React renvoie les cartes a jour hors drag, on laisse liveOffsets
    // pour la carte en cours de drag uniquement.
    if (next.cards && !this.cardDragging) {
      this.liveOffsets.clear();
    }
  }

  setCallbacks(next: SceneCallbacks) {
    this.callbacks = next;
  }

  async setBackground(url: string | null) {
    if (this.bgImage) {
      this.bgImage.delete();
      this.bgImage = null;
    }
    if (!url) return;
    try {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      const image = this.ck.MakeImageFromEncoded(new Uint8Array(buf));
      if (image) this.bgImage = image;
    } catch (err) {
      console.warn('[Stage] fond illisible', err);
    }
  }

  resize(cssWidth: number, cssHeight: number) {
    this.width = Math.max(1, Math.floor(cssWidth));
    this.height = Math.max(1, Math.floor(cssHeight));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.surface.delete();
    this.surface = this.makeSurface();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.unbindPointer();
    this.surface.delete();
    this.bgPaint.delete();
    if (this.bgImage) this.bgImage.delete();
    if (this.effectCache) this.effectCache.effect.delete();
  }

  private makeSurface(): Surface {
    const w = Math.max(1, Math.floor(this.width * this.dpr));
    const h = Math.max(1, Math.floor(this.height * this.dpr));
    this.canvasEl.width = w;
    this.canvasEl.height = h;
    this.canvasEl.style.width = `${this.width}px`;
    this.canvasEl.style.height = `${this.height}px`;
    const surface = this.ck.MakeWebGLCanvasSurface(this.canvasEl);
    if (!surface) {
      // Fallback CPU — plus lent, mais le labo reste utilisable.
      return this.ck.MakeSWCanvasSurface(this.canvasEl)!;
    }
    return surface;
  }

  private loop(now: number) {
    this.raf = requestAnimationFrame(this.loop);
    const time = (now - this.start) / 1000;
    const canvas = this.surface.getCanvas();
    canvas.clear(this.ck.Color(8, 6, 12, 1));
    canvas.save();
    canvas.scale(this.dpr, this.dpr);

    this.drawBackground(canvas);
    this.drawWash(canvas);

    const mode = this.config.compareMode;
    if (mode === 'single' || !this.config.paramsB) {
      const cards = this.config.cards?.length ? this.config.cards : [this.fallbackCard()];
      for (const card of cards) {
        const resolved = this.resolvedCard(card);
        const rect = this.rectForCard(resolved);
        const matrix = this.matrixForCard(resolved, rect);
        const cardParams = resolved.params ?? this.config.params;
        canvas.save();
        if (matrix) canvas.concat(matrix);
        this.drawCard(canvas, cardParams, rect, time);
        this.drawCardText(canvas, resolved, rect, cardParams);
        canvas.restore();
        if (resolved.id === this.config.activeCardId) {
          const handle = this.handleCenter(rect, matrix);
          this.drawCardHandleAt(canvas, handle.x, handle.y);
          const labelPt = matrix
            ? mapPoint(matrix, rect.x + 10, rect.y - 4)
            : { x: rect.x + 10, y: rect.y - 18 };
          this.drawLabel(canvas, resolved.name, labelPt.x, labelPt.y);
        }
      }
    } else if (mode === 'ab') {
      const gap = 24;
      const half = (this.width - gap) / 2;
      const left = this.cardRectIn(0, half);
      const right = this.cardRectIn(half + gap, half);
      this.drawCard(canvas, this.config.params, left, time);
      this.drawCard(canvas, this.config.paramsB, right, time);
      this.drawLabel(canvas, 'A', left.x + 12, left.y - 18);
      this.drawLabel(canvas, 'B', right.x + 12, right.y - 18);
    } else {
      // Before / After — meme carte, clip gauche / droite
      const rect = this.activeCardRect();
      const splitX = this.width * this.config.split;

      canvas.save();
      canvas.clipRect(
        this.ck.LTRBRect(0, 0, splitX, this.height),
        this.ck.ClipOp.Intersect,
        true,
      );
      this.drawCard(canvas, this.config.params, rect, time);
      canvas.restore();

      canvas.save();
      canvas.clipRect(
        this.ck.LTRBRect(splitX, 0, this.width, this.height),
        this.ck.ClipOp.Intersect,
        true,
      );
      this.drawCard(canvas, this.config.paramsB, rect, time);
      canvas.restore();

      this.drawSplitHandle(canvas, splitX);
    }

    canvas.restore();
    this.surface.flush();
  }

  private fallbackCard(): LabCard {
    return {
      id: 'fallback',
      name: 'Carte',
      width: 316,
      height: 122,
      offsetX: 0,
      offsetY: 0,
      eyebrow: '',
      title: '',
      body: '',
      showText: false,
      rotateX: 0,
      rotateY: 0,
      rotateZ: 0,
      perspective: 1200,
      params: this.config.params,
      styleId: null,
      styleName: 'Style libre',
    };
  }

  private resolvedCard(card: LabCard): LabCard {
    const base: LabCard = {
      ...card,
      eyebrow: card.eyebrow ?? '',
      title: card.title ?? '',
      body: card.body ?? '',
      showText: card.showText !== false,
      rotateX: card.rotateX ?? 0,
      rotateY: card.rotateY ?? 0,
      rotateZ: card.rotateZ ?? 0,
      perspective: card.perspective ?? 1200,
      params: card.params ?? this.config.params,
      styleId: card.styleId ?? null,
      styleName: card.styleName ?? 'Style libre',
    };
    const live = this.liveOffsets.get(card.id);
    if (!live) return base;
    return { ...base, offsetX: live.offsetX, offsetY: live.offsetY };
  }

  private perspectiveOf(card: LabCard): CardPerspective {
    return {
      rotateX: card.rotateX ?? 0,
      rotateY: card.rotateY ?? 0,
      rotateZ: card.rotateZ ?? 0,
      perspective: card.perspective ?? 1200,
    };
  }

  private matrixForCard(card: LabCard, rect: Rect): number[] | null {
    return buildCardMatrix(this.ck, rect, this.perspectiveOf(card));
  }

  private activeCard(): LabCard {
    const cards = this.config.cards || [];
    const found =
      cards.find((c) => c.id === this.config.activeCardId) || cards[0] || null;
    if (found) return this.resolvedCard(found);
    return this.fallbackCard();
  }

  private rectForCard(card: LabCard): Rect {
    const c = this.resolvedCard(card);
    const w = Math.max(80, Math.min(c.width, this.width - 8));
    const h = Math.max(64, Math.min(c.height, this.height - 8));
    return {
      x: (this.width - w) / 2 + c.offsetX,
      y: (this.height - h) / 2 + c.offsetY,
      width: w,
      height: h,
    };
  }

  private activeCardRect(): Rect {
    return this.rectForCard(this.activeCard());
  }

  private cardRectIn(xOrigin: number, available: number): Rect {
    const c = this.activeCard();
    const maxW = Math.min(c.width, available * 0.92);
    const h = Math.max(64, Math.min(c.height, this.height - 8));
    return {
      x: xOrigin + (available - maxW) / 2 + c.offsetX * 0.5,
      y: (this.height - h) / 2 + c.offsetY,
      width: maxW,
      height: h,
    };
  }

  private handleCenter(
    rect: Rect,
    matrix: number[] | null = null,
  ): { x: number; y: number } {
    const local = {
      x: rect.x + rect.width / 2,
      y: rect.y - 6,
    };
    if (!matrix) return local;
    return mapPoint(matrix, local.x, local.y);
  }

  private drawCardHandleAt(canvas: Canvas, x: number, y: number) {
    const r = Stage.HANDLE_R;

    const shadow = new this.ck.Paint();
    shadow.setAntiAlias(true);
    shadow.setColor(this.ck.Color(0, 0, 0, 0.35));
    canvas.drawCircle(x, y + 1.5, r + 1, shadow);
    shadow.delete();

    const fill = new this.ck.Paint();
    fill.setAntiAlias(true);
    fill.setColor(this.ck.Color(240, 228, 194, 0.95));
    canvas.drawCircle(x, y, r, fill);
    fill.delete();

    const ring = new this.ck.Paint();
    ring.setAntiAlias(true);
    ring.setStyle(this.ck.PaintStyle.Stroke);
    ring.setStrokeWidth(1.5);
    ring.setColor(this.ck.Color(232, 168, 48, 0.9));
    canvas.drawCircle(x, y, r, ring);
    ring.delete();

    // Petite croix de deplacement
    const grip = new this.ck.Paint();
    grip.setAntiAlias(true);
    grip.setStrokeWidth(1.6);
    grip.setColor(this.ck.Color(40, 28, 12, 0.75));
    grip.setStyle(this.ck.PaintStyle.Stroke);
    canvas.drawLine(x - 4, y, x + 4, y, grip);
    canvas.drawLine(x, y - 4, x, y + 4, grip);
    grip.delete();
  }

  private drawBackground(canvas: Canvas) {
    if (!this.bgImage) {
      const paint = new this.ck.Paint();
      paint.setColor(this.ck.Color(18, 12, 22, 1));
      canvas.drawRect(this.ck.LTRBRect(0, 0, this.width, this.height), paint);
      paint.delete();
      return;
    }
    const { dx, dy, dw, dh, iw, ih } = this.bgLayout();
    canvas.drawImageRect(
      this.bgImage,
      this.ck.LTRBRect(0, 0, iw, ih),
      this.ck.LTRBRect(dx, dy, dx + dw, dy + dh),
      this.bgPaint,
    );
  }

  private drawWash(canvas: Canvas) {
    const env = this.config.environment;
    if (env.washOpacity <= 0) return;
    const [r, g, b, a] = hexToRgba(env.wash, env.washOpacity);
    const paint = new this.ck.Paint();
    paint.setColor(this.ck.Color(r * 255, g * 255, b * 255, a));
    canvas.drawRect(this.ck.LTRBRect(0, 0, this.width, this.height), paint);
    paint.delete();
  }

  private cornerFromPlan(plan: Pick<RenderPlan, 'radius' | 'cornerType' | 'chamfer'>): CardCorner {
    return {
      type: plan.cornerType ?? 0,
      radius: plan.radius ?? 28,
      chamfer: plan.chamfer ?? 24,
    };
  }

  private drawGlow(
    canvas: Canvas,
    rect: Rect,
    corner: CardCorner,
    glow: GlowPlan,
    time: number,
  ) {
    const [r, g, b, a] = glow.color;
    const spread = glow.spread;
    const dx = glow.dx ?? 0;
    const dy = glow.dy ?? 0;

    canvas.save();
    canvas.translate(dx, dy);

    const glowPaint = new this.ck.Paint();
    glowPaint.setAntiAlias(true);
    glowPaint.setColor(this.ck.Color(r * 255, g * 255, b * 255, a));
    glowPaint.setMaskFilter(
      this.ck.MaskFilter.MakeBlur(this.ck.BlurStyle.Normal, glow.blur, true),
    );
    const expanded: Rect = {
      x: rect.x - spread,
      y: rect.y - spread,
      width: rect.width + spread * 2,
      height: rect.height + spread * 2,
    };
    const glowCorner: CardCorner = {
      type: corner.type,
      radius: corner.radius + spread,
      chamfer: corner.chamfer + spread * 0.65,
    };
    const glowPath = makeCardPath(this.ck, expanded, glowCorner);
    canvas.drawPath(glowPath, glowPaint);
    glowPath.delete();
    glowPaint.delete();
    canvas.restore();

    // Etincelles externes (type Particules) — derivees hors de la plaque.
    if (glow.type > 0.5 && glow.particles > 0.01) {
      const count = Math.round(6 + glow.particles * 28);
      const angle = glow.angle;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const cx = rect.x + rect.width / 2 + dx * 0.35;
      const cy = rect.y + rect.height / 2 + dy * 0.35;
      const rx = rect.width * 0.55 + spread;
      const ry = rect.height * 0.55 + spread;
      const spark = new this.ck.Paint();
      spark.setAntiAlias(true);
      for (let i = 0; i < count; i += 1) {
        const seed = i * 17.13 + 2.4;
        const drift = 0.08 + hash21(seed, 1.2) * 0.16;
        const along = (hash21(seed, 2.8) + time * drift) % 1;
        const across = (hash21(seed, 4.1) - 0.5) * 2;
        const px = cx + c * (along * 2 - 1) * rx + -s * across * ry * 0.55;
        const py = cy + s * (along * 2 - 1) * rx + c * across * ry * 0.55;
        // Preferer le cote eclaire
        const side = (px - cx) * c + (py - cy) * s;
        if (side < -rx * 0.15 && hash21(seed, 6.2) > 0.35) continue;
        const twinkle =
          0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * (2.5 + hash21(seed, 8) * 6) + seed));
        const size = 0.7 + hash21(seed, 9.1) * 2.2 * glow.particles;
        spark.setColor(
          this.ck.Color(r * 255, g * 255, b * 255, a * 1.35 * twinkle * glow.particles),
        );
        canvas.drawCircle(px, py, size, spark);
      }
      spark.delete();
    }
  }

  private drawCard(canvas: Canvas, params: Params, card: Rect, time: number) {
    const material = this.config.material;
    const ambient = ambientFor(this.config.environment);
    const plan = material.plan(params, {
      card,
      stage: { width: this.width, height: this.height },
      time,
      layerCode: this.config.layerCode,
      ambient,
    });

    const effect = this.getEffect(plan.shaderSource);
    if (!effect) return;

    const layout = this.bgLayout();
    const uniforms = {
      ...plan.uniforms,
      uBgOffset: [layout.dx, layout.dy],
      uBgScale: [layout.iw / layout.dw, layout.ih / layout.dh],
    };

    const bgShader = this.makeBgShader();
    const children = bgShader ? [bgShader] : [];
    const packed = packUniforms(effect, uniforms);
    const shader = effect.makeShaderWithChildren(Array.from(packed), children);
    if (!shader) {
      bgShader?.delete();
      return;
    }

    const corner = this.cornerFromPlan(plan);
    const cardPath = makeCardPath(this.ck, plan.rect, corner);

    // Halo (doux directionnel + option particules externes)
    if (plan.glow && plan.glow.color[3] > 0.001) {
      this.drawGlow(canvas, plan.rect, corner, plan.glow, time);
    }

    // Ombre externe
    if (plan.outerShadow && plan.outerShadow.color[3] > 0.001) {
      const shadowPaint = new this.ck.Paint();
      const [r, g, b, a] = plan.outerShadow.color;
      shadowPaint.setColor(this.ck.Color(r * 255, g * 255, b * 255, a));
      shadowPaint.setMaskFilter(
        this.ck.MaskFilter.MakeBlur(this.ck.BlurStyle.Normal, plan.outerShadow.blur, true),
      );
      canvas.save();
      canvas.translate(plan.outerShadow.dx, plan.outerShadow.dy);
      canvas.drawPath(cardPath, shadowPaint);
      canvas.restore();
      shadowPaint.delete();
    }

    // Plaque verre
    const paint = new this.ck.Paint();
    paint.setAntiAlias(true);
    paint.setShader(shader);
    canvas.drawPath(cardPath, paint);
    paint.delete();
    shader.delete();
    bgShader?.delete();

    // Contour
    if (plan.border && plan.border.width > 0 && plan.border.color[3] > 0.001) {
      const borderPaint = new this.ck.Paint();
      borderPaint.setAntiAlias(true);
      borderPaint.setStyle(this.ck.PaintStyle.Stroke);
      borderPaint.setStrokeWidth(plan.border.width);
      const sharp = corner.type >= 0.5;
      borderPaint.setStrokeCap(sharp ? this.ck.StrokeCap.Butt : this.ck.StrokeCap.Round);
      borderPaint.setStrokeJoin(sharp ? this.ck.StrokeJoin.Miter : this.ck.StrokeJoin.Round);
      const [r, g, b, a] = plan.border.color;
      borderPaint.setColor(this.ck.Color(r * 255, g * 255, b * 255, a * plan.border.lit));
      let pathEffect: ReturnType<CanvasKit['PathEffect']['MakeDash']> | null = null;
      if (plan.border.dash > 0) {
        const irr = plan.border.dashIrregularity ?? 0;
        const intervals = buildDashIntervals(plan.border.dash, irr);
        pathEffect = this.ck.PathEffect.MakeDash(intervals, irr * 7.3);
        borderPaint.setPathEffect(pathEffect);
      }
      canvas.drawPath(cardPath, borderPaint);
      pathEffect?.delete();
      borderPaint.delete();
    }
    cardPath.delete();
  }

  private bgLayout() {
    if (!this.bgImage) {
      return { dx: 0, dy: 0, dw: this.width, dh: this.height, iw: 1, ih: 1 };
    }
    const iw = this.bgImage.width();
    const ih = this.bgImage.height();
    const cover = Math.max(this.width / iw, this.height / ih);
    const zoom = Math.max(0.25, Math.min(3, this.config.bgZoom || 1));
    const scale = cover * zoom;
    const dw = iw * scale;
    const dh = ih * scale;
    const [px, py] = this.bgPan;
    const dx = (this.width - dw) / 2 + px;
    const dy = (this.height - dh) / 2 + py;
    return { dx, dy, dw, dh, iw, ih };
  }

  private makeBgShader() {
    if (!this.bgImage) return null;
    // Identite : le shader SkSL convertit scene → pixels via uBgOffset/uBgScale.
    // Plus fiable qu'une matrix locale sur un child de RuntimeEffect.
    return this.bgImage.makeShaderOptions(
      this.ck.TileMode.Clamp,
      this.ck.TileMode.Clamp,
      this.ck.FilterMode.Linear,
      this.ck.MipmapMode.None,
    );
  }

  private getEffect(source: string): RuntimeEffect | null {
    if (this.effectCache && this.effectCache.source === source) {
      return this.effectCache.effect;
    }
    if (this.effectCache) {
      this.effectCache.effect.delete();
      this.effectCache = null;
    }
    const effect = this.ck.RuntimeEffect.Make(source);
    if (!effect) {
      console.error('[Stage] echec compilation SkSL');
      return null;
    }
    this.effectCache = { source, effect };
    return effect;
  }

  private drawLabel(canvas: Canvas, text: string, x: number, y: number) {
    const paint = new this.ck.Paint();
    paint.setColor(this.ck.Color(240, 228, 194, 0.85));
    const font = new this.ck.Font(null, 14);
    canvas.drawText(text, x, y, paint, font);
    paint.delete();
    font.delete();
  }

  private measureLine(font: import('canvaskit-wasm').Font, text: string): number {
    if (!text) return 0;
    try {
      const ids = font.getGlyphIDs(text);
      const widths = font.getGlyphWidths(ids);
      let w = 0;
      for (let i = 0; i < widths.length; i += 1) w += widths[i] ?? 0;
      return w;
    } catch {
      return text.length * font.getSize() * 0.55;
    }
  }

  private wrapLines(
    text: string,
    font: import('canvaskit-wasm').Font,
    maxWidth: number,
  ): string[] {
    const raw = text.replace(/\r/g, '').split('\n');
    const lines: string[] = [];
    for (const paragraph of raw) {
      if (!paragraph.trim()) {
        lines.push('');
        continue;
      }
      const words = paragraph.split(/\s+/);
      let current = '';
      for (const word of words) {
        const trial = current ? `${current} ${word}` : word;
        const width = this.measureLine(font, trial);
        if (width <= maxWidth || !current) {
          current = trial;
        } else {
          lines.push(current);
          current = word;
        }
      }
      if (current) lines.push(current);
    }
    return lines;
  }

  private drawCardText(canvas: Canvas, card: LabCard, rect: Rect, params?: Params) {
    try {
      const c = this.resolvedCard(card);
      if (!c.showText) return;
      const padX = 18;
      const padY = 16;
      const maxW = Math.max(40, rect.width - padX * 2);
      let cursorY = rect.y + padY;
      const p = params ?? c.params ?? this.config.params;
      const corner: CardCorner = {
        type: typeof p.matiere?.typeCoin === 'number' ? p.matiere.typeCoin : 0,
        radius: typeof p.matiere?.rayon === 'number' ? p.matiere.rayon : 28,
        chamfer: typeof p.matiere?.coupeCoin === 'number' ? p.matiere.coupeCoin : 24,
      };

      canvas.save();
      const clipPath = makeCardPath(this.ck, rect, corner);
      canvas.clipPath(clipPath, this.ck.ClipOp.Intersect, true);
      clipPath.delete();

      if (c.eyebrow?.trim()) {
        const paint = new this.ck.Paint();
        paint.setAntiAlias(true);
        paint.setColor(this.ck.Color(148, 210, 255, 0.9));
        const font = new this.ck.Font(null, 9);
        cursorY += 10;
        canvas.drawText(c.eyebrow.trim().toUpperCase(), rect.x + padX, cursorY, paint, font);
        paint.delete();
        font.delete();
        cursorY += 10;
      }

      if (c.title?.trim()) {
        const paint = new this.ck.Paint();
        paint.setAntiAlias(true);
        paint.setColor(this.ck.Color(240, 220, 160, 0.92));
        const font = new this.ck.Font(null, 12);
        const lines = this.wrapLines(c.title.trim(), font, maxW);
        for (const line of lines.slice(0, 2)) {
          cursorY += 15;
          if (cursorY > rect.y + rect.height - 8) break;
          canvas.drawText(line, rect.x + padX, cursorY, paint, font);
        }
        paint.delete();
        font.delete();
        cursorY += 6;
      }

      if (c.body?.trim()) {
        const paint = new this.ck.Paint();
        paint.setAntiAlias(true);
        paint.setColor(this.ck.Color(240, 228, 194, 0.55));
        const font = new this.ck.Font(null, 10);
        const lines = this.wrapLines(c.body.trim(), font, maxW);
        for (const line of lines) {
          cursorY += 13;
          if (cursorY > rect.y + rect.height - 8) break;
          canvas.drawText(line, rect.x + padX, cursorY, paint, font);
        }
        paint.delete();
        font.delete();
      }

      canvas.restore();
    } catch (err) {
      console.warn('[Stage] texte carte', err);
    }
  }

  private drawSplitHandle(canvas: Canvas, x: number) {
    const line = new this.ck.Paint();
    line.setColor(this.ck.Color(255, 255, 255, 0.85));
    line.setStrokeWidth(2);
    line.setAntiAlias(true);
    canvas.drawLine(x, 0, x, this.height, line);
    line.delete();

    const knob = new this.ck.Paint();
    knob.setColor(this.ck.Color(255, 255, 255, 0.95));
    canvas.drawCircle(x, this.height / 2, 10, knob);
    knob.delete();
  }

  private bindPointer() {
    this.canvasEl.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.canvasEl.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private unbindPointer() {
    this.canvasEl.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.canvasEl.removeEventListener('wheel', this.onWheel);
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const current = this.config.bgZoom || 1;
    const next = Math.max(0.25, Math.min(3, current * (e.deltaY > 0 ? 0.94 : 1.06)));
    this.callbacks.onBgZoom?.(Number(next.toFixed(3)));
  };

  private hitTestCard(x: number, y: number): LabCard | null {
    const cards = this.config.cards || [];
    // Du dessus vers le dessous (derniere carte = devant).
    for (let i = cards.length - 1; i >= 0; i -= 1) {
      const card = this.resolvedCard(cards[i]!);
      const rect = this.rectForCard(card);
      const matrix = this.matrixForCard(card, rect);
      const handle = this.handleCenter(rect, matrix);
      const onHandle =
        (x - handle.x) ** 2 + (y - handle.y) ** 2 <= (Stage.HANDLE_R + 6) ** 2;
      const quad = projectRectCorners(matrix, rect);
      const onCard =
        pointInQuad({ x, y }, quad) || pointInQuadBounds({ x, y }, quad, 16);
      if (onHandle || onCard) return card;
    }
    return null;
  }

  private onPointerDown = (e: PointerEvent) => {
    const { x, y } = this.local(e);
    if (this.config.compareMode === 'beforeAfter') {
      const splitX = this.width * this.config.split;
      if (Math.abs(x - splitX) < 14) {
        this.splitDragging = true;
        this.canvasEl.setPointerCapture(e.pointerId);
        return;
      }
    }
    if (this.config.draggingReflect) {
      this.pointerDown = true;
      this.emitReflect(x, y);
      this.canvasEl.setPointerCapture(e.pointerId);
      return;
    }

    if (this.config.draggingBackground) {
      const [px, py] = this.bgPan;
      this.bgDragging = true;
      this.bgDragOrigin = { x, y, px, py };
      this.canvasEl.style.cursor = 'grabbing';
      this.canvasEl.setPointerCapture(e.pointerId);
      return;
    }

    if (this.config.compareMode === 'single' || !this.config.paramsB) {
      const hit = this.hitTestCard(x, y);
      if (hit) {
        this.callbacks.onActiveCard?.(hit.id);
        this.cardDragging = true;
        this.cardDragOrigin = {
          id: hit.id,
          x,
          y,
          ox: hit.offsetX,
          oy: hit.offsetY,
        };
        this.liveOffsets.set(hit.id, { offsetX: hit.offsetX, offsetY: hit.offsetY });
        this.canvasEl.style.cursor = 'grabbing';
        this.canvasEl.setPointerCapture(e.pointerId);
      }
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    const { x, y } = this.local(e);
    if (this.splitDragging) {
      const ratio = Math.max(0.05, Math.min(0.95, x / this.width));
      this.callbacks.onSplitDrag?.(ratio);
      return;
    }
    if (this.pointerDown && this.config.draggingReflect) {
      this.emitReflect(x, y);
      return;
    }
    if (this.bgDragging && this.bgDragOrigin) {
      this.bgPan = [
        this.bgDragOrigin.px + (x - this.bgDragOrigin.x),
        this.bgDragOrigin.py + (y - this.bgDragOrigin.y),
      ];
      return;
    }
    if (this.cardDragging && this.cardDragOrigin) {
      const dx = x - this.cardDragOrigin.x;
      const dy = y - this.cardDragOrigin.y;
      this.liveOffsets.set(this.cardDragOrigin.id, {
        offsetX: this.cardDragOrigin.ox + dx,
        offsetY: this.cardDragOrigin.oy + dy,
      });
      return;
    }

    if (this.config.draggingBackground) {
      this.canvasEl.style.cursor = 'grab';
      return;
    }

    if (
      !this.config.draggingReflect &&
      (this.config.compareMode === 'single' || !this.config.paramsB)
    ) {
      this.canvasEl.style.cursor = this.hitTestCard(x, y) ? 'grab' : 'default';
    }
  };

  private onPointerUp = () => {
    if (this.cardDragging && this.cardDragOrigin) {
      const live = this.liveOffsets.get(this.cardDragOrigin.id);
      if (live) {
        this.callbacks.onCardOffset?.(this.cardDragOrigin.id, live);
      }
      this.liveOffsets.delete(this.cardDragOrigin.id);
    }
    if (this.bgDragging) {
      this.callbacks.onBgPan?.(this.bgPan);
    }
    this.pointerDown = false;
    this.splitDragging = false;
    this.cardDragging = false;
    this.cardDragOrigin = null;
    this.bgDragging = false;
    this.bgDragOrigin = null;
    this.canvasEl.style.cursor = this.config.draggingBackground ? 'grab' : 'default';
  };

  private emitReflect(x: number, y: number) {
    const rect = this.activeCardRect();
    const u = (x - rect.x) / rect.width;
    const v = (y - rect.y) / rect.height;
    this.callbacks.onReflectDrag?.([
      Math.max(0, Math.min(1, u)),
      Math.max(0, Math.min(1, v)),
    ]);
  }

  private local(e: PointerEvent) {
    const bounds = this.canvasEl.getBoundingClientRect();
    return { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
  }
}
