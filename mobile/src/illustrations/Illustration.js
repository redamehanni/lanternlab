import React from 'react';
import { Image, View, StyleSheet, Platform } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { getIllustration } from './registry';
import { AME } from '../theme';

const BRUSH_EDGE_MASK = require('../../assets/illustrations/masks/brush-edge.png');

/**
 * Affiche une illustration via sa clé de registry.
 * Jamais d'asset en dur dans les écrans — uniquement `illustrationKey`.
 *
 * `brushEdge` : masque aquarelle (MaskedView) — natif uniquement.
 * Sur le web, MaskedView / resolveAssetSource ne sont pas fiables :
 * on affiche l'image avec un arrondi doux pour rester visible.
 */
export default function Illustration({
  name,
  size = 72,
  width,
  height,
  style,
  resizeMode = 'cover',
  rounded = true,
  brushEdge = false,
}) {
  const entry = getIllustration(name);
  const w = width ?? size;
  const h = height ?? size;

  // Web : pas de MaskedView ni de resolveAssetSource — image visible, coins doux.
  if (brushEdge && Platform.OS === 'web') {
    return (
      <View
        style={[
          styles.well,
          {
            width: w,
            height: h,
            borderRadius: Math.min(AME.radius.lg, w * 0.28),
          },
          style,
        ]}
      >
        <Image
          source={entry.source}
          accessibilityLabel={entry.alt}
          style={{ width: '100%', height: '100%' }}
          resizeMode={resizeMode}
        />
      </View>
    );
  }

  if (brushEdge) {
    return (
      <MaskedView
        style={[{ width: w, height: h }, style]}
        maskElement={
          <View style={styles.maskRoot}>
            <Image
              source={BRUSH_EDGE_MASK}
              style={{ width: w, height: h }}
              resizeMode="stretch"
            />
          </View>
        }
      >
        <Image
          source={entry.source}
          accessibilityLabel={entry.alt}
          style={{ width: w, height: h }}
          resizeMode={resizeMode}
        />
      </MaskedView>
    );
  }

  return (
    <View
      style={[
        styles.well,
        rounded && { borderRadius: Math.min(AME.radius.md, w * 0.22) },
        { width: w, height: h },
        style,
      ]}
    >
      <Image
        source={entry.source}
        accessibilityLabel={entry.alt}
        style={{ width: '100%', height: '100%' }}
        resizeMode={resizeMode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  well: {
    overflow: 'hidden',
    backgroundColor: AME.colors.paper,
  },
  maskRoot: {
    backgroundColor: 'transparent',
    flex: 1,
  },
});
