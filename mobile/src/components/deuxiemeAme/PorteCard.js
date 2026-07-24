import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FadeIn from '../ui/FadeIn';
import Illustration from '../../illustrations/Illustration';
import { AME, MOTION } from '../../theme';

/**
 * Une porte : intention de découverte + illustration via registry.
 * Composition centrée ; relief = ombre teintée de la couleur de la porte.
 */
export default function PorteCard({ porte, index = 0, onPress }) {
  const accent = porte.color || AME.colors.accent;
  const tint = porte.soft || AME.colors.paper;

  return (
    <FadeIn delay={index * MOTION.delay.stagger} style={styles.wrap}>
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: 'rgba(255, 251, 247, 0.82)' },
          tintedShadow(accent),
        ]}
        onPress={onPress}
        activeOpacity={0.9}
      >
        <View style={[styles.wash, { backgroundColor: tint }]} />

        <Illustration
          name={porte.illustrationKey || 'portes.surprise'}
          size={78}
          brushEdge
          style={styles.illu}
        />
        <Text style={styles.title} numberOfLines={2}>{porte.label}</Text>
        <Text style={styles.desc} numberOfLines={2}>{porte.description}</Text>

        <View style={[styles.arrow, { backgroundColor: accent }]}>
          <Ionicons name="arrow-forward" size={13} color="#FFFBF7" />
        </View>
      </TouchableOpacity>
    </FadeIn>
  );
}

function tintedShadow(color) {
  return Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 14,
    },
    android: {
      elevation: 3,
      // Android elevation is monochrome; border hint keeps a touch of color
      borderColor: color + '33',
    },
    default: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
    },
  });
}

const styles = StyleSheet.create({
  wrap: { width: '48.8%' },
  card: {
    borderRadius: 18,
    paddingTop: 12,
    paddingHorizontal: 11,
    paddingBottom: 11,
    minHeight: 168,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(92, 64, 48, 0.08)',
    overflow: 'visible',
    alignItems: 'center',
  },
  wash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 72,
    opacity: 0.5,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  illu: {
    marginBottom: 8,
    alignSelf: 'center',
  },
  title: {
    fontFamily: AME.fonts.display,
    fontSize: 16,
    color: AME.colors.text,
    letterSpacing: -0.2,
    lineHeight: 19,
    textAlign: 'center',
  },
  desc: {
    fontFamily: AME.fonts.ui,
    fontSize: 11.5,
    color: AME.colors.textSecondary,
    marginTop: 4,
    lineHeight: 15,
    textAlign: 'center',
    flex: 1,
  },
  arrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    alignSelf: 'center',
    opacity: 0.95,
  },
});
