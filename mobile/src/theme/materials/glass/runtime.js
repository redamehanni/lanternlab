// src/lib/color.ts
function hexToRgb(hex) {
  let value = hex.trim().replace("#", "");
  if (value.length === 3) {
    value = value.split("").map((c) => c + c).join("");
  }
  const int = Number.parseInt(value, 16);
  if (Number.isNaN(int) || value.length !== 6) return [1, 1, 1];
  return [(int >> 16 & 255) / 255, (int >> 8 & 255) / 255, (int & 255) / 255];
}
function hexToRgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return [r, g, b, alpha];
}

// src/materials/glass/shader.ts
var BLUR_QUALITY = [
  { value: 0, label: "Brouillon", samples: 8 },
  { value: 1, label: "Correct", samples: 16 },
  { value: 2, label: "Bon", samples: 32 },
  { value: 3, label: "Eleve", samples: 64 },
  { value: 4, label: "Maximum", samples: 128 }
];
function samplesForQuality(quality) {
  const found = BLUR_QUALITY.find((q) => q.value === Math.round(quality));
  return found ? found.samples : 32;
}
function buildGlassShader(samples) {
  return (
    /* glsl */
    `
uniform shader bg;

uniform float2 uOrigin;
uniform float2 uSize;
uniform float  uRadius;
uniform float  uTime;
uniform float  uLayer;
/** Coin haut-gauche du fond "cover" dans l'espace scene. */
uniform float2 uBgOffset;
/** scene \u2192 pixels image : (iw/dw, ih/dh). */
uniform float2 uBgScale;

// Matiere
uniform float  uTintStrength;
uniform float3 uTintColor;
uniform float  uAlpha;
uniform float  uThickness;
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
uniform float  uInnerLight;
uniform float  uOuterLight;
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

float2 sdNormal(float2 p, float2 b, float r) {
  float e = 1.0;
  float dx = sdRoundBox(p + float2(e, 0.0), b, r) - sdRoundBox(p - float2(e, 0.0), b, r);
  float dy = sdRoundBox(p + float2(0.0, e), b, r) - sdRoundBox(p - float2(0.0, e), b, r);
  float2 g = float2(dx, dy);
  float len = length(g);
  return len > 0.00001 ? g / len : float2(0.0, -1.0);
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

  float d = sdRoundBox(p, half_, uRadius);
  float distIn = max(-d, 0.0);
  float2 n = sdNormal(p, half_, uRadius);

  // \u2500\u2500 Masques de bord \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  float refrEdge = 1.0 - smoothstep(0.0, max(uRefrWidth, 0.5), distIn);
  refrEdge = pow(refrEdge, max(0.15, 1.0 - uRefrSoftness * 0.85));
  float refrMask = mix(1.0, refrEdge, uRefrEdgeOnly);

  float caEdge = 1.0 - smoothstep(0.0, max(uCaWidth, 0.5), distIn);
  float caMask = mix(1.0, caEdge, uCaEdgeOnly);

  // \u2500\u2500 Bruit et rugosite \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  float grain = fbm(uv * max(uNoiseScale, 1.0) + uTime * 0.05);
  float rough = (fbm(uv * 90.0 + 13.7) - 0.5) * uRoughness * 6.0;

  // \u2500\u2500 Deformation du fond \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  float typeMod = 1.0;
  if (uRefrType > 1.5) {
    typeMod = 0.5 + 0.5 * sin(distIn * 0.28 - uTime * 1.1);
  } else if (uRefrType > 0.5) {
    typeMod = 0.55 + 0.9 * fbm(uv * 3.2 + uTime * 0.12);
  }

  float2 refrOffset = n * uRefrStrength * refrMask * typeMod;
  float2 sampleAt = coord + refrOffset + float2(rough, rough * 0.7);

  float radius = uBlurRadius * uBlurStrength;

  // \u2500\u2500 Echantillonnage du fond \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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

  // \u2500\u2500 Matiere \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // uAlpha (Transparence) = quantite de fond floute visible (1 = voir le decor).
  // uTintStrength (Opacite verre) = voile de teinte par-dessus.
  half3 color = mix(half3(uTintColor), base, clamp(uAlpha, 0.0, 1.0));
  color = mix(color, half3(uTintColor), uTintStrength);

  float thickBand = 1.0 - smoothstep(0.0, max(uThickness * 40.0, 0.5), distIn);
  color *= (1.0 - thickBand * uThickness * 0.55);

  float texture = (fbm(uv * 6.0 + 4.2) - 0.5) * uTexture;
  color += half3(texture);

  color = mix(color, color * half3(grain * 2.0), uNoiseAmount);

  // \u2500\u2500 Lumiere \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  half3 warm = half3(1.0, 0.82, 0.62);
  half3 cool = half3(0.72, 0.85, 1.0);
  half3 tempTint = mix(cool, warm, uLightTemp);
  half3 lightCol = half3(uLightColor) * tempTint;

  float innerGlow = pow(1.0 - clamp(length(uv - 0.5) * 1.6, 0.0, 1.0), 2.2);
  color += lightCol * innerGlow * uInnerLight * uLightIntensity;

  float outerBand = 1.0 - smoothstep(0.0, max(uHalo * 60.0, 1.0), distIn);
  color += lightCol * outerBand * uOuterLight * uLightIntensity;

  color = mix(color, color * (half3(1.0) + lightCol * 0.6), uLightInteraction);
  color = mix(color, color * half3(uAmbientColor), uAmbientIntensity);

  // \u2500\u2500 Reflet speculaire \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  float2 rp = uv - uReflPos;
  float ca = cos(uReflAngle);
  float sa = sin(uReflAngle);
  float band = rp.x * ca + rp.y * sa;
  float reflFall = 1.0 - smoothstep(0.0, max(uReflWidth, 0.001), abs(band));
  float refl = pow(reflFall, mix(1.0, 8.0, uReflHardness)) * uReflIntensity;
  color = mix(color, half3(uReflColor), refl * uReflOpacity);

  // \u2500\u2500 Ombre interne \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  float2 sdir = float2(cos(uInnerShadowAngle), sin(uInnerShadowAngle));
  float dShift = sdRoundBox(p + sdir * uInnerShadowDistance, half_, uRadius);
  float innerSh = smoothstep(-max(uInnerShadowBlur, 0.5), 0.0, dShift);
  color *= (1.0 - innerSh * uInnerShadowOpacity);

  // \u2500\u2500 Contour lumineux \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  float rim = 1.0 - smoothstep(0.0, max(uEdgeLightWidth, 0.5), distIn);
  color += lightCol * rim * uEdgeLight;

  // \u2500\u2500 Mode Inspect \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
      half3 onlyLight = lightCol * (innerGlow * uInnerLight + outerBand * uOuterLight) * uLightIntensity;
      return half4(onlyLight, 1.0);
    } else if (uLayer < 8.5) {               // contour seul
      return half4(lightCol * rim * uEdgeLight, 1.0);
    } else {                                 // matiere seule
      return half4(half3(uTintColor) * uTintStrength, 1.0);
    }
  }

  // La plaque est OPAQUE : le "voir a travers" = fond floute echantillonne,
  // jamais l'image nette dessinee sous la carte (sinon le flou est invisible).
  return half4(clamp(color, half3(0.0), half3(4.0)), 1.0);
}
`
  );
}

