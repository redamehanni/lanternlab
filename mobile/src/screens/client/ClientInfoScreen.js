import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { getAddresses, addAddress, deleteAddress, updateProfile } from '../../api';
import ImageField from '../../components/ImageField';
import ComingSoonButton from '../../components/ui/ComingSoonButton';
import { appendImage } from '../../utils/upload';
import { THEME } from '../../theme';

export default function ClientInfoScreen() {
  const { user, updateUser } = useApp();
  const [form, setForm] = useState({
    first_name: user.first_name || user.name?.split(' ')[0] || '',
    last_name: user.last_name || user.name?.split(' ').slice(1).join(' ') || '',
    phone: user.phone || '',
    address: user.address || '',
  });
  const [addresses, setAddresses] = useState([]);
  const [newAddr, setNewAddr] = useState({ label: '', address: '' });
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getAddresses().then((r) => setAddresses(r.data.addresses || [])).catch(() => {});
  }, []);

  function set(field) { return (v) => setForm((f) => ({ ...f, [field]: v })); }

  async function handleSave() {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('first_name', form.first_name.trim());
      fd.append('last_name', form.last_name.trim());
      fd.append('name', `${form.first_name} ${form.last_name}`.trim());
      fd.append('phone', form.phone.trim());
      fd.append('address', form.address.trim());
      if (photo) await appendImage(fd, photo, 'photo');
      const res = await updateProfile(fd);
      await updateUser(res.data.user);
      Alert.alert('Profil mis à jour');
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.error || 'Mise à jour impossible.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddAddress() {
    if (!newAddr.address.trim()) return;
    const res = await addAddress(newAddr);
    setAddresses((a) => [res.data.address, ...a]);
    setNewAddr({ label: '', address: '' });
  }

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Vos informations</Text>
      <Text style={styles.email}>{user.email}</Text>

      <ImageField asset={photo} existingUrl={user.photo_url} onChange={setPhoto} circle />

      <Text style={styles.label}>Prénom</Text>
      <TextInput style={styles.input} value={form.first_name} onChangeText={set('first_name')} />

      <Text style={styles.label}>Nom</Text>
      <TextInput style={styles.input} value={form.last_name} onChangeText={set('last_name')} />

      <Text style={styles.label}>Téléphone</Text>
      <TextInput style={styles.input} value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />

      <Text style={styles.label}>Adresse principale</Text>
      <TextInput style={styles.input} value={form.address} onChangeText={set('address')} />

      <Text style={styles.section}>Adresses enregistrées</Text>
      {addresses.map((a) => (
        <View key={a.id} style={[styles.addrCard, THEME.shadow.sm]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.addrLabel}>{a.label}</Text>
            <Text style={styles.addrText}>{a.address}</Text>
          </View>
          <TouchableOpacity onPress={() => deleteAddress(a.id).then(() => setAddresses((x) => x.filter((i) => i.id !== a.id)))}>
            <Text style={styles.delete}>Suppr.</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TextInput style={styles.input} placeholder="Libellé (ex: Bureau)" value={newAddr.label} onChangeText={(v) => setNewAddr((a) => ({ ...a, label: v }))} />
      <TextInput style={styles.input} placeholder="Nouvelle adresse" value={newAddr.address} onChangeText={(v) => setNewAddr((a) => ({ ...a, address: v }))} />
      <TouchableOpacity style={styles.addBtn} onPress={handleAddAddress}>
        <Text style={styles.addBtnText}>+ Ajouter une adresse</Text>
      </TouchableOpacity>

      <Text style={styles.section}>Moyens de paiement</Text>
      <ComingSoonButton label="Ajouter une carte bancaire" icon="💳" />
      <ComingSoonButton label="Apple Pay" icon="🍎" />

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Enregistrer</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { padding: THEME.spacing.lg, paddingBottom: 100 },
  title: { ...THEME.typography.hero, fontSize: 28, color: THEME.colors.text },
  email: { color: THEME.colors.textSecondary, marginBottom: THEME.spacing.md },
  label: { fontSize: 13, fontWeight: '700', color: THEME.colors.textSecondary, marginBottom: 6, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: THEME.colors.card, borderRadius: THEME.radius.md, borderWidth: 1,
    borderColor: THEME.colors.border, padding: 14, fontSize: 15, marginBottom: 8,
  },
  section: { ...THEME.typography.title, color: THEME.colors.text, marginTop: 24, marginBottom: 12 },
  addrCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.md, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  addrLabel: { fontWeight: '700', color: THEME.colors.text },
  addrText: { color: THEME.colors.textSecondary, marginTop: 2 },
  delete: { color: THEME.colors.error, fontWeight: '600' },
  addBtn: { alignItems: 'center', padding: 12, marginBottom: 8 },
  addBtnText: { color: THEME.colors.accent, fontWeight: '700' },
  saveBtn: {
    backgroundColor: THEME.colors.primary, borderRadius: THEME.radius.md,
    padding: 18, alignItems: 'center', marginTop: 24,
  },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
