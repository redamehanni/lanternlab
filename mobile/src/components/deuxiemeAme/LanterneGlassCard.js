/**
 * Lantype Glass — rendu depuis le preset Material Lab (active.json).
 * Source officielle des parametres : lantype-lab → npm run sync:mobile.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import {
  Canvas,
  RoundedRect,
  Shader,
  Skia,
  ImageShader,
} from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';
import { LANTYPE } from '../../theme';
import {
  activePreset,
  planFromPreset,
} from '../../theme/materials/glass';

const DEFAULT_CARD_H = 160;
const USE_SKSL = Platform.OS === 'ios' || Platform.OS === 'android';

const STATUS_META = {
  undiscovered: {
    label: 'Non découverte',
    dotColor: 'rgba(240,228,194,0.18)',
    textColor: 'rgba(240,228,194,0.22)',
    borderColor: 'rgba(240,200,120,0.06)',
  },
  active: {
    label: 'En cours',
    dotColor: 'rgba(148,210,255,0.90)',
    textColor: 'rgba(148,210,255,0.85)',
    borderColor: 'rgba(148,210,255,0.18)',
  },
  found: {
    label: 'Découverte',
    dotColor: 'rgba(255,195,70,1)',
    textColor: 'rgba(232,168,48,1)',
    borderColor: 'rgba(240,200,120,0.18)',
  },
};

const PRESET_PARAMS = activePreset?.params || {};

/** Cache d'effets par source SkSL (qualite du blur). */
const effectCache = new Map();

function getEffect(source) {
  if (!USE_SKSL || !source) return null;
  if (effectCache.has(source)) return effectCache.get(source);
  try {
    const effect = Skia.RuntimeEffect.Make(source);
    effectCache.set(source, effect);
    return effect;
  } catch (e) {
    console.warn('[Lantype] SkSL compile error', e?.message || e);
    effectCache.set(source, null);
    return null;
  }
}

function coverUniforms({
  planUniforms,
  width,
  height,
  cardWinX,
  cardWinY,
  originX,
  originY,
  bgW,
  bgH,
  imgW,
  imgH,
  bgZoom = 1,
  bgPanX = 0,
  bgPanY = 0,
}) {
  const iw = Math.max(1, imgW);
  const ih = Math.max(1, imgH);
  const bw = Math.max(1, bgW);
  const bh = Math.max(1, bgH);
  const cover = Math.max(bw / iw, bh / ih);
  const scale = cover * Math.max(0.25, bgZoom || 1);
  const dw = iw * scale;
  const dh = ih * scale;
  const coverWinX = originX + (bw - dw) / 2 + bgPanX;
  const coverWinY = originY + (bh - dh) / 2 + bgPanY;
  return {
    ...planUniforms,
    uSize: [Math.max(1, width), Math.max(1, height)],
    uBgOffset: [coverWinX - cardWinX, coverWinY - cardWinY],
    uBgScale: [iw / dw, ih / dh],
  };
}

