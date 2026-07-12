import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../theme';

const ENTRIES = [
  {
    id: 'info',
    icon: 'document-text-outline',
    label: 'Mes informations',
    sub: 'Coordonnées, adresses enregistrées',
    screen: 'ClientInfo',
  },
  {
    id: 'edit',
    icon: 'create-outline',
    label: 'Modifier mon profil',
    sub: 'Photo, nom, téléphone',
    screen: 'ClientInfo',
  },
];

export default function ClientProfileHubScreen({ navigation }) {
  return (
    <View style={styles.bg}>
      <Text style={styles.title}>Mon profil</Text>
      <Text style={styles.sub}>Gérez vos informations personnelles</Text>

      {ENTRIES.map((entry) => (
        <TouchableOpacity
          key={entry.id}
          style={[styles.card, THEME.shadow.sm]}
          onPress={() => navigation.navigate(entry.screen)}
          activeOpacity={0.88}
        >
          <View style={styles.iconWrap}>
            <Ionicons name={entry.icon} size={24} color={THEME.colors.accent} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardLabel}>{entry.label}</Text>
            <Text style={styles.cardSub}>{entry.sub}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={THEME.colors.textMuted} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg, padding: THEME.spacing.md },
  title: { ...THEME.typography.hero, fontSize: 28, color: THEME.colors.text },
  sub: { ...THEME.typography.body, color: THEME.colors.textSecondary, marginBottom: THEME.spacing.lg },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg, padding: THEME.spacing.md, marginBottom: 12,
    borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  iconWrap: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: THEME.colors.accentSoft,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  cardBody: { flex: 1 },
  cardLabel: { ...THEME.typography.subtitle, color: THEME.colors.text },
  cardSub: { fontSize: 13, color: THEME.colors.textSecondary, marginTop: 2 },
});
