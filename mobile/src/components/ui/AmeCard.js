import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AME } from '../../theme';

/**
 * Carte du Design System Deuxième Âme — surface crème posée, peu d'ombre.
 */
export default function AmeCard({
  children,
  style,
  onPress,
  elevated = true,
  padding = true,
  tint,
}) {
  const body = (
    <View
      style={[
        styles.card,
        elevated && AME.shadow.md,
        padding && styles.padding,
        tint ? { backgroundColor: tint } : null,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.88} onPress={onPress}>
        {body}
      </TouchableOpacity>
    );
  }
  return body;
}

export function AmeBadge({ label, tone = 'accent', style }) {
  const tones = {
    accent: { bg: AME.colors.accentSoft, fg: AME.colors.accentDeep },
    success: { bg: AME.colors.successSoft, fg: AME.colors.success },
    warning: { bg: AME.colors.warningSoft, fg: AME.colors.warning },
    muted: { bg: AME.colors.paper, fg: AME.colors.textMuted },
    nouveau: { bg: '#F3E8DF', fg: AME.colors.accentDeep },
  };
  const t = tones[tone] || tones.accent;
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, style]}>
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function AmeSectionTitle({ title, action, onAction, style }) {
  return (
    <View style={[styles.sectionRow, style]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.8} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AME.colors.card,
    borderRadius: AME.radius.lg,
    borderWidth: 1,
    borderColor: AME.colors.borderLight,
  },
  padding: { padding: AME.spacing.md },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: AME.radius.full,
  },
  badgeText: {
    fontFamily: AME.fonts.uiSemiBold,
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: AME.spacing.md,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: AME.fonts.display,
    fontSize: 22,
    color: AME.colors.text,
    letterSpacing: -0.2,
  },
  sectionAction: {
    fontFamily: AME.fonts.uiSemiBold,
    fontSize: 13.5,
    color: AME.colors.accentDeep,
  },
});