export default function LanterneGlassCard({
  status = 'undiscovered',
  lanterne,
  onPress,
  height: heightProp,
  showContent = true,
  bgImage,
  bgSize = { w: 0, h: 0 },
  bgZoom = 1,
  bgPanX = 0,
  bgPanY = 0,
  scrollY,
  bgOriginX,
  bgOriginY,
}) {
  const meta = STATUS_META[status] || STATUS_META.undiscovered;
  const isUndiscovered = status === 'undiscovered';
  const cardH = heightProp > 8 ? heightProp : DEFAULT_CARD_H;

  const wrapRef = useRef(null);
  const [width, setWidth] = useState(0);
  // Uniforms construits sur le JS thread (pas de spread d'objet JS dans un worklet).
  const [uniforms, setUniforms] = useState(null);

  const zero = useSharedValue(0);
  const scrollSV = scrollY || zero;
  const originX = bgOriginX || zero;
  const originY = bgOriginY || zero;
  const anchorScrollY = useRef(0);

  const name = lanterne?.name || 'Lanterne inconnue';
  const description = lanterne?.description || '';
  const district = lanterne?.district || '';
  const rarity = lanterne?.rarity;
  const coordinates = lanterne?.coordinates;

  const tags =
    status === 'found'
      ? [district, rarity || '★ Rare'].filter(Boolean)
      : status === 'active'
        ? [district, '→ En cours'].filter(Boolean)
        : [];

  const basePlan = useMemo(() => {
    if (width <= 8) return null;
    try {
      return planFromPreset(PRESET_PARAMS, { width, height: cardH, time: 0 });
    } catch (e) {
      console.warn('[Lantype] planFromPreset', e?.message || e);
      return null;
    }
  }, [width, cardH]);

  const effect = useMemo(
    () => (basePlan ? getEffect(basePlan.shaderSource) : null),
    [basePlan],
  );

  const imgW = bgImage?.width?.() || 0;
  const imgH = bgImage?.height?.() || 0;

  const showGlass =
    USE_SKSL &&
    !!effect &&
    !!basePlan &&
    !!uniforms &&
    !!bgImage &&
    width > 8 &&
    bgSize.w > 8 &&
    bgSize.h > 8 &&
    imgW > 0 &&
    imgH > 0;

  const rebuildUniforms = (cardWinX, cardWinY) => {
    if (!basePlan || width <= 8 || bgSize.w <= 8 || imgW <= 0) {
      setUniforms(null);
      return;
    }
    setUniforms(
      coverUniforms({
        planUniforms: basePlan.uniforms || {},
        width,
        height: cardH,
        cardWinX,
        cardWinY,
        originX: originX.value,
        originY: originY.value,
        bgW: bgSize.w,
        bgH: bgSize.h,
        imgW,
        imgH,
        bgZoom,
        bgPanX,
        bgPanY,
      }),
    );
  };

  const syncAnchor = () => {
    wrapRef.current?.measureInWindow?.((x, y) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const sy = scrollSV.value;
      anchorScrollY.current = sy;
      // y fenetre = position ancree - scroll courant ; on reconstruit en coords contenu
      rebuildUniforms(x, y);
    });
  };

  useEffect(() => {
    syncAnchor();
  }, [width, cardH, bgSize.w, bgSize.h, basePlan, imgW, imgH, bgZoom, bgPanX, bgPanY]);

  // Pendant le scroll : rafraichir l'offset fond (JS thread, throttle leger).
  useEffect(() => {
    if (!scrollY) return undefined;
    let raf = 0;
    const id = setInterval(() => {
      const sy = scrollSV.value;
      if (Math.abs(sy - anchorScrollY.current) < 0.5) return;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => syncAnchor());
    }, 32);
    return () => {
      clearInterval(id);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollY, basePlan, width, cardH, bgSize.w, bgSize.h, imgW, imgH, bgZoom, bgPanX, bgPanY]);

  const radius = basePlan?.radius ?? 16;
  const shadow = basePlan?.outerShadow;
  const border = basePlan?.border;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.wrap,
        heightProp ? styles.wrapFlush : null,
        isUndiscovered && styles.undiscovered,
      ]}
    >
      <View
        ref={wrapRef}
        collapsable={false}
        style={[
          styles.card,
          { height: cardH, borderRadius: radius },
          shadow
            ? {
                shadowColor: shadow.color,
                shadowOffset: { width: shadow.dx, height: shadow.dy },
                shadowOpacity: 1,
                shadowRadius: shadow.blur / 2,
              }
            : null,
        ]}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && w !== width) setWidth(w);
          else syncAnchor();
        }}
      >
        <View style={styles.fallback} pointerEvents="none" />

        {showGlass ? (
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            <RoundedRect x={0} y={0} width={width} height={cardH} r={radius}>
              <Shader source={effect} uniforms={uniforms}>
                <ImageShader
                  image={bgImage}
                  fit="fill"
                  rect={{ x: 0, y: 0, width: imgW, height: imgH }}
                />
              </Shader>
            </RoundedRect>
          </Canvas>
        ) : null}

        <View
          pointerEvents="none"
          style={[
            styles.rim,
            {
              borderRadius: radius,
              borderColor: border?.color || meta.borderColor,
              borderWidth: border?.width || 0.5,
            },
          ]}
        />

        {showContent ? (
          <View style={styles.content}>
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: meta.dotColor }]} />
              <Text style={[styles.statusLabel, { color: meta.textColor }]}>
                {meta.label}
              </Text>
            </View>

            <Text
              style={[
                styles.name,
                {
                  color: isUndiscovered
                    ? 'rgba(240,220,160,0.35)'
                    : 'rgba(240,220,160,0.90)',
                },
              ]}
            >
              {isUndiscovered ? 'Lanterne inconnue' : name.toUpperCase()}
            </Text>

            <Text
              style={[
                styles.description,
                {
                  color: isUndiscovered
                    ? 'rgba(240,228,194,0.18)'
                    : 'rgba(240,228,194,0.44)',
                },
              ]}
            >
              {isUndiscovered
                ? '« Explorez Paris pour la révéler. »'
                : description}
            </Text>

            {coordinates && !isUndiscovered ? (
              <Text style={styles.coords}>{coordinates}</Text>
            ) : null}

            {tags.length > 0 ? (
              <View style={styles.tags}>
                {tags.map((tag) => (
                  <View
                    key={tag}
                    style={[styles.tag, { borderColor: meta.dotColor }]}
                  >
                    <Text style={[styles.tagText, { color: meta.textColor }]}>
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
    alignSelf: 'stretch',
  },
  wrapFlush: {
    marginBottom: 0,
  },
  undiscovered: { opacity: 0.52 },
  card: {
    overflow: 'hidden',
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 6, 2, 0.35)',
  },
  rim: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    padding: 22,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: {
    fontFamily: LANTYPE.fonts.monoLight || LANTYPE.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  name: {
    fontFamily: LANTYPE.fonts.displaySemiBold,
    fontSize: 13,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  description: {
    fontFamily: LANTYPE.fonts.bodyItalic,
    fontSize: 10.5,
    lineHeight: 17,
  },
  coords: {
    fontFamily: LANTYPE.fonts.mono,
    fontSize: 8,
    letterSpacing: 0.8,
    color: 'rgba(232,168,48,0.28)',
    marginTop: 10,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 0.5,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tagText: {
    fontFamily: LANTYPE.fonts.mono,
    fontSize: 8,
    letterSpacing: 0.8,
  },
});
