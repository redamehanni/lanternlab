import React, { useState } from 'react';
import {
  ScrollView, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, View,
} from 'react-native';
import { createProduct, updateProduct } from '../../api';
import { appendImage } from '../../utils/upload';
import ImageField from '../../components/ImageField';
import { COLORS, PRODUCT_CATEGORIES } from '../../config';

export default function AddProductScreen({ navigation, route }) {
  const editing = route.params?.product || null;

  const [form, setForm] = useState({
    name:        editing?.name || '',
    description: editing?.description || '',
    price:       editing ? String(editing.price) : '',
    quantity:    editing ? String(editing.quantity) : '',
    category:    editing?.category || 'Alimentation',
    barcode:     editing?.barcode || '',
  });
  const [image,   setImage]   = useState(null);
  const [loading, setLoading] = useState(false);

  function set(field) { return (val) => setForm(f => ({ ...f, [field]: val })); }

  async function handleSubmit() {
    if (!form.name || !form.price) {
      Alert.alert('Champs requis', 'Le nom et le prix sont obligatoires.');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('description', form.description.trim());
      fd.append('price', form.price.replace(',', '.'));
      fd.append('quantity', form.quantity || '0');
      fd.append('category', form.category);
      if (form.barcode) fd.append('barcode', form.barcode.trim());
      if (image) await appendImage(fd, image, 'image');

      if (editing) {
        await updateProduct(editing.id, fd);
      } else {
        await createProduct(fd);
      }

      // Fermeture automatique du formulaire (issue #1)
      navigation.goBack();
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.error || "Impossible d'enregistrer le produit.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{editing ? 'Modifier le produit' : 'Nouveau produit'}</Text>

      <Text style={styles.label}>Photo du produit</Text>
      <ImageField asset={image} existingUrl={editing?.image_url} onChange={setImage} />

      <Text style={styles.label}>Code-barres (optionnel)</Text>
      <TextInput style={styles.input} value={form.barcode} onChangeText={set('barcode')}
        placeholder="Scanner ou saisir le code" keyboardType="numeric" />

      <Text style={styles.label}>Nom du produit *</Text>
      <TextInput style={styles.input} value={form.name} onChangeText={set('name')} placeholder="Ex: Coca-Cola 33cl" />

      <Text style={styles.label}>Description</Text>
      <TextInput style={[styles.input, styles.inputMulti]} value={form.description} onChangeText={set('description')}
        placeholder="Décrivez le produit..." multiline numberOfLines={3} />

      <Text style={styles.label}>Prix (€) *</Text>
      <TextInput style={styles.input} value={form.price} onChangeText={set('price')} placeholder="1.50" keyboardType="decimal-pad" />

      <Text style={styles.label}>Quantité en stock</Text>
      <TextInput style={styles.input} value={form.quantity} onChangeText={set('quantity')} placeholder="0" keyboardType="numeric" />

      <Text style={styles.label}>Catégorie</Text>
      <View style={styles.categories}>
        {PRODUCT_CATEGORIES.map(cat => (
          <TouchableOpacity key={cat}
            style={[styles.catBtn, form.category === cat && styles.catBtnActive]}
            onPress={() => set('category')(cat)}>
            <Text style={[styles.catText, form.category === cat && styles.catTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{editing ? 'Enregistrer' : 'Ajouter le produit'}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.primary, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: COLORS.card, borderRadius: 10, borderWidth: 1,
    borderColor: COLORS.border, padding: 14, fontSize: 15, marginBottom: 14,
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  catBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.card,
  },
  catBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  catText: { fontSize: 13, color: COLORS.text },
  catTextActive: { color: '#fff', fontWeight: '600' },
  btn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
