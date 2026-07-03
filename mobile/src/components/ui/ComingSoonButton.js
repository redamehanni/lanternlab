import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { THEME } from '../../theme';

export default function ComingSoonButton({ label, onPress, style, icon }) {
  return (
    <TouchableOpacity
      style={[styles.btn, style]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={!onPress}
    >
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={styles.label}>{label}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Bientôt disponible</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.error + '55',
    marginBottom: THEME.spacing.sm,
    ...THEME.shadow.sm,
  },
  icon: { fontSize: 20, marginRight: 10 },
  label: {
    flex: 1,
    ...THEME.typography.subtitle,
    color: THEME.colors.text,
  },
  badge: {
    backgroundColor: THEME.colors.errorSoft,
    borderRadius: THEME.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.error,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
