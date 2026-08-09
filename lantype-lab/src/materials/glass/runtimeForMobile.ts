/**
 * Runtime verre exportable vers mobile — zero dependance React/DOM.
 * Source unique : meme SkSL + meme mapping de presets que le labo.
 */
import { hexToRgb, hexToRgba } from '../../lib/color';
import { buildGlassShader, samplesForQuality } from './shader';

const DEG = Math.PI / 180;

export { buildGlassShader, samplesForQuality };

export type GlassParams = Record<string, Record<string, unknown>>;

function num(params: GlassParams, group: string, key: string, fallback = 0): number {
  const value = params[group]?.[key];
  return typeof value === 'number' ? value : fallback;
}

function bool(params: GlassParams, group: string, key: string, fallback = false): boolean {
  const value = params[group]?.[key];
  return typeof value === 'boolean' ? value : fallback;
}

function str(params: GlassParams, group: string, key: string, fallback = '#000000'): string {
  const value = params[group]?.[key];
  return typeof value === 'string' ? value : fallback;
}

function point(
  params: GlassParams,
  group: string,
  key: string,
  fallback: [number, number] = [0.5, 0.5],
): [number, number] {
  const value = params[group]?.[key];
  return Array.isArray(value) ? (value as [number, number]) : fallback;
}

export type MobileGlassContext = {
  /** Taille locale de la carte (Canvas). */
  width: number;
  height: number;
  time?: number;
  /** Teinte d'ambiance optionnelle (labo eclairage). */
  ambient?: { color: [number, number, number]; intensity: number };
};

export type MobileGlassPlan = {
  shaderSource: string;
  uniforms: Record<string, number | number[]>;
  radius: number;
  cornerType: number;
  chamfer: number;
  outerShadow: {
    color: string;
    blur: number;
    dx: number;
    dy: number;
  };
  border: {
    color: string;
    width: number;
  };
};

/**
 * Construit le plan de rendu a partir d'un preset labo.
 * Les uniforms uBgOffset / uBgScale doivent etre completes cote app
 * (position de la carte dans le fond).
 */
