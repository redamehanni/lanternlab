import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FadeIn from '../ui/FadeIn';
import Illustration from '../../illustrations/Illustration';
import { AME, MOTION } from '../../theme';

/**
 * Une porte : intention de découverte + illustration via registry.
 * Purement présentationnelle — la destination est décidée par l'appelant.
 */
export default function PorteCard({ porte, index = 0, onPress }) {
  const soft = porte.soft || `${porte.color}18`;
  return (
    <FadeIn delay={index * MOTION.delay.stagger} style={styles.wrap}>
      <TouchableOpacity
        style={[styles.card, AME.shadow.sm, { backgroundColor: soft }]}
        onPress={onPress}
        activeOpacity={0.88}
      >
        <Illustration
          name={porte.illustrationKey || 'portes.surprise'}
          size={96}
          brushEdge
          style={styles.illu}
        />
        <Text style={styles.title} numberOfLines={2}>{porte.label}</Text>
        <Text style={styles.desc} numberOfLines={3}>{porte.description}</Text>
        <View style={[styles.arrow, { backgroundColor: porte.color }]}>
          <Ionicons name="arrow-forward" size={15} color="#fff" />
        </View>
      </TouchableOpacity>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '47.5%' },
  card: {
    borderRadius: AME.radius.lg,
    padding: 14,
    minHeight: 214,
    borderWidth: 1,
    borderColor: AME.colors.borderLight,
  },
  illu: {
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  title: {
    fontFamily: AME.fonts.display,
    fontSize: 17,
    color: AME.colors.text,
    letterSpacing: -0.2,
    lineHeight: 21,
  },
  desc: {
    fontFamily: AME.fonts.ui,
    fontSize: 12.5,
    color: AME.colors.textSecondary,
    marginTop: 6,
    lineHeight: 17,
    flex: 1,
  },
  arrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    alignSelf: 'flex-start',
  },
});
