/** Module materiau "verre" — premier materiau de LANTYP. */
import { hexToRgb, hexToRgba } from '../../lib/color';
import type { FrameContext, MaterialModule, Params, RenderPlan } from '../types';
import { bool, num, point, str } from '../types';
import { GLASS_GROUPS, GLASS_LAYERS } from './schema';
import { buildGlassShader, samplesForQuality } from './shader';

const DEG = Math.PI / 180;

/** Le shader n'est regenere que si le nombre d'echantillons change. */
let cachedSamples = -1;
let cachedSource = '';

function shaderFor(quality: number): string {
  const samples = samplesForQuality(quality);
  if (samples !== cachedSamples) {
    cachedSamples = samples;
    cachedSource = buildGlassShader(samples);
  }
  return cachedSource;
}

export const glassMaterial: MaterialModule = {
  id: 'glass',
  label: 'Verre',
  summary: 'Verre depoli, refraction de bord, aberration chromatique et reflets.',
  groups: GLASS_GROUPS,
  layers: GLASS_LAYERS,

  plan(params: Params, ctx: FrameContext): RenderPlan {
    const animOn = bool(params, 'animation', 'active');
    const speed = num(params, 'animation', 'vitesse', 0.6);
    const amp = num(params, 'animation', 'amplitude', 1);
    const t = animOn ? ctx.time * speed : 0;

    // ── Animation de la carte ────────────────────────────────────────────────
    const levitation = animOn ? Math.sin(t * 1.2) * num(params, 'animation', 'levitation') * amp : 0;
    const oscillation = animOn
      ? Math.sin(t * 0.7 + 1.3) * num(params, 'animation', 'oscillation') * amp
      : 0;
    const breath = animOn
      ? 1 + Math.sin(t * 0.9) * num(params, 'animation', 'respiration') * amp
      : 1;

    const baseW = ctx.card.width * breath;
    const baseH = ctx.card.height * breath;
    const rect = {
      x: ctx.card.x + (ctx.card.width - baseW) / 2 + oscillation,
      y: ctx.card.y + (ctx.card.height - baseH) / 2 + levitation,
      width: baseW,
      height: baseH,
    };

    // ── Derives automatiques ─────────────────────────────────────────────────
    const reflDrift = animOn ? Math.sin(t * 0.8) * num(params, 'animation', 'derivReflet') * 0.35 : 0;
    const caDrift = animOn
      ? 1 + Math.sin(t * 1.6) * num(params, 'animation', 'derivAberration')
      : 1;
    const caDynamic = 1 + num(params, 'aberration', 'dynamique') * Math.sin(ctx.time * 1.4) * 0.8;

    const [reflX, reflY] = point(params, 'reflets', 'position', [0.35, 0.12]);

    const uniforms: Record<string, number | number[]> = {
      uOrigin: [rect.x, rect.y],
      uSize: [rect.width, rect.height],
      uRadius: num(params, 'matiere', 'rayon', 28),
      uCornerType: num(params, 'matiere', 'typeCoin', 0),
      uChamfer: num(params, 'matiere', 'coupeCoin', 24),
      uTime: ctx.time,
      uLayer: ctx.layerCode,

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
      uAmbientColor: ctx.ambient.color,
      uAmbientIntensity: ctx.ambient.intensity,

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
    const haloAmount = num(params, 'lumiere', 'halo');
    const haloType = num(params, 'lumiere', 'haloType', 0);
    const haloAngle = num(params, 'lumiere', 'haloDirection', 225) * DEG;
    const haloParticles = num(params, 'lumiere', 'haloParticules', 0.55);
    const haloPush = haloAmount * (haloType > 0.5 ? 12 : 18);

    return {
      shaderSource: shaderFor(num(params, 'depoli', 'qualite', 2)),
      uniforms,
      radius: num(params, 'matiere', 'rayon', 28),
      cornerType: num(params, 'matiere', 'typeCoin', 0),
      chamfer: num(params, 'matiere', 'coupeCoin', 24),
      rect,
      outerShadow: {
        color: hexToRgba(
          str(params, 'ombres', 'externeCouleur', '#000000'),
          num(params, 'ombres', 'externeOpacite', 0.45),
        ),
        blur: num(params, 'ombres', 'externeFlou', 26),
        dx: Math.cos(shadowAngle) * shadowDist,
        dy: Math.sin(shadowAngle) * shadowDist,
      },
      glow:
        haloAmount > 0.001
          ? {
              color: hexToRgba(
                str(params, 'lumiere', 'couleur', '#ffc266'),
                haloAmount *
                  num(params, 'lumiere', 'intensite', 0.7) *
                  (haloType > 0.5 ? 0.32 : 0.5),
              ),
              blur: 20 + haloAmount * (haloType > 0.5 ? 55 : 90),
              spread: haloAmount * (haloType > 0.5 ? 18 : 26),
              dx: Math.cos(haloAngle) * haloPush,
              dy: Math.sin(haloAngle) * haloPush,
              type: haloType,
              particles: haloParticles,
              angle: haloAngle,
            }
          : undefined,
      border: {
        color: hexToRgba(
          str(params, 'contours', 'couleur', '#f0dcaa'),
          num(params, 'contours', 'opacite', 0.35),
        ),
        width: num(params, 'contours', 'epaisseur', 1),
        dash: num(params, 'contours', 'tirets'),
        dashIrregularity: num(params, 'contours', 'irregularite'),
        lit: num(params, 'contours', 'portionEclairee', 1),
      },
    };
  },
};
