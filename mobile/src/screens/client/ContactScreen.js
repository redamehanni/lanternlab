import React from 'react';
import { View, StyleSheet } from 'react-native';
import ClientPlaceholderScreen from '../../components/client/ClientPlaceholderScreen';
import { THEME } from '../../theme';

export default function ContactScreen() {
  return (
    <ClientPlaceholderScreen title="Contact">
      {/* Zone réservée au futur formulaire de contact */}
      <View style={styles.formArea} />
    </ClientPlaceholderScreen>
  );
}

const styles = StyleSheet.create({
  formArea: {
    minHeight: 160,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    borderStyle: 'dashed',
    marginBottom: THEME.spacing.lg,
  },
});
