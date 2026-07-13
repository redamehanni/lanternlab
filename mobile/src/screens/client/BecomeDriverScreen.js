import React from 'react';
import { View, StyleSheet } from 'react-native';
import ClientPlaceholderScreen from '../../components/client/ClientPlaceholderScreen';
import { THEME } from '../../theme';

export default function BecomeDriverScreen() {
  return (
    <ClientPlaceholderScreen
      title="Devenir livreur"
      intro="Les candidatures pour rejoindre notre réseau de livreurs ouvriront prochainement. Revenez bientôt pour postuler."
    >
      {/* Zone réservée au futur formulaire de candidature */}
      <View style={styles.formArea} />
    </ClientPlaceholderScreen>
  );
}

const styles = StyleSheet.create({
  formArea: {
    minHeight: 120,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    borderStyle: 'dashed',
    marginBottom: THEME.spacing.lg,
  },
});
