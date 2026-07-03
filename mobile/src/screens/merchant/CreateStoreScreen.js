import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, View } from 'react-native';
import { createStore, updateStore } from '../../api';
import { appendImage } from '../../utils/upload';
import ImageField from '../../components/ImageField';
import MapView from '../../components/MapView';
import { COLORS, STORE_CATEGORIES } from '../../config';

export default function CreateStoreScreen({ navigation, route }) {
  const editing = route.params?.store || null;

  const [form, setForm] = useState({
    name:        editing?.name || '',
    address:     editing?.address || '',
    description: editing?.description || '',
    story:       editing?.story || '',
    phone:       editing?.phone || '',
    email:       editing?.email || '',
    category:    editing?.category || 'Épicerie',
    lat:         editing?.lat != null ? String(editing.lat) : '',
    lng:         editing?.lng != null ? String(editing.lng) : '',
  });
  const [photo,   setPhoto]   = useState(null);
  const [loading, setLoading] = useState(false);

  function set(field) { return (val) => setForm(f => ({ ...f, [field]: val })); }

  async function handleSubmit() {
    if (!form.name || !form.address) {
      Alert.alert('Champs requis', "Le nom et l'adresse sont obligatoires.");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('address', form.address.trim());
      fd.append('description', form.description.trim());
      fd.append('story', form.story.trim());
      fd.append('phone', form.phone.trim());
      fd.append('email', form.email.trim());
      fd.append('category', form.category);
      if (form.lat) fd.append('lat', form.lat);
      if (form.lng) fd.append('lng', form.lng);
      if (photo) await appendImage(fd, photo, 'photo');

      if (editing) await updateStore(editing.id, fd);
      else await createStore(fd);

      navigation.goBack(); // fermeture auto (issue #1)
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.error || 'Enregistrement impossible.');
    } finally {
      setLoading(false);
    }
  }

  const latNum = parseFloat(form.lat);
  const lngNum = parseFloat(form.lng);

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{editing ? 'Modifier ma boutique' : 'Informations de votre boutique'}</Text>

      <Text style={styles.label}>Photo de la boutique</Text>
      <ImageField asset={photo} existingUrl={editing?.photo_url} onChange={setPhoto} />

      <Field label="Nom du commerce *" value={form.name} onChange={set('name')} placeholder="Ex: Épicerie du Marché" />
      <Field label="Adresse *" value={form.address} onChange={set('address')} placeholder="12 rue de la Paix, Paris" />

      <Text style={styles.label}>Nature du commerce</Text>
      <View style={styles.cats}>
        {STORE_CATEGORIES.map(c => (
          <TouchableOpacity key={c} style={[styles.catBtn, form.category === c && styles.catBtnActive]}
            onPress={() => set('category')(c)}>
            <Text style={[styles.catText, form.category === c && styles.catTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Field label="Description" value={form.description} onChange={set('description')} placeholder="Décrivez votre commerce..." multiline />

      <Field label="Histoire du commerce" value={form.story} onChange={set('story')}
        placeholder="Racontez votre histoire, vos valeurs, votre activité..." multiline />

      <Field label="Téléphone" value={form.phone} onChange={set('phone')} placeholder="01 xx xx xx xx" keyboard="phone-pad" />
      <Field label="Email" value={form.email} onChange={set('email')} placeholder="contact@moncommerce.fr" keyboard="email-address" lowercase />

      <Text style={styles.sectionLabel}>Coordonnées GPS (pour la carte et les distances)</Text>
      <View style={styles.gpsRow}>
        <View style={styles.gpsCol}>
          <Field label="Latitude" value={form.lat} onChange={set('lat')} placeholder="48.8566" keyboard="decimal-pad" />
        </View>
        <View style={styles.gpsCol}>
          <Field label="Longitude" value={form.lng} onChange={set('lng')} placeholder="2.3522" keyboard="decimal-pad" />
        </View>
      </View>

      {!isNaN(latNum) && !isNaN(lngNum) && (
        <View style={{ marginBottom: 16 }}>
          <MapView lat={latNum} lng={lngNum} label={form.name} height={160} />
        </View>
      )}

      <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{editing ? 'Enregistrer' : 'Créer ma boutique'}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({ label, value, onChange, placeholder, keyboard, lowercase, multiline }) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value} onChangeText={onChange} placeholder={placeholder}
        keyboardType={keyboard || 'default'}
        autoCapitalize={lowercase ? 'none' : 'sentences'}
        multiline={!!multiline} numberOfLines={multiline ? 3 : 1}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.primary, marginBottom: 20 },
  sectionLabel: { fontSize: 13, color: COLORS.textLight, marginBottom: 6, marginTop: 8 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: COLORS.card, borderRadius: 10, borderWidth: 1,
    borderColor: COLORS.border, padding: 14, fontSize: 15, marginBottom: 14,
  },
  inputMulti: { height: 90, textAlignVertical: 'top' },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  catBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.card,
  },
  catBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  catText: { fontSize: 13, color: COLORS.text },
  catTextActive: { color: '#fff', fontWeight: '600' },
  gpsRow: { flexDirection: 'row', gap: 12 },
  gpsCol: { flex: 1 },
  btn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 12 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
