import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useApp } from '../../context/AppContext';
import Avatar from '../../components/Avatar';
import { THEME } from '../../theme';

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || '—'}</Text>
    </View>
  );
}

export default function DriverInfoScreen() {
  const { user } = useApp();
  const parts = (user.name || '').split(' ');
  const firstName = user.first_name || parts[0] || '—';
  const lastName = user.last_name || parts.slice(1).join(' ') || '—';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.photoWrap}>
        <Avatar name={user.name} photoUrl={user.photo_url} role="driver" size={88} />
      </View>
      <Row label="Prénom" value={firstName} />
      <Row label="Nom" value={lastName} />
      <Row label="Téléphone" value={user.phone} />
      <Row label="Email" value={user.email} />
      <Row label="Véhicule" value={user.transport} />
      <Row label="Plaque" value={user.vehicle_plate} />
      <Row label="Adresse" value={user.address} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { padding: THEME.spacing.lg },
  photoWrap: { alignItems: 'center', marginBottom: THEME.spacing.lg },
  row: {
    backgroundColor: THEME.colors.card, borderRadius: THEME.radius.md,
    padding: THEME.spacing.md, marginBottom: 8, borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  rowLabel: { fontSize: 12, color: THEME.colors.textMuted, marginBottom: 4 },
  rowValue: { fontSize: 16, fontWeight: '600', color: THEME.colors.text },
});
