/**
 * Shader verre LANTYP — SkSL entierement pilote par uniforms.
 *
 * Une seule constante est injectee a la generation : le nombre d'echantillons
 * du flou. SkSL exige que les bornes de boucle soient des constantes de
 * compilation, donc seul le curseur "qualite" regenere la source. Tous les
 * autres reglages sont des uniforms, donc instantanes.
 *
 * Aucun `int` en uniform : CanvasKit transmet un Float32Array, les comparaisons
 * se font donc sur des floats.
 */

export const BLUR_QUALITY = [
  { value: 0, label: 'Brouillon', samples: 8 },
  { value: 1, label: 'Correct', samples: 16 },
  { value: 2, label: 'Bon', samples: 32 },
  { value: 3, label: 'Eleve', samples: 64 },
  { value: 4, label: 'Maximum', samples: 128 },
] as const;

export function samplesForQuality(quality: number): number {
  const found = BLUR_QUALITY.find((q) => q.value === Math.round(quality));
  return found ? found.samples : 32;
}

/** Codes de couche pour le mode Inspect (doivent suivre glass/schema.ts). */
export const LAYER = {
  final: 0,
  blur: 1,
  refraction: 2,
  aberration: 3,
  reflection: 4,
  noise: 5,
  innerShadow: 6,
  light: 7,
  edge: 8,
  matter: 9,
} as const;

