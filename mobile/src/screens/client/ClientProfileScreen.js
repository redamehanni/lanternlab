import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { useCart } from '../../context/CartContext';
import Avatar from '../../components/Avatar';
import FadeIn from '../../components/ui/FadeIn';
import { THEME } from '../../theme';

export default function ClientProfileScreen({ navigation }) {
  const { user, logoutUser } = useApp();
  const { count } = useCart();

  const shortcuts = [
    { icon: 'receipt-outline', label: 'Mes commandes', screen: 'MenuTab', params: { screen: 'OrderHistory' }, color: '#2563EB' },
    { icon: 'heart-outline', label: 'Favoris', screen: 'HomeTab', color: '#EC4899' },
    { icon: 'cart-outline', label: 'Mon panier', screen: 'CartTab', badge: count, color: '#059669' },
    { icon: 'help-circle-outline', label: 'Aide', screen: 'MenuTab', params: { screen: 'HelpCenter' }, color: '#7C3AED' },
  ];

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.content}>
      <FadeIn>
        <View style={[styles.header, THEME.shadow.md]}>
          <Avatar name={user.name} photoUrl={user.photo_url} role={user.role} size={72} />
          <Text style={styles.name}>{user.first_name || user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('ClientInfo')}>
            <Text style={styles.editBtnText}>Modifier mon profil</Text>
          </TouchableOpacity>
        </View>
      </FadeIn>

      <Text style={styles.section}>Raccourcis</Text>
      <View style={styles.grid}>
        {shortcuts.map((s, i) => (
          <FadeIn key={s.label} delay={i * 60}>
            <TouchableOpacity
              style={[styles.shortcut, THEME.shadow.sm]}
              onPress={() => navigation.navigate(s.screen, s.params)}
            >
              <View style={[styles.shortcutIcon, { backgroundColor: s.color + '15' }]}>
                <Ionicons name={s.icon} size={24} color={s.color} />
                {s.badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{s.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.shortcutLabel}>{s.label}</Text>
            </TouchableOpacity>
          </FadeIn>
        ))}
      </View>

      <TouchableOpacity style={styles.logout} onPress={logoutUser}>
        <Ionicons name="log-out-outline" size={20} color={THEME.colors.error} />
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { padding: THEME.spacing.md, paddingBottom: 100 },
  header: {
    backgroundColor: THEME.colors.card, borderRadius: THEME.radius.xl,
    padding: THEME.spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  name: { ...THEME.typography.title, color: THEME.colors.text, marginTop: 12 },
  email: { color: THEME.colors.textSecondary, marginTop: 4 },
  editBtn: {
    marginTop: 16, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: THEME.radius.full, borderWidth: 1.5, borderColor: THEME.colors.accent,
  },
  editBtnText: { color: THEME.colors.accent, fontWeight: '700' },
  section: { ...THEME.typography.title, color: THEME.colors.text, marginTop: THEME.spacing.lg, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  shortcut: {
    width: '47%', backgroundColor: THEME.colors.card, borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md, alignItems: 'center', borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  shortcutIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: { marginTop: 8, fontWeight: '600', color: THEME.colors.text, fontSize: 13 },
  badge: {
    position: 'absolute', top: -4, right: -4, backgroundColor: THEME.colors.error,
    borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: THEME.spacing.xl, padding: 16,
  },
  logoutText: { color: THEME.colors.error, fontWeight: '700', fontSize: 16 },
});