export function planFromPreset(
  params: GlassParams,
  ctx: MobileGlassContext,
): MobileGlassPlan {
  const animOn = bool(params, 'animation', 'active');
  const speed = num(params, 'animation', 'vitesse', 0.6);
  const amp = num(params, 'animation', 'amplitude', 1);
  const time = ctx.time ?? 0;
  const t = animOn ? time * speed : 0;

  const reflDrift = animOn
    ? Math.sin(t * 0.8) * num(params, 'animation', 'derivReflet') * 0.35 * amp
    : 0;
  const caDrift = animOn
    ? 1 + Math.sin(t * 1.6) * num(params, 'animation', 'derivAberration') * amp
    : 1;
  const caDynamic = 1 + num(params, 'aberration', 'dynamique') * Math.sin(time * 1.4) * 0.8;
  const [reflX, reflY] = point(params, 'reflets', 'position', [0.35, 0.12]);

  const ambient = ctx.ambient ?? { color: [1, 1, 1] as [number, number, number], intensity: 0 };
  const radius = num(params, 'matiere', 'rayon', 28);

  const uniforms: Record<string, number | number[]> = {
    // Dessin local : coord = (0..w, 0..h) dans le Canvas de la carte.
    uOrigin: [0, 0],
    uSize: [ctx.width, ctx.height],
    uRadius: radius,
    uCornerType: num(params, 'matiere', 'typeCoin', 0),
    uChamfer: num(params, 'matiere', 'coupeCoin', 24),
    uTime: time,
    uLayer: 0,
    // Completes par l'app (cover du fond + position carte).
    uBgOffset: [0, 0],
    uBgScale: [1, 1],

    uTintStrength: num(params, 'matiere', 'opaciteVerre'),
    uTintColor: hexToRgb(str(params, 'matiere', 'couleur', '#0a0602')),
    uAlpha: num(params, 'matiere', 'transparence', 0.92),
    uThickness: num(params, 'matiere', 'epaisseur'),
    uEdgeStraight: num(params, 'matiere', 'droitureTranche', 0.15),
    uEdgeIrregular: num(params, 'matiere', 'irregulariteTranche'),
    uNoiseAmount: num(params, 'matiere', 'bruit'),
    uNoiseScale: num(params, 'matiere', 'bruitEchelle', 180),
    uRoughness: num(params, 'matiere', 'rugosite'),
    uTexture: num(params, 'matiere', 'texture'),

    uBlurRadius: num(params, 'depoli', 'rayon'),
    uBlurStrength: num(params, 'depoli', 'intensite', 1),
    uLightDiffusion: num(params, 'depoli', 'diffusion', 0.45),

    uRefrStrength: num(params, 'refraction', 'intensite'),
    uRefrWidth: num(params, 'refraction', 'largeur', 46),
    uRefrEdgeOnly: bool(params, 'refraction', 'bordsSeuls', true) ? 1 : 0,
    uRefrSoftness: num(params, 'refraction', 'douceur'),
    uRefrType: num(params, 'refraction', 'type'),

    uCaEnabled: bool(params, 'aberration', 'active', true) ? 1 : 0,
    uCaStrength: num(params, 'aberration', 'intensite', 1) * caDrift * caDynamic,
    uCaWidth: num(params, 'aberration', 'largeur', 34),
    uCaEdgeOnly: bool(params, 'aberration', 'bordsSeuls', true) ? 1 : 0,
    uCaSeparation: num(params, 'aberration', 'separation', 4.5),
    uCaAngle: num(params, 'aberration', 'orientation') * DEG,
    uCaOpacity: num(params, 'aberration', 'opacite', 0.85),

    uReflIntensity: num(params, 'reflets', 'intensite'),
    uReflWidth: num(params, 'reflets', 'largeur', 0.18),
    uReflPos: [reflX + reflDrift, reflY],
    uReflAngle: num(params, 'reflets', 'angle', 90) * DEG,
    uReflHardness: num(params, 'reflets', 'durete'),
    uReflColor: hexToRgb(str(params, 'reflets', 'couleur', '#ffe6a8')),
    uReflOpacity: num(params, 'reflets', 'opacite', 0.6),

    uLightIntensity: num(params, 'lumiere', 'intensite', 0.7),
    uLightColor: hexToRgb(str(params, 'lumiere', 'couleur', '#ffc266')),
    uLightTemp: num(params, 'lumiere', 'temperature', 0.62),
    uHalo: num(params, 'lumiere', 'halo'),
    uHaloType: num(params, 'lumiere', 'haloType', 0),
    uHaloAngle: num(params, 'lumiere', 'haloDirection', 225) * DEG,
    uHaloParticles: num(params, 'lumiere', 'haloParticules', 0.55),
    uInnerLight: num(params, 'lumiere', 'lumiereInterne'),
    uOuterLight: num(params, 'lumiere', 'lumiereExterne'),
    uOuterLightAngle: num(params, 'lumiere', 'directionExterne', 225) * DEG,
    uOuterLightSpread: num(params, 'lumiere', 'ouvertureExterne', 1),
    uLightInteraction: num(params, 'lumiere', 'interaction'),
    uAmbientColor: ambient.color,
    uAmbientIntensity: ambient.intensity,

    uInnerShadowOpacity: num(params, 'ombres', 'interneOpacite'),
    uInnerShadowBlur: num(params, 'ombres', 'interneFlou', 18),
    uInnerShadowDistance: num(params, 'ombres', 'interneDistance'),
    uInnerShadowAngle: num(params, 'ombres', 'interneDirection', 270) * DEG,

    uEdgeLight: num(params, 'contours', 'lumiereBord'),
    uEdgeLightWidth: num(params, 'contours', 'lumiereBordLargeur', 6),
    uEdgeSpecular: num(params, 'contours', 'areteIntensite', 0.55),
    uEdgeSpecularAngle: num(params, 'contours', 'areteDirection', 225) * DEG,
    uEdgeSpecularWidth: num(params, 'contours', 'areteLargeur', 3.5),
  };

  const shadowAngle = num(params, 'ombres', 'externeDirection', 90) * DEG;
  const shadowDist = num(params, 'ombres', 'externeDistance', 14);
  const [sr, sg, sb, sa] = hexToRgba(
    str(params, 'ombres', 'externeCouleur', '#000000'),
    num(params, 'ombres', 'externeOpacite', 0.45),
  );
  const [br, bg, bb, ba] = hexToRgba(
    str(params, 'contours', 'couleur', '#f0dcaa'),
    num(params, 'contours', 'opacite', 0.35) * num(params, 'contours', 'portionEclairee', 1),
  );

  return {
    shaderSource: buildGlassShader(samplesForQuality(num(params, 'depoli', 'qualite', 2))),
    uniforms,
    radius,
    cornerType: num(params, 'matiere', 'typeCoin', 0),
    chamfer: num(params, 'matiere', 'coupeCoin', 24),
    outerShadow: {
      color: `rgba(${Math.round(sr * 255)},${Math.round(sg * 255)},${Math.round(sb * 255)},${sa})`,
      blur: num(params, 'ombres', 'externeFlou', 26),
      dx: Math.cos(shadowAngle) * shadowDist,
      dy: Math.sin(shadowAngle) * shadowDist,
    },
    border: {
      color: `rgba(${Math.round(br * 255)},${Math.round(bg * 255)},${Math.round(bb * 255)},${ba})`,
      width: num(params, 'contours', 'epaisseur', 1),
    },
  };
}

/**
 * Calcule uBgOffset / uBgScale pour un fond "cover" (meme formule que le labo).
 *
 * @param cardWin position fenetre du coin haut-gauche de la carte
 * @param bgOrigin position fenetre du conteneur fond
 * @param bgSize taille layout du conteneur fond
 * @param imageSize taille native de l'image de fond
 */
export function backgroundUniforms(
  cardWin: { x: number; y: number },
  bgOrigin: { x: number; y: number },
  bgSize: { w: number; h: number },
  imageSize: { w: number; h: number },
): { uBgOffset: [number, number]; uBgScale: [number, number] } {
  const iw = Math.max(1, imageSize.w);
  const ih = Math.max(1, imageSize.h);
  const bgW = Math.max(1, bgSize.w);
  const bgH = Math.max(1, bgSize.h);
  const scale = Math.max(bgW / iw, bgH / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (bgW - dw) / 2;
  const dy = (bgH - dh) / 2;
  const coverWinX = bgOrigin.x + dx;
  const coverWinY = bgOrigin.y + dy;
  return {
    uBgOffset: [coverWinX - cardWin.x, coverWinY - cardWin.y],
    uBgScale: [iw / dw, ih / dh],
  };
}
