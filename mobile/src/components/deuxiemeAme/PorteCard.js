import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FadeIn from '../ui/FadeIn';
import Illustration from '../../illustrations/Illustration';
import { isPorteOpen } from '../../data/deuxiemeAme';
import { AME, MOTION } from '../../theme';

/**
 * Une porte : intention de découverte + illustration via registry.
 * Composition centrée ; relief = ombre teintée de la couleur de la porte.
 *
 * Si la porte est scellée (accès public V1), on n'affiche ni le label métier
 * ni la description — seulement une présentation mystère. L'écran cible
 * reste enregistré dans le navigateur ; c'est la surface qui refuse d'y aller.
 */
export default function PorteCard({ porte, index = 0, onPress }) {
  const open = isPorteOpen(porte);
  const accent = porte.color || AME.colors.accent;
  const tint = porte.soft || AME.colors.paper;
  const title = open ? porte.label : (porte.sealedLabel || 'Porte');
  const desc = open
    ? porte.description
    : 'Scellée pour l\u2019instant. Une entrée de plus dans le programme.';

  return (
    <FadeIn delay={index * MOTION.delay.stagger} style={styles.wrap}>
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: 'rgba(255, 251, 247, 0.82)' },
          tintedShadow(accent),
          !open && styles.cardSealed,
        ]}
        onPress={onPress}
        activeOpacity={0.9}
        accessibilityState={{ disabled: !open }}
        accessibilityHint={open ? undefined : 'Porte encore scellée'}
      >
        <View style={[styles.wash, { backgroundColor: tint }, !open && styles.washSealed]} />

        {open ? (
          <Illustration
            name={porte.illustrationKey || 'portes.surprise'}
            size={78}
            brushEdge
            style={styles.illu}
          />
        ) : (
          <View style={[styles.seal, { borderColor: accent }]}>
            <Ionicons name="lock-closed-outline" size={28} color={accent} />
          </View>
        )}

        <Text style={[styles.title, !open && styles.titleSealed]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.desc} numberOfLines={2}>{desc}</Text>

        <View style={[styles.arrow, { backgroundColor: accent }, !open && styles.arrowSealed]}>
          <Ionicons
            name={open ? 'arrow-forward' : 'lock-closed'}
            size={13}
            color="#FFFBF7"
          />
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
  cardSealed: {
    opacity: 0.88,
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
  washSealed: {
    opacity: 0.28,
  },
  illu: {
    marginBottom: 8,
    alignSelf: 'center',
  },
  seal: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(255, 251, 247, 0.65)',
  },
  title: {
    fontFamily: AME.fonts.display,
    fontSize: 16,
    color: AME.colors.text,
    letterSpacing: -0.2,
    lineHeight: 19,
    textAlign: 'center',
  },
  titleSealed: {
    fontStyle: 'italic',
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
  arrowSealed: {
    opacity: 0.7,
  },
});
