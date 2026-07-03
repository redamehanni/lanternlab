import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Image } from 'react-native';
import { COLORS } from '../config';

const ROLES = [
  { key: 'client',   label: 'Client',      icon: '🛍️',  desc: 'Recherchez et commandez des produits' },
  { key: 'merchant', label: 'Commerçant',  icon: '🏪',  desc: 'Gérez votre boutique et vos produits' },
  { key: 'driver',   label: 'Livreur',     icon: '🛵',  desc: 'Acceptez et effectuez des livraisons' },
];

export default function RoleSelectScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>Ma Zone</Text>
          <Text style={styles.subtitle}>Livraison en moins d'une heure</Text>
        </View>

        <Text style={styles.question}>Je suis...</Text>

        {ROLES.map((role) => (
          <TouchableOpacity
            key={role.key}
            style={styles.roleCard}
            onPress={() => navigation.navigate('Login', { role: role.key })}
            activeOpacity={0.85}
          >
            <Text style={styles.roleIcon}>{role.icon}</Text>
            <View style={styles.roleInfo}>
              <Text style={styles.roleLabel}>{role.label}</Text>
              <Text style={styles.roleDesc}>{role.desc}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 42, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.7)', marginTop: 6 },
  question: { fontSize: 18, color: 'rgba(255,255,255,0.8)', marginBottom: 16, fontWeight: '600' },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  roleIcon: { fontSize: 32, marginRight: 14 },
  roleInfo: { flex: 1 },
  roleLabel: { fontSize: 17, fontWeight: '700', color: COLORS.primary },
  roleDesc: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  arrow: { fontSize: 28, color: COLORS.textLight },
});
