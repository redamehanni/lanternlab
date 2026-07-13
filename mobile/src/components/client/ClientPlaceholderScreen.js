import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { THEME } from '../../theme';

/**
 * Écran placeholder client — structure visuelle commune pour les pages en attente.
 * Aucune logique métier : titre + contenu optionnel + message centré.
 */
export default function ClientPlaceholderScreen({ title, intro, children }) {
  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{title}</Text>
      {intro ? <Text style={styles.intro}>{intro}</Text> : null}
      {children}
      <View style={styles.placeholderBox}>
        <Text style={styles.placeholder}>Contenu en attente de développement.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { flexGrow: 1, padding: THEME.spacing.lg, paddingBottom: 40 },
  title: { ...THEME.typography.title, color: THEME.colors.text, marginBottom: THEME.spacing.md },
  intro: {
    fontSize: 15,
    lineHeight: 22,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.lg,
  },
  placeholderBox: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 200 },
  placeholder: {
    fontSize: 15,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
