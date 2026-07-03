import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import Avatar from '../../components/Avatar';
import { THEME } from '../../theme';

export default function DriverMenuScreen({ navigation }) {
  const { user, logoutUser } = useApp();
  const rating = '4,8';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.profile}>
        <Avatar name={user.name} photoUrl={user.photo_url} role="driver" size={72} />
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.rating}>⭐ {rating} · Note moyenne</Text>
      </View>

      <View style={styles.floatRow}>
        <TouchableOpacity style={styles.floatCard} onPress={() => navigation.navigate('DriverHelp')}>
          <Ionicons name="help-circle-outline" size={28} color={THEME.colors.accent} />
          <Text style={styles.floatLabel}>Aide</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.floatCard} onPress={() => navigation.navigate('DriverSettings')}>
          <Ionicons name="settings-outline" size={28} color={THEME.colors.accent} />
          <Text style={styles.floatLabel}>Paramètres</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionSub}>Gérer mon compte</Text>
      <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('DriverInfo')}>
        <Ionicons name="person-outline" size={22} color={THEME.colors.text} />
        <Text style={styles.menuLabel}>Mes informations</Text>
        <Ionicons name="chevron-forward" size={20} color={THEME.colors.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.logout} onPress={logoutUser}>
        <Ionicons name="log-out-outline" size={20} color={THEME.colors.error} />
        <Text style={styles.logoutText}>Déconnexion</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { padding: THEME.spacing.lg, paddingBottom: 48 },
  profile: { alignItems: 'center', paddingVertical: THEME.spacing.lg },
  name: { ...THEME.typography.title, color: THEME.colors.text, marginTop: 12 },
  rating: { color: THEME.colors.textSecondary, marginTop: 4 },
  floatRow: { flexDirection: 'row', gap: 12, marginBottom: THEME.spacing.lg },
  floatCard: {
    flex: 1, backgroundColor: THEME.colors.card, borderRadius: THEME.radius.lg,
    padding: THEME.spacing.lg, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: THEME.colors.borderLight, ...THEME.shadow.md,
  },
  floatLabel: { fontWeight: '700', color: THEME.colors.text },
  sectionSub: { ...THEME.typography.micro, color: THEME.colors.textMuted, marginBottom: 10, textTransform: 'uppercase' },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: THEME.colors.card, borderRadius: THEME.radius.md,
    padding: THEME.spacing.md, marginBottom: 8, ...THEME.shadow.sm,
  },
  menuLabel: { flex: 1, fontWeight: '600', color: THEME.colors.text, fontSize: 15 },
  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: THEME.spacing.xl, padding: THEME.spacing.md,
  },
  logoutText: { color: THEME.colors.error, fontWeight: '700', fontSize: 15 },
});
