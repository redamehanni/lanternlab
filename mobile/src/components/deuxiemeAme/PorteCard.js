import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FadeIn from '../ui/FadeIn';
import { THEME } from '../../theme';

/**
 * Une porte de la Deuxième Âme : une intention de découverte présentée comme une
 * tuile. Purement présentationnelle — la destination est décidée par l'appelant.
 */
export default function PorteCard({ porte, index = 0, onPress }) {
  return (
    <FadeIn delay={index * 60} style={styles.wrap}>
      <TouchableOpacity style={[styles.card, THEME.shadow.md]} onPress={onPress} activeOpacity={0.9}>
        <View style={[styles.iconWrap, { backgroundColor: porte.color + '18' }]}>
          <Ionicons name={porte.icon} size={24} color={porte.color} />
        </View>
        <Text style={styles.title} numberOfLines={2}>{porte.label}</Text>
        <Text style={styles.desc} numberOfLines={4}>{porte.description}</Text>
        <View style={[styles.arrow, { backgroundColor: porte.color }]}>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </View>
      </TouchableOpacity>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '48%' },
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: 16,
    minHeight: 190,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '800', color: THEME.colors.text, letterSpacing: -0.2 },
  desc: { fontSize: 12.5, color: THEME.colors.textSecondary, marginTop: 6, lineHeight: 17, flex: 1 },
  arrow: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 10, alignSelf: 'flex-start' },
});
