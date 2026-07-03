import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { THEME } from '../../theme';

const FAQ = [
  { q: 'Comment passer en ligne ?', a: 'Appuyez sur le bouton « PASSEZ EN LIGNE » sur l\'écran d\'accueil.' },
  { q: 'Comment accepter une course ?', a: 'Une notification apparaît lorsqu\'une course est disponible. Vous avez 20 secondes pour accepter.' },
  { q: 'Comment contacter le commerçant ou le client ?', a: 'Utilisez le bouton Message dans le tiroir de course. Avant la prise en charge, seul le commerçant est accessible.' },
  { q: 'Comment voir mes revenus ?', a: 'Consultez l\'onglet Revenu pour voir vos gains du jour et de la semaine.' },
];

export default function DriverHelpScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Centre d'aide</Text>
      {FAQ.map((item) => (
        <View key={item.q} style={styles.card}>
          <Text style={styles.question}>{item.q}</Text>
          <Text style={styles.answer}>{item.a}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { padding: THEME.spacing.lg },
  title: { ...THEME.typography.title, color: THEME.colors.text, marginBottom: THEME.spacing.md },
  card: {
    backgroundColor: THEME.colors.card, borderRadius: THEME.radius.md,
    padding: THEME.spacing.md, marginBottom: 10, ...THEME.shadow.sm,
  },
  question: { fontWeight: '700', color: THEME.colors.text, marginBottom: 6 },
  answer: { color: THEME.colors.textSecondary, lineHeight: 21 },
});
