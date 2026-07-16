import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import Avatar from '../../components/Avatar';
import { THEME } from '../../theme';

const MENU_ITEMS = [
  { id: 'favorites', icon: 'heart-outline', label: 'Mes commerces coups de cœur', screen: 'FavoriteStores' },
  { id: 'orders', icon: 'receipt-outline', label: 'Mes commandes', screen: 'OrderHistory' },
  { id: 'faq', icon: 'help-buoy-outline', label: 'FAQ', screen: 'Faq' },
  { id: 'becomeDriver', icon: 'bicycle-outline', label: 'Devenir livreur', screen: 'BecomeDriver' },
  { id: 'contact', icon: 'mail-outline', label: 'Contact', screen: 'Contact' },
  { id: 'help', icon: 'help-circle-outline', label: 'Aide', screen: 'HelpCenter' },
  { id: 'settings', icon: 'settings-outline', label: 'Paramètres', screen: 'Settings' },
];

export default function ClientDrawerContent({ navigation }) {
  const { user, logoutUser } = useApp();
  const insets = useSafeAreaInsets();

  function goTo(screen) {
    navigation.closeDrawer();
    navigation.navigate(screen);
  }

  function openIdentity() {
    navigation.closeDrawer();
    navigation.navigate('Identity');
  }

  return (
    <DrawerContentScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          <Avatar name={user.name} photoUrl={user.photo_url} role={user.role} size={64} />
          <TouchableOpacity
            style={styles.qrBadge}
            onPress={openIdentity}
            activeOpacity={0.85}
            accessibilityLabel="Ouvrir mon identité numérique"
          >
            <Ionicons name="qr-code" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.name}>{user.first_name || user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>

      <TouchableOpacity style={styles.profileCta} onPress={() => goTo('ProfileHub')} activeOpacity={0.88}>
        <Ionicons name="person-outline" size={20} color={THEME.colors.accent} />
        <Text style={styles.profileCtaText}>Mon profil</Text>
        <Ionicons name="chevron-forward" size={18} color={THEME.colors.textMuted} />
      </TouchableOpacity>

      <View style={styles.separator} />

      {MENU_ITEMS.map((item) => (
        <TouchableOpacity key={item.id} style={styles.item} onPress={() => goTo(item.screen)} activeOpacity={0.88}>
          <Ionicons name={item.icon} size={22} color={THEME.colors.textSecondary} />
          <Text style={styles.itemLabel}>{item.label}</Text>
        </TouchableOpacity>
      ))}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.logout} onPress={logoutUser} activeOpacity={0.88}>
          <Ionicons name="log-out-outline" size={20} color={THEME.colors.error} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: THEME.spacing.md, paddingBottom: 32 },
  header: { alignItems: 'center', paddingVertical: THEME.spacing.md },
  avatarWrap: { position: 'relative' },
  qrBadge: {
    position: 'absolute', right: -6, bottom: -2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: THEME.colors.accent,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: THEME.colors.bg,
  },
  name: { ...THEME.typography.title, color: THEME.colors.text, marginTop: 12 },
  email: { color: THEME.colors.textSecondary, marginTop: 4, fontSize: 14 },
  profileCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: THEME.colors.card, borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md, borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  profileCtaText: { flex: 1, fontWeight: '700', fontSize: 16, color: THEME.colors.text },
  separator: { height: 1, backgroundColor: THEME.colors.borderLight, marginVertical: THEME.spacing.md },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 4,
  },
  itemLabel: { fontSize: 16, color: THEME.colors.text, fontWeight: '500' },
  footer: { marginTop: 'auto', paddingTop: THEME.spacing.xl },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  logoutText: { color: THEME.colors.error, fontWeight: '700', fontSize: 16 },
});
