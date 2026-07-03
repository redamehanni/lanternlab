import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useApp } from '../../context/AppContext';
import Avatar from '../../components/Avatar';
import { euro } from '../../utils/format';
import { COLORS } from '../../config';

const MENU = [
  { key: 'profile',   icon: '👤', label: 'Profil',          screen: 'Profile' },
  { key: 'documents', icon: '📄', label: 'Mes documents' },
  { key: 'vehicle',   icon: '🛵', label: 'Mon véhicule' },
  { key: 'history',   icon: '🕑', label: 'Historique',      tab: 'Revenus' },
  { key: 'wallet',    icon: '💳', label: 'Wallet' },
  { key: 'settings',  icon: '⚙️', label: 'Paramètres' },
  { key: 'help',      icon: '❓', label: "Centre d'aide" },
  { key: 'support',   icon: '🎧', label: 'Support' },
];

export default function MenuScreen({ navigation }) {
  const { user, logoutUser } = useApp();

  function onPress(item) {
    if (item.screen) navigation.navigate(item.screen);
    else if (item.tab) navigation.navigate(item.tab);
    else Alert.alert(item.label, 'Fonctionnalité bientôt disponible.');
  }

  return (
    <ScrollView style={styles.bg} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.profileCard}>
        <Avatar name={user.name} photoUrl={user.photo_url} role="driver" size={64} />
        <View style={{ marginLeft: 14, flex: 1 }}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.sub}>{user.transport || 'Livreur'} · ⭐ 5,0</Text>
        </View>
      </View>

      <View style={styles.list}>
        {MENU.map((item, i) => (
          <TouchableOpacity key={item.key} style={[styles.item, i < MENU.length - 1 && styles.itemBorder]} onPress={() => onPress(item)}>
            <Text style={styles.itemIcon}>{item.icon}</Text>
            <Text style={styles.itemLabel}>{item.label}</Text>
            <Text style={styles.itemArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logout} onPress={logoutUser}>
        <Text style={styles.logoutText}>🚪 Déconnexion</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 16 },
  name: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  sub: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  list: { backgroundColor: COLORS.card, borderRadius: 14, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  itemIcon: { fontSize: 18, width: 30 },
  itemLabel: { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: '600' },
  itemArrow: { fontSize: 22, color: COLORS.textLight },
  logout: { marginTop: 20, backgroundColor: '#fee2e2', borderRadius: 12, padding: 16, alignItems: 'center' },
  logoutText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
});