export function buildGlassShader(samples: number): string {
  return /* glsl */ `
uniform shader bg;

uniform float2 uOrigin;
uniform float2 uSize;
uniform float  uRadius;
/** 0 = arrondi, 1 = coupe droite. */
uniform float  uCornerType;
/** Taille du chanfrein (px). */
uniform float  uChamfer;
uniform float  uTime;
uniform float  uLayer;
/** Coin haut-gauche du fond "cover" dans l'espace scene. */
uniform float2 uBgOffset;
/** scene → pixels image : (iw/dw, ih/dh). */
uniform float2 uBgScale;

// Matiere
uniform float  uTintStrength;
uniform float3 uTintColor;
uniform float  uAlpha;
uniform float  uThickness;
/** 0 = tranche douce, 1 = coupe laser. */
uniform float  uEdgeStraight;
/** Micro-defauts le long de la tranche. */
uniform float  uEdgeIrregular;
uniform float  uNoiseAmount;
uniform float  uNoiseScale;
uniform float  uRoughness;
uniform float  uTexture;

// Depoli
uniform float  uBlurRadius;
uniform float  uBlurStrength;
uniform float  uLightDiffusion;

// Refraction
uniform float  uRefrStrength;
uniform float  uRefrWidth;
uniform float  uRefrEdgeOnly;
uniform float  uRefrSoftness;
uniform float  uRefrType;

// Aberration chromatique
uniform float  uCaEnabled;
uniform float  uCaStrength;
uniform float  uCaWidth;
uniform float  uCaEdgeOnly;
uniform float  uCaSeparation;
uniform float  uCaAngle;
uniform float  uCaOpacity;

// Reflets
uniform float  uReflIntensity;
uniform float  uReflWidth;
uniform float2 uReflPos;
uniform float  uReflAngle;
uniform float  uReflHardness;
uniform float3 uReflColor;
uniform float  uReflOpacity;

// Lumiere
uniform float  uLightIntensity;
uniform float3 uLightColor;
uniform float  uLightTemp;
uniform float  uHalo;
/** 0 = doux, 1 = particules. */
uniform float  uHaloType;
uniform float  uHaloAngle;
uniform float  uHaloParticles;
uniform float  uInnerLight;
uniform float  uOuterLight;
/** Direction de la source externe (radians). */
uniform float  uOuterLightAngle;
/** 1 = tout le pourtour, 0 = un seul bord. */
uniform float  uOuterLightSpread;
uniform float  uLightInteraction;
uniform float3 uAmbientColor;
uniform float  uAmbientIntensity;

// Ombre interne
uniform float  uInnerShadowOpacity;
uniform float  uInnerShadowBlur;
uniform float  uInnerShadowDistance;
uniform float  uInnerShadowAngle;

// Contour lumineux (dans le shader ; le trait net est dessine par Skia)
uniform float  uEdgeLight;
uniform float  uEdgeLightWidth;
/** Speculaire sur l arete du verre. */
uniform float  uEdgeSpecular;
uniform float  uEdgeSpecularAngle;
uniform float  uEdgeSpecularWidth;

const int SAMPLES = ${samples};
const float TAU = 6.28318530718;
const float GOLDEN = 2.39996322973;

float hash21(float2 p) {
  p = fract(p * float2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + float2(1.0, 0.0));
  float c = hash21(i + float2(0.0, 1.0));
  float d = hash21(i + float2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(float2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    v += valueNoise(p) * amp;
    p *= 2.03;
    amp *= 0.5;
  }
  return v;
}

/** Distance signee a un rectangle arrondi : negative a l'interieur. */
float sdRoundBox(float2 p, float2 b, float r) {
  float2 q = abs(p) - b + float2(r);
  return min(max(q.x, q.y), 0.0) + length(max(q, float2(0.0))) - r;
}

/** Rectangle a coins coupes (chanfrein / coupe laser). */
float sdChamferBox(float2 p, float2 b, float c) {
  float cut = max(c, 0.0);
  float2 r = abs(p);
  float2 q = r - b;
  float dBox = min(max(q.x, q.y), 0.0) + length(max(q, float2(0.0)));
  float dCut = (r.x + r.y) - (b.x + b.y - cut);
  return max(dBox, dCut);
}

float sdCard(float2 p, float2 b) {
  float d = uCornerType < 0.5
    ? sdRoundBox(p, b, uRadius)
    : sdChamferBox(p, b, uChamfer);
  if (uEdgeIrregular > 0.001) {
    float ang = atan(p.y, p.x);
    float wobble = (fbm(float2(ang * 2.8, 0.7)) - 0.5) * uEdgeIrregular * 5.5;
    d += wobble;
  }
  return d;
}

float2 sdNormal(float2 p, float2 b) {
  float e = 1.0;
  float dx = sdCard(p + float2(e, 0.0), b) - sdCard(p - float2(e, 0.0), b);
  float dy = sdCard(p + float2(0.0, e), b) - sdCard(p - float2(0.0, e), b);
  float2 g = float2(dx, dy);
  float len = length(g);
  return len > 0.00001 ? g / len : float2(0.0, -1.0);
}

/** Falloff de tranche : doux → laser selon droiture. */
float edgeFalloff(float distIn, float width) {
  float w = max(width, 0.35);
  float soft = 1.0 - smoothstep(0.0, w, distIn);
  float hardW = mix(w, max(w * 0.22, 0.6), uEdgeStraight);
  float hard = 1.0 - smoothstep(0.0, hardW, distIn);
  hard = pow(hard, mix(1.0, 3.8, uEdgeStraight));
  return mix(soft, hard, uEdgeStraight);
}

float2 toImage(float2 scene) {
  return (scene - uBgOffset) * uBgScale;
}

half4 sampleBg(float2 scene) {
  return bg.eval(toImage(scene));
}

/**
 * Flou en spirale d'or : repartition reguliere sans motif en grille, ce qui
 * evite les "carreaux" d'un noyau carre a faible densite.
 */
half4 blurBg(float2 c, float radius) {
  if (radius < 0.35) { return sampleBg(c); }
  half4 acc = half4(0.0);
  float total = 0.0;
  float sigma = radius * (0.38 + 0.62 * uLightDiffusion);
  for (int i = 0; i < SAMPLES; i++) {
    float fi = float(i) + 0.5;
    float a = fi * GOLDEN;
    float r = sqrt(fi / float(SAMPLES)) * radius;
    float w = exp(-(r * r) / (2.0 * sigma * sigma + 0.0001));
    acc += sampleBg(c + float2(cos(a), sin(a)) * r) * w;
    total += w;
  }
  return acc / max(total, 0.0001);
}

half3 blurBgCA(float2 c, float radius, float2 sep) {
  half3 acc = half3(0.0);
  float total = 0.0;
  float sigma = radius * (0.38 + 0.62 * uLightDiffusion);
  for (int i = 0; i < SAMPLES; i++) {
    float fi = float(i) + 0.5;
    float a = fi * GOLDEN;
    float r = sqrt(fi / float(SAMPLES)) * radius;
    float w = exp(-(r * r) / (2.0 * sigma * sigma + 0.0001));
    float2 off = float2(cos(a), sin(a)) * r;
    acc.r += sampleBg(c + off + sep).r * w;
    acc.g += sampleBg(c + off).g * w;
    acc.b += sampleBg(c + off - sep).b * w;
    total += w;
  }
  return acc / max(total, 0.0001);
}

half4 main(float2 coord) {
  float2 half_ = uSize * 0.5;
  float2 center = uOrigin + half_;
  float2 p = coord - center;
  float2 uv = (coord - uOrigin) / uSize;

  float d = sdCard(p, half_);
  float distIn = max(-d, 0.0);
  float2 n = sdNormal(p, half_);

  // ── Masques de bord ───────────────────────────────────────────────────────
  float refrEdge = edgeFalloff(distIn, max(uRefrWidth, 0.5));
  refrEdge = pow(refrEdge, max(0.15, 1.0 - uRefrSoftness * 0.85));
  float refrMask = mix(1.0, refrEdge, uRefrEdgeOnly);

  float caEdge = edgeFalloff(distIn, max(uCaWidth, 0.5));
  float caMask = mix(1.0, caEdge, uCaEdgeOnly);

  // ── Bruit et rugosite ─────────────────────────────────────────────────────
  float grain = fbm(uv * max(uNoiseScale, 1.0) + uTime * 0.05);
  float rough = (fbm(uv * 90.0 + 13.7) - 0.5) * uRoughness * 6.0;

  // ── Deformation du fond ───────────────────────────────────────────────────
  float typeMod = 1.0;
  if (uRefrType > 1.5) {
    typeMod = 0.5 + 0.5 * sin(distIn * 0.28 - uTime * 1.1);
  } else if (uRefrType > 0.5) {
    typeMod = 0.55 + 0.9 * fbm(uv * 3.2 + uTime * 0.12);
  }

  float2 refrOffset = n * uRefrStrength * refrMask * typeMod;
  float2 sampleAt = coord + refrOffset + float2(rough, rough * 0.7);

  float radius = uBlurRadius * uBlurStrength;

  // ── Echantillonnage du fond ───────────────────────────────────────────────
  half3 base;
  half3 plain = blurBg(sampleAt, radius).rgb;
  if (uCaEnabled > 0.5) {
    float2 dir = float2(cos(uCaAngle), sin(uCaAngle));
    float2 sep = dir * uCaSeparation * uCaStrength * caMask;
    half3 split = blurBgCA(sampleAt, radius, sep);
    base = mix(plain, split, uCaOpacity);
  } else {
    base = plain;
  }

  // ── Matiere ───────────────────────────────────────────────────────────────
  // uAlpha (Transparence) = quantite de fond floute visible (1 = voir le decor).
  // uTintStrength (Opacite verre) = voile de teinte par-dessus.
  half3 color = mix(half3(uTintColor), base, clamp(uAlpha, 0.0, 1.0));
  color = mix(color, half3(uTintColor), uTintStrength);

  // Tranche : bande d epaisseur — droiture affine le profil (coupe laser).
  float thickW = mix(uThickness * 40.0, uThickness * 10.0 + 1.2, uEdgeStraight);
  float thickBand = edgeFalloff(distIn, thickW);
  color *= (1.0 - thickBand * uThickness * mix(0.55, 0.82, uEdgeStraight));
  // Filet de coupe sur l arete quand droiture haute.
  float cutFace = edgeFalloff(distIn, mix(6.0, 1.8, uEdgeStraight)) * uEdgeStraight;
  color += half3(0.92, 0.88, 0.78) * cutFace * uThickness * 0.35;

  float texture = (fbm(uv * 6.0 + 4.2) - 0.5) * uTexture;
  color += half3(texture);

  color = mix(color, color * half3(grain * 2.0), uNoiseAmount);

  // ── Lumiere ───────────────────────────────────────────────────────────────
  half3 warm = half3(1.0, 0.82, 0.62);
  half3 cool = half3(0.72, 0.85, 1.0);
  half3 tempTint = mix(cool, warm, uLightTemp);
  half3 lightCol = half3(uLightColor) * tempTint;

  float innerGlow = pow(1.0 - clamp(length(uv - 0.5) * 1.6, 0.0, 1.0), 2.2);
  color += lightCol * innerGlow * uInnerLight * uLightIntensity;

  float outerBand = edgeFalloff(distIn, max(uHalo * 60.0, 1.0));
  // Masque directionnel : n pointe vers l exterieur du rectangle arrondi.
  float2 outerDir = float2(cos(uOuterLightAngle), sin(uOuterLightAngle));
  float facing = dot(n, outerDir);
  float spread = clamp(uOuterLightSpread, 0.0, 1.0);
  float cutoff = mix(0.72, -1.05, spread);
  float softness = mix(0.28, 2.2, spread);
  float dirMask = smoothstep(cutoff, cutoff + softness, facing);
  dirMask = mix(dirMask, 1.0, pow(spread, 1.6));
  color += lightCol * outerBand * uOuterLight * uLightIntensity * dirMask;

  // ── Halo directionnel (doux / particules) ─────────────────────────────────
  float2 hdir = float2(cos(uHaloAngle), sin(uHaloAngle));
  float2 hperp = float2(-hdir.y, hdir.x);
  float haloFacing = max(dot(n, hdir), 0.0);
  float haloBand = edgeFalloff(distIn, max(uHalo * 52.0, 0.8));
  float haloDirMask = pow(haloFacing, 1.35);
  float softHalo = haloBand * mix(0.35, 1.0, haloDirMask) * uHalo * uLightIntensity;

  half3 haloAdd = half3(0.0);
  if (uHaloType < 0.5) {
    haloAdd = lightCol * softHalo * 0.9;
  } else {
    haloAdd = lightCol * softHalo * 0.22;
    float qty = clamp(uHaloParticles, 0.0, 1.0);
    float count = mix(5.0, 26.0, qty);
    float particleAcc = 0.0;
    for (int i = 0; i < 26; i++) {
      float fi = float(i);
      float active = 1.0 - step(count, fi);
      float seed = fi * 19.17 + 3.1;
      float drift = 0.07 + hash21(float2(seed, 1.3)) * 0.14;
      float along = fract(hash21(float2(seed, 2.7)) + uTime * drift);
      float across = (hash21(float2(seed, 4.1)) - 0.5) * 2.0;
      float depth = mix(0.55, 1.05, hash21(float2(seed, 5.9)));
      float2 ppos = hdir * (along * 2.0 - 1.0) * length(half_) * depth
                  + hperp * across * min(half_.x, half_.y) * 0.92;
      float pd = sdCard(ppos, half_);
      float inRim = 1.0 - smoothstep(0.0, max(uHalo * 48.0, 2.0), abs(pd));
      float size = mix(1.1, 3.8, hash21(float2(seed, 7.2)));
      float spark = exp(-(length(p - ppos) * length(p - ppos)) / max(size * size, 0.2));
      float twinkle = 0.55 + 0.45 * sin(uTime * (2.0 + hash21(float2(seed, 8.8)) * 5.0) + seed);
      particleAcc += spark * inRim * twinkle * active;
    }
    haloAdd += lightCol * particleAcc * uHalo * uLightIntensity * (0.35 + qty * 0.85);
  }
  color += haloAdd;

  color = mix(color, color * (half3(1.0) + lightCol * 0.6), uLightInteraction);
  color = mix(color, color * half3(uAmbientColor), uAmbientIntensity);

  // ── Reflet speculaire ─────────────────────────────────────────────────────
  float2 rp = uv - uReflPos;
  float ca = cos(uReflAngle);
  float sa = sin(uReflAngle);
  float band = rp.x * ca + rp.y * sa;
  float reflFall = 1.0 - smoothstep(0.0, max(uReflWidth, 0.001), abs(band));
  float refl = pow(reflFall, mix(1.0, 8.0, uReflHardness)) * uReflIntensity;
  color = mix(color, half3(uReflColor), refl * uReflOpacity);

  // ── Ombre interne ─────────────────────────────────────────────────────────
  float2 sdir = float2(cos(uInnerShadowAngle), sin(uInnerShadowAngle));
  float dShift = sdCard(p + sdir * uInnerShadowDistance, half_);
  float innerSh = smoothstep(-max(uInnerShadowBlur, 0.5), 0.0, dShift);
  color *= (1.0 - innerSh * uInnerShadowOpacity);

  // ── Contour lumineux ──────────────────────────────────────────────────────
  float rim = edgeFalloff(distIn, max(uEdgeLightWidth, 0.5));
  color += lightCol * rim * uEdgeLight;

  // ── Eclairage d arete (speculaire directionnel) ───────────────────────────
  float2 edgeDir = float2(cos(uEdgeSpecularAngle), sin(uEdgeSpecularAngle));
  float edgeFacing = max(dot(n, edgeDir), 0.0);
  float edgeRim = edgeFalloff(distIn, max(uEdgeSpecularWidth, 0.35));
  // Lobe large + glint serre : impression de lumiere qui frappe le chanfrein.
  float edgeHit = pow(edgeFacing, 3.2) * edgeRim;
  float edgeGlint = pow(edgeFacing, 14.0) * pow(edgeRim, 1.6);
  half3 edgeSpec = lightCol * (edgeHit * 0.85 + edgeGlint * 1.4) * uEdgeSpecular;
  color += edgeSpec;

  // ── Mode Inspect ──────────────────────────────────────────────────────────
  if (uLayer > 0.5) {
    if (uLayer < 1.5) {                      // flou seul
      return half4(plain, 1.0);
    } else if (uLayer < 2.5) {               // refraction seule
      float mag = length(refrOffset) / max(abs(uRefrStrength) + 0.001, 0.001);
      return half4(half3(mag), 1.0);
    } else if (uLayer < 3.5) {               // aberration seule
      if (uCaEnabled < 0.5) { return half4(0.0, 0.0, 0.0, 1.0); }
      float2 dir2 = float2(cos(uCaAngle), sin(uCaAngle));
      float2 sep2 = dir2 * uCaSeparation * uCaStrength * caMask;
      half3 split2 = blurBgCA(sampleAt, radius, sep2);
      half3 delta = abs(split2 - plain) * 6.0;
      return half4(delta, 1.0);
    } else if (uLayer < 4.5) {               // reflets seuls
      return half4(half3(uReflColor) * refl * uReflOpacity, 1.0);
    } else if (uLayer < 5.5) {               // bruit seul
      return half4(half3(grain), 1.0);
    } else if (uLayer < 6.5) {               // ombre interne seule
      return half4(half3(innerSh * uInnerShadowOpacity), 1.0);
    } else if (uLayer < 7.5) {               // lumiere seule
      half3 onlyLight =
        lightCol * (innerGlow * uInnerLight + outerBand * uOuterLight * dirMask) * uLightIntensity
        + haloAdd;
      return half4(onlyLight, 1.0);
    } else if (uLayer < 8.5) {               // contour seul
      return half4(lightCol * rim * uEdgeLight + edgeSpec, 1.0);
    } else {                                 // matiere seule
      return half4(half3(uTintColor) * uTintStrength, 1.0);
    }
  }

  // La plaque est OPAQUE : le "voir a travers" = fond floute echantillonne,
  // jamais l'image nette dessinee sous la carte (sinon le flou est invisible).
  return half4(clamp(color, half3(0.0), half3(4.0)), 1.0);
}
`;
}