// src/materials/glass/runtimeForMobile.ts
var DEG = Math.PI / 180;
function num(params, group, key, fallback = 0) {
  var _a;
  const value = (_a = params[group]) == null ? void 0 : _a[key];
  return typeof value === "number" ? value : fallback;
}
function bool(params, group, key, fallback = false) {
  var _a;
  const value = (_a = params[group]) == null ? void 0 : _a[key];
  return typeof value === "boolean" ? value : fallback;
}
function str(params, group, key, fallback = "#000000") {
  var _a;
  const value = (_a = params[group]) == null ? void 0 : _a[key];
  return typeof value === "string" ? value : fallback;
}
function point(params, group, key, fallback = [0.5, 0.5]) {
  var _a;
  const value = (_a = params[group]) == null ? void 0 : _a[key];
  return Array.isArray(value) ? value : fallback;
}
function planFromPreset(params, ctx) {
  var _a, _b;
  const animOn = bool(params, "animation", "active");
  const speed = num(params, "animation", "vitesse", 0.6);
  const amp = num(params, "animation", "amplitude", 1);
  const time = (_a = ctx.time) != null ? _a : 0;
  const t = animOn ? time * speed : 0;
  const reflDrift = animOn ? Math.sin(t * 0.8) * num(params, "animation", "derivReflet") * 0.35 : 0;
  const caDrift = animOn ? 1 + Math.sin(t * 1.6) * num(params, "animation", "derivAberration") : 1;
  const caDynamic = 1 + num(params, "aberration", "dynamique") * Math.sin(time * 1.4) * 0.8;
  const [reflX, reflY] = point(params, "reflets", "position", [0.35, 0.12]);
  const ambient = (_b = ctx.ambient) != null ? _b : { color: [1, 1, 1], intensity: 0 };
  const radius = num(params, "matiere", "rayon", 28);
  const uniforms = {
    // Dessin local : coord = (0..w, 0..h) dans le Canvas de la carte.
    uOrigin: [0, 0],
    uSize: [ctx.width, ctx.height],
    uRadius: radius,
    uTime: time,
    uLayer: 0,
    // Completes par l'app (cover du fond + position carte).
    uBgOffset: [0, 0],
    uBgScale: [1, 1],
    uTintStrength: num(params, "matiere", "opaciteVerre"),
    uTintColor: hexToRgb(str(params, "matiere", "couleur", "#0a0602")),
    uAlpha: num(params, "matiere", "transparence", 0.92),
    uThickness: num(params, "matiere", "epaisseur"),
    uNoiseAmount: num(params, "matiere", "bruit"),
    uNoiseScale: num(params, "matiere", "bruitEchelle", 180),
    uRoughness: num(params, "matiere", "rugosite"),
    uTexture: num(params, "matiere", "texture"),
    uBlurRadius: num(params, "depoli", "rayon"),
    uBlurStrength: num(params, "depoli", "intensite", 1),
    uLightDiffusion: num(params, "depoli", "diffusion", 0.45),
    uRefrStrength: num(params, "refraction", "intensite"),
    uRefrWidth: num(params, "refraction", "largeur", 46),
    uRefrEdgeOnly: bool(params, "refraction", "bordsSeuls", true) ? 1 : 0,
    uRefrSoftness: num(params, "refraction", "douceur"),
    uRefrType: num(params, "refraction", "type"),
    uCaEnabled: bool(params, "aberration", "active", true) ? 1 : 0,
    uCaStrength: num(params, "aberration", "intensite", 1) * caDrift * caDynamic,
    uCaWidth: num(params, "aberration", "largeur", 34),
    uCaEdgeOnly: bool(params, "aberration", "bordsSeuls", true) ? 1 : 0,
    uCaSeparation: num(params, "aberration", "separation", 4.5),
    uCaAngle: num(params, "aberration", "orientation") * DEG,
    uCaOpacity: num(params, "aberration", "opacite", 0.85),
    uReflIntensity: num(params, "reflets", "intensite"),
    uReflWidth: num(params, "reflets", "largeur", 0.18),
    uReflPos: [reflX + reflDrift, reflY],
    uReflAngle: num(params, "reflets", "angle", 90) * DEG,
    uReflHardness: num(params, "reflets", "durete"),
    uReflColor: hexToRgb(str(params, "reflets", "couleur", "#ffe6a8")),
    uReflOpacity: num(params, "reflets", "opacite", 0.6),
    uLightIntensity: num(params, "lumiere", "intensite", 0.7),
    uLightColor: hexToRgb(str(params, "lumiere", "couleur", "#ffc266")),
    uLightTemp: num(params, "lumiere", "temperature", 0.62),
    uHalo: num(params, "lumiere", "halo"),
    uInnerLight: num(params, "lumiere", "lumiereInterne"),
    uOuterLight: num(params, "lumiere", "lumiereExterne"),
    uLightInteraction: num(params, "lumiere", "interaction"),
    uAmbientColor: ambient.color,
    uAmbientIntensity: ambient.intensity,
    uInnerShadowOpacity: num(params, "ombres", "interneOpacite"),
    uInnerShadowBlur: num(params, "ombres", "interneFlou", 18),
    uInnerShadowDistance: num(params, "ombres", "interneDistance"),
    uInnerShadowAngle: num(params, "ombres", "interneDirection", 270) * DEG,
    uEdgeLight: num(params, "contours", "lumiereBord"),
    uEdgeLightWidth: num(params, "contours", "lumiereBordLargeur", 6)
  };
  const shadowAngle = num(params, "ombres", "externeDirection", 90) * DEG;
  const shadowDist = num(params, "ombres", "externeDistance", 14);
  const [sr, sg, sb, sa] = hexToRgba(
    str(params, "ombres", "externeCouleur", "#000000"),
    num(params, "ombres", "externeOpacite", 0.45)
  );
  const [br, bg, bb, ba] = hexToRgba(
    str(params, "contours", "couleur", "#f0dcaa"),
    num(params, "contours", "opacite", 0.35) * num(params, "contours", "portionEclairee", 1)
  );
  return {
    shaderSource: buildGlassShader(samplesForQuality(num(params, "depoli", "qualite", 2))),
    uniforms,
    radius,
    outerShadow: {
      color: `rgba(${Math.round(sr * 255)},${Math.round(sg * 255)},${Math.round(sb * 255)},${sa})`,
      blur: num(params, "ombres", "externeFlou", 26),
      dx: Math.cos(shadowAngle) * shadowDist,
      dy: Math.sin(shadowAngle) * shadowDist
    },
    border: {
      color: `rgba(${Math.round(br * 255)},${Math.round(bg * 255)},${Math.round(bb * 255)},${ba})`,
      width: num(params, "contours", "epaisseur", 1)
    }
  };
}
function backgroundUniforms(cardWin, bgOrigin, bgSize, imageSize) {
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
    uBgScale: [iw / dw, ih / dh]
  };
}
export {
  backgroundUniforms,
  buildGlassShader,
  planFromPreset,
  samplesForQuality
};
