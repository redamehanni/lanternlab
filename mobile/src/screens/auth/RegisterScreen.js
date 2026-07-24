import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useApp } from '../../context/AppContext';
import { register, updateProfile } from '../../api';
import { appendImage } from '../../utils/upload';
import ImageField from '../../components/ImageField';
import { COLORS, TRANSPORT_OPTIONS } from '../../config';

export default function RegisterScreen({ route }) {
  const role = route.params?.role || 'client';
  const { loginUser, updateUser } = useApp();

  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '', address: '', transport: 'Scooter',
  });
  const [photo, setPhoto]     = useState(null);
  const [loading, setLoading] = useState(false);

  function set(field) { return (val) => setForm(f => ({ ...f, [field]: val })); }

  async function handleRegister() {
    if (!form.name || !form.email || !form.password) {
      Alert.alert('Champs requis', 'Nom, email et mot de passe sont obligatoires.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name:      form.name.trim(),
        email:     form.email.trim().toLowerCase(),
        password:  form.password,
        phone:     form.phone.trim() || undefined,
        role,
        address:   role === 'client' ? form.address.trim() || undefined : undefined,
        transport: role === 'driver' ? form.transport : undefined,
      };
      const res = await register(payload);

      // Photo de profil (issue #14) — envoyée après création du compte
      if (photo) {
        try {
          await appStorageSetToken(res.data.token);
          const fd = new FormData();
          await appendImage(fd, photo, 'photo');
          const up = await updateProfile(fd);
          res.data.user.photo_url = up.data.user.photo_url;
        } catch { /* photo non bloquante */ }
      }

      await loginUser(res.data.user, res.data.token);
    } catch (err) {
      const offline = !err.response;
      Alert.alert(
        'Erreur',
        err.response?.data?.error
          || (offline
            ? 'Serveur injoignable. Vérifiez que le backend tourne (port 4000) puis relancez l’app.'
            : 'Inscription impossible.'),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Créer un compte</Text>

      <ImageField asset={photo} onChange={setPhoto} circle label="Photo de profil" />

      <Field label="Nom complet *" value={form.name} onChange={set('name')} placeholder="Jean Dupont" />
      <Field label="Email *" value={form.email} onChange={set('email')} placeholder="votre@email.com" keyboard="email-address" lowercase />
      <Field label="Mot de passe *" value={form.password} onChange={set('password')} placeholder="Minimum 6 caractères" secure />
      <Field label="Téléphone" value={form.phone} onChange={set('phone')} placeholder="06 xx xx xx xx" keyboard="phone-pad" />

      {role === 'client' && (
        <Field label="Adresse de livraison" value={form.address} onChange={set('address')} placeholder="12 rue de la Paix, Paris" />
      )}

      {role === 'driver' && (
        <>
          <Text style={styles.label}>Moyen de transport</Text>
          <View style={styles.transportRow}>
            {TRANSPORT_OPTIONS.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.transportBtn, form.transport === t && styles.transportBtnActive]}
                onPress={() => set('transport')(t)}
              >
                <Text style={[styles.transportText, form.transport === t && styles.transportTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Créer mon compte</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({ label, value, onChange, placeholder, keyboard, secure, lowercase }) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={keyboard || 'default'}
        secureTextEntry={!!secure}
        autoCapitalize={lowercase ? 'none' : 'words'}
        autoCorrect={false}
      />
    </>
  );
}

// Le token n'est pas encore dans le storage au moment de l'upload photo :
// on l'écrit temporairement pour que l'intercepteur axios l'utilise.
async function appStorageSetToken(token) {
  const { appStorage } = require('../../utils/storage');
  await appStorage.setItem('token', token);
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 24, paddingTop: 20 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.primary, marginBottom: 18 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: COLORS.card, borderRadius: 10, borderWidth: 1,
    borderColor: COLORS.border, padding: 14, fontSize: 15, marginBottom: 14,
  },
  transportRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  transportBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.card,
  },
  transportBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  transportText: { fontSize: 14, color: COLORS.text },
  transportTextActive: { color: '#fff', fontWeight: '600' },
  btn: {
    backgroundColor: COLORS.primary, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 8, marginBottom: 32,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
