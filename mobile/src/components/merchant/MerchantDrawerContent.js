import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import Avatar from '../../components/Avatar';
import { getMyStore } from '../../api';
import { getModulesByFamily, isUnlocked } from '../../epee/moduleRegistry';
import { THEME } from '../../theme';

/**
 * Menu latéral de l'Épée — surface de navigation.
 *
 * Il lit le registre de modules et les présente par famille. Il n'ajoute aucune
 * règle métier : un module verrouillé (capacité manquante) ou « à venir » est
 * simplement présenté comme tel et pointe, sinon, vers l'écran de son organe.
 */
export default function MerchantDrawerContent({ navigation }) {
  const { user, logoutUser } = useApp();
  const insets = useSafeAreaInsets();
  const [store, setStore] = useState(null);

  useEffect(() => {
    let alive = true;
    getMyStore()
      .then((res) => { if (alive) setStore(res.data.store || null); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const entitlements = { store: !!store };
  const families = getModulesByFamily({ includeComingSoon: true });

  function open(route) {
    navigation.closeDrawer();
    navigation.navigate('EpeeMain', { screen: route });
  }

  return (
    <DrawerContentScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Avatar name={user.name} photoUrl={user.photo_url} role={user.role} size={60} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name} numberOfLines={1}>{store ? store.name : user.name}</Text>
          <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.profileCta} onPress={() => open('Profile')} activeOpacity={0.88}>
        <Ionicons name="person-outline" size={20} color={THEME.colors.accent} />
        <Text style={styles.profileCtaText}>Mon profil</Text>
        <Ionicons name="chevron-forward" size={18} color={THEME.colors.textMuted} />
      </TouchableOpacity>

      {families.map((family) => (
        <View key={family.id} style={styles.familyBlock}>
          <Text style={styles.familyLabel}>{family.label}</Text>
          {family.modules.map((m) => {
            const unlocked = isUnlocked(m, entitlements);
            const disabled = m.comingSoon || !unlocked;
            return (
              <TouchableOpacity
                key={m.id}
                style={styles.item}
                onPress={() => !disabled && open(m.route)}
                activeOpacity={disabled ? 1 : 0.85}
                disabled={disabled}
              >
                <Ionicons
                  name={m.icon}
                  size={22}
                  color={disabled ? THEME.colors.textMuted : THEME.colors.textSecondary}
                />
                <Text style={[styles.itemLabel, disabled && styles.itemLabelDisabled]}>{m.label}</Text>
                {m.comingSoon ? (
                  <View style={styles.soonPill}><Text style={styles.soonText}>Bientôt</Text></View>
                ) : !unlocked ? (
                  <Ionicons name="lock-closed" size={15} color={THEME.colors.textMuted} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: THEME.spacing.md },
  name: { ...THEME.typography.subtitle, fontSize: 17, color: THEME.colors.text },
  email: { color: THEME.colors.textSecondary, marginTop: 2, fontSize: 13 },
  profileCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: THEME.colors.card, borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md, borderWidth: 1, borderColor: THEME.colors.borderLight,
    marginBottom: THEME.spacing.sm,
  },
  profileCtaText: { flex: 1, fontWeight: '700', fontSize: 16, color: THEME.colors.text },
  familyBlock: { marginTop: THEME.spacing.md },
  familyLabel: {
    ...THEME.typography.micro, color: THEME.colors.textMuted,
    textTransform: 'uppercase', marginBottom: 4, paddingHorizontal: 4,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 4 },
  itemLabel: { flex: 1, fontSize: 16, color: THEME.colors.text, fontWeight: '500' },
  itemLabelDisabled: { color: THEME.colors.textMuted },
  soonPill: {
    backgroundColor: THEME.colors.borderLight, borderRadius: THEME.radius.full,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  soonText: { ...THEME.typography.micro, color: THEME.colors.textMuted },
  footer: { marginTop: 'auto', paddingTop: THEME.spacing.xl },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  logoutText: { color: THEME.colors.error, fontWeight: '700', fontSize: 16 },
});
