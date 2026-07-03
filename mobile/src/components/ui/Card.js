import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../../theme';

export default function Card({ children, style, elevated = true, padding = true }) {
  return (
    <View style={[
      styles.card,
      elevated && THEME.shadow.md,
      padding && styles.padding,
      style,
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  padding: { padding: THEME.spacing.md },
});

export function SectionHeader({ title, subtitle, action, onAction }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action && onAction ? (
        <Text style={styles.action} onPress={onAction}>{action}</Text>
      ) : null}
    </View>
  );
}

const headerStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
    marginTop: THEME.spacing.lg,
  },
  title: { ...THEME.typography.title, color: THEME.colors.text },
  subtitle: { ...THEME.typography.caption, color: THEME.colors.textSecondary, marginTop: 2 },
  action: { ...THEME.typography.caption, color: THEME.colors.accent, fontWeight: '700' },
});
Object.assign(styles, headerStyles);
