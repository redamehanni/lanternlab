import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';
import { useImage } from '@shopify/react-native-skia';
import { Ionicons } from '@expo/vector-icons';
import LanterneGlassCard from '../../components/deuxiemeAme/LanterneGlassCard';
import { LANTYPE } from '../../theme';

const PORTE_FOND = require('../../../assets/lanternes/homme-lanterne.jpg');

/** Dimensions natives de l'image. */
const BG_NATIVE = { w: 715, h: 1024 };

/**
 * Calage aligne sur le simulateur telephone Material Lab (screen Reda).
 * Fractions relatives a l'ecran utile (plein bleed, sans header).
 */
const SCENE = {
  /** Zoom fond : 1 = cover classique labo. */
  bgZoom: 1,
  /** Pan fond (px) — positif = image a droite / en bas. */
  bgPanX: 0,
  bgPanY: 0,
  /** Largeur carte (px) — meme gabarit que le Material Lab. */
  cardWidth: 316,
  /** Hauteur carte (px). */
  cardHeight: 122,
  /** Hotspot lanterne dans l'image (UV). */
  lanternUv: { x: 0.71, y: 0.39 },
  /** Ou la lanterne atterrit dans la carte. */
  cardFocus: { x: 0.86, y: 0.42 },
};

const DEMO_ONE = {
  status: 'active',
  lanterne: {
    id: 'demo-pont-neuf',
    name: 'Lanterne du Pont Neuf',
    district: '1er · Louvre',
    description: '« Sous l’arche, un murmure d’ambre attend celui qui sait regarder. »',
    coordinates: '48.8583° N, 2.3417° E',
  },
};

function bgLayout(screenW, screenH) {
  const cover = Math.max(screenW / BG_NATIVE.w, screenH / BG_NATIVE.h);
  const scale = cover * SCENE.bgZoom;
  const dw = BG_NATIVE.w * scale;
  const dh = BG_NATIVE.h * scale;
  const dx = (screenW - dw) / 2 + SCENE.bgPanX;
  const dy = (screenH - dh) / 2 + SCENE.bgPanY;
  return { dx, dy, dw, dh, scale };
}

function layoutScene(screenW, screenH) {
  if (screenW <= 8 || screenH <= 8) {
    return {
      bg: { dx: 0, dy: 0, dw: screenW, dh: screenH },
      card: {
        top: 120,
        left: Math.max(8, (screenW - SCENE.cardWidth) / 2),
        width: SCENE.cardWidth,
        height: SCENE.cardHeight,
      },
    };
  }

  const bg = bgLayout(screenW, screenH);
  const focusX = bg.dx + SCENE.lanternUv.x * bg.dw;
  const focusY = bg.dy + SCENE.lanternUv.y * bg.dh;

  const width = SCENE.cardWidth;
  const height = SCENE.cardHeight;
  let left = focusX - SCENE.cardFocus.x * width;
  let top = focusY - SCENE.cardFocus.y * height;

  // Garde la carte dans l'ecran (marges legeres).
  left = Math.min(Math.max(left, 8), screenW - width - 8);
  top = Math.min(Math.max(top, 48), screenH - height - 48);

  return {
    bg,
    card: { top, left, width, height },
  };
}

/**
 * Scène Lantype — calée comme le simulateur telephone du Material Lab.
 */
export default function LanternsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const scrollY = useSharedValue(0);
  const bgOriginX = useSharedValue(0);
  const bgOriginY = useSharedValue(0);
  const [bgSize, setBgSize] = useState({ w: 0, h: 0 });
  const rootRef = useRef(null);
  const bgImage = useImage(PORTE_FOND);

  const screenW = bgSize.w > 8 ? bgSize.w : winW;
  const screenH = bgSize.h > 8 ? bgSize.h : winH;
  const scene = useMemo(() => layoutScene(screenW, screenH), [screenW, screenH]);

  const measureBg = useCallback(() => {
    rootRef.current?.measureInWindow?.((x, y, width, height) => {
      if (!Number.isFinite(width) || width <= 0) return;
      bgOriginX.value = Number.isFinite(x) ? x : 0;
      bgOriginY.value = Number.isFinite(y) ? y : 0;
      setBgSize((prev) =>
        prev.w === width && prev.h === height ? prev : { w: width, h: height },
      );
    });
  }, [bgOriginX, bgOriginY]);

  return (
    <View
      ref={rootRef}
      collapsable={false}
      style={styles.root}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) {
          setBgSize((prev) =>
            prev.w === width && prev.h === height ? prev : { w: width, h: height },
          );
        }
        measureBg();
      }}
    >
      <View style={styles.fond} pointerEvents="none">
        {/* Cover plein ecran (fiable). Le zoom/pan SCENE reste applique au sampling Skia + calage carte. */}
        <Image source={PORTE_FOND} style={styles.fondImage} resizeMode="cover" />
      </View>

      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 8 }]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
        hitSlop={12}
      >
        <Ionicons name="chevron-back" size={22} color={LANTYPE.colors.parchment} />
      </TouchableOpacity>

      <View
        style={[
          styles.cardSlot,
          {
            top: scene.card.top,
            left: scene.card.left,
            width: scene.card.width,
          },
        ]}
      >
        <LanterneGlassCard
          lanterne={DEMO_ONE.lanterne}
          status={DEMO_ONE.status}
          height={scene.card.height}
          showContent={false}
          bgImage={bgImage}
          bgSize={bgSize}
          bgZoom={SCENE.bgZoom}
          bgPanX={SCENE.bgPanX}
          bgPanY={SCENE.bgPanY}
          scrollY={scrollY}
          bgOriginX={bgOriginX}
          bgOriginY={bgOriginY}
          onPress={() => {}}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  fond: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  fondImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  backBtn: {
    position: 'absolute',
    left: 12,
    zIndex: 3,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,6,2,0.35)',
  },
  cardSlot: {
    position: 'absolute',
    zIndex: 1,
  },
});
