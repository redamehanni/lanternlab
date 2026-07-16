import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../theme';

const TONES = {
  accent:  { fg: THEME.colors.accent,  bg: THEME.colors.accentSoft },
  success: { fg: THEME.colors.success, bg: THEME.colors.successSoft },
  warning: { fg: THEME.colors.warning, bg: THEME.colors.warningSoft },
  error:   { fg: THEME.colors.error,   bg: THEME.colors.errorSoft },
  neutral: { fg: THEME.colors.textSecondary, bg: THEME.colors.borderLight },
};

/**
 * Carte de briefing — purement présentationnelle.
 * Elle affiche une carte produite par un adaptateur et délègue l'action au parent.
 */
export default function BriefingCard({ card, onPress }) {
  const tone = TONES[card.tone] || TONES.neutral;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => onPress?.(card)}
      accessibilityLabel={card.title}
    >
      <View style={[styles.iconWrap, { backgroundColor: tone.bg }]}>
        <Ionicons name={card.icon} size={22} color={tone.fg} />
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{card.title}</Text>
        {card.subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>{card.subtitle}</Text>
        ) : null}
      </View>

      {card.value ? (
        <View style={[styles.valuePill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.valueText, { color: tone.fg }]}>{card.value}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={THEME.colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    ...THEME.shadow.sm,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: THEME.radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { ...THEME.typography.subtitle, color: THEME.colors.text },
  subtitle: { color: THEME.colors.textSecondary, fontSize: 13, marginTop: 2 },
  valuePill: {
    minWidth: 34, height: 28, borderRadius: THEME.radius.full,
    paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center',
  },
  valueText: { fontWeight: '800', fontSize: 14 },
});
