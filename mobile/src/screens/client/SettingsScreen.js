import React from 'react';
import { View, StyleSheet } from 'react-native';
import ClientPlaceholderScreen from '../../components/client/ClientPlaceholderScreen';
import { THEME } from '../../theme';

export default function SettingsScreen() {
  return (
    <ClientPlaceholderScreen title="Paramètres">
      {/* Zone réservée aux futures options */}
      <View style={styles.settingsArea} />
    </ClientPlaceholderScreen>
  );
}

const styles = StyleSheet.create({
  settingsArea: {
    minHeight: 100,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    borderStyle: 'dashed',
    marginBottom: THEME.spacing.lg,
  },
});
