import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { updateProfile } from '../api';
import { appendImage } from '../utils/upload';
import ImageField from '../components/ImageField';
import { COLORS, TRANSPORT_OPTIONS } from '../config';

const ROLE_LABEL = { client: 'Client', merchant: 'Commerçant', driver: 'Livreur' };

export default function ProfileScreen() {
  const { user, updateUser, logoutUser } = useApp();
  const [form, setForm] = useState({
    name: user.name || '',
    phone: user.phone || '',
    address: user.address || '',
    transport: user.transport || 'Scooter',
  });
  const [photo,   setPhoto]   = useState(null);
  const [loading, setLoading] = useState(false);

  function set(field) { return (val) => setForm(f => ({ ...f, [field]: val })); }

  async function handleSave() {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('phone', form.phone.trim());
      if (user.role === 'client') fd.append('address', form.address.trim());
      if (user.role === 'driver') fd.append('transport', form.transport);
      if (photo) await appendImage(fd, photo, 'photo');

      const res = await updateProfile(fd);
      await updateUser(res.data.user);
      setPhoto(null);
      Alert.alert('Profil mis à jour', '');
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.error || 'Mise à jour impossible.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ImageField asset={photo} existingUrl={user.photo_url} onChange={setPhoto} circle />
      <Text style={styles.roleTag}>{ROLE_LABEL[user.role]}</Text>
      <Text style={styles.email}>{user.email}</Text>

      <Text style={styles.label}>Nom complet</Text>
      <TextInput style={styles.input} value={form.name} onChangeText={set('name')} />

      <Text style={styles.label}>Téléphone</Text>
      <TextInput style={styles.input} value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />

      {user.role === 'client' && (
        <>
          <Text style={styles.label}>Adresse</Text>
          <TextInput style={styles.input} value={form.address} onChangeText={set('address')} />
        </>
      )}

      {user.role === 'driver' && (
        <>
          <Text style={styles.label}>Moyen de transport</Text>
          <View style={styles.transportRow}>
            {TRANSPORT_OPTIONS.map(t => (
              <TouchableOpacity key={t} style={[styles.tBtn, form.transport === t && styles.tBtnActive]} onPress={() => set('transport')(t)}>
                <Text style={[styles.tText, form.transport === t && styles.tTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <TouchableOpacity style={styles.btn} onPress={handleSave} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Enregistrer</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={logoutUser}>
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 24 },
  roleTag: { textAlign: 'center', fontSize: 13, color: COLORS.secondary, fontWeight: '700', marginTop: 4 },
  email: { textAlign: 'center', fontSize: 14, color: COLORS.textLight, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: COLORS.card, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, padding: 14, fontSize: 15, marginBottom: 14 },
  transportRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.card },
  tBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  tText: { fontSize: 14, color: COLORS.text },
  tTextActive: { color: '#fff', fontWeight: '600' },
  btn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  logoutBtn: { marginTop: 16, alignItems: 'center', padding: 12 },
  logoutText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
});
