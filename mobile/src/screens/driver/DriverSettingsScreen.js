import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../../theme';

export default function DriverSettingsScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Paramètres</Text>
      <Text style={styles.sub}>Les paramètres avancés seront disponibles prochainement.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.colors.bg, padding: THEME.spacing.lg },
  title: { ...THEME.typography.title, color: THEME.colors.text },
  sub: { color: THEME.colors.textSecondary, marginTop: 8, lineHeight: 22 },
});
