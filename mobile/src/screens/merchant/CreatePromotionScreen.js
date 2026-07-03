import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { getMyStore, getStoreProducts, createPromotion } from '../../api';
import { euro } from '../../utils/format';
import { useToast } from '../../components/ui/Toast';
import { THEME } from '../../theme';

export default function CreatePromotionScreen({ navigation, route }) {
  const toast = useToast();
  const preselectedProduct = route.params?.product;
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(preselectedProduct || null);
  const [type, setType] = useState('discount');
  const [discountPercent, setDiscountPercent] = useState('10');
  const [buyQty, setBuyQty] = useState('2');
  const [getQty, setGetQty] = useState('1');
  const [maxQty, setMaxQty] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const storeRes = await getMyStore();
      if (!storeRes.data.store) return;
      const prodRes = await getStoreProducts(storeRes.data.store.id);
      setProducts(prodRes.data.products || []);
    })();
  }, []);

  const previewPrice = selected && type === 'discount'
    ? Math.round(selected.price * (1 - parseFloat(discountPercent || 0) / 100) * 100) / 100
    : null;

  async function handleCreate() {
    if (!selected) return Alert.alert('Produit requis', 'Sélectionnez un produit.');
    setLoading(true);
    try {
      await createPromotion({
        product_id: selected.id,
        type,
        discount_percent: type === 'discount' ? parseFloat(discountPercent) : undefined,
        buy_quantity: type === 'buy_get' ? parseInt(buyQty, 10) : undefined,
        get_quantity: type === 'buy_get' ? parseInt(getQty, 10) : undefined,
        max_quantity: maxQty ? parseInt(maxQty, 10) : undefined,
        ends_at: endsAt || undefined,
      });
      toast('Promotion créée avec succès');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.error || 'Création impossible.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Lancer une promotion</Text>

      <Text style={styles.label}>Type de promotion</Text>
      <View style={styles.typeRow}>
        <TouchableOpacity style={[styles.typeBtn, type === 'discount' && styles.typeBtnActive]} onPress={() => setType('discount')}>
          <Text style={[styles.typeBtnText, type === 'discount' && styles.typeBtnTextActive]}>Remise %</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.typeBtn, type === 'buy_get' && styles.typeBtnActive]} onPress={() => setType('buy_get')}>
          <Text style={[styles.typeBtnText, type === 'buy_get' && styles.typeBtnTextActive]}>Article offert</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Produit</Text>
      {products.map((p) => (
        <TouchableOpacity
          key={p.id}
          style={[styles.prodItem, selected?.id === p.id && styles.prodItemActive]}
          onPress={() => setSelected(p)}
        >
          <Text style={styles.prodName}>{p.name}</Text>
          <Text style={styles.prodPrice}>{euro(p.price)}</Text>
        </TouchableOpacity>
      ))}

      {type === 'discount' && (
        <>
          <Text style={styles.label}>Pourcentage de réduction</Text>
          <TextInput style={styles.input} value={discountPercent} onChangeText={setDiscountPercent} keyboardType="numeric" placeholder="ex: 20" />
          {previewPrice != null && selected && (
            <View style={styles.preview}>
              <Text style={styles.previewOld}>{euro(selected.price)}</Text>
              <Text style={styles.previewNew}>{euro(previewPrice)}</Text>
            </View>
          )}
        </>
      )}

      {type === 'buy_get' && (
        <>
          <Text style={styles.label}>Quantité achetée (Y)</Text>
          <TextInput style={styles.input} value={buyQty} onChangeText={setBuyQty} keyboardType="numeric" />
          <Text style={styles.label}>Quantité offerte (X)</Text>
          <TextInput style={styles.input} value={getQty} onChangeText={setGetQty} keyboardType="numeric" />
          <Text style={styles.hint}>Ex : {getQty} offert pour {buyQty} achetés</Text>
        </>
      )}

      <Text style={styles.label}>Nombre max d'articles (optionnel)</Text>
      <TextInput style={styles.input} value={maxQty} onChangeText={setMaxQty} keyboardType="numeric" placeholder="ex: 50" />

      <Text style={styles.label}>Date de fin (optionnel)</Text>
      <TextInput style={styles.input} value={endsAt} onChangeText={setEndsAt} placeholder="YYYY-MM-DD HH:MM" />

      <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Créer la promotion</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { padding: THEME.spacing.md, paddingBottom: 60 },
  title: { ...THEME.typography.hero, fontSize: 24, color: THEME.colors.text, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: THEME.colors.textSecondary, marginTop: 12, marginBottom: 6, textTransform: 'uppercase' },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: THEME.colors.border, alignItems: 'center' },
  typeBtnActive: { borderColor: THEME.colors.primary, backgroundColor: THEME.colors.primary },
  typeBtnText: { fontWeight: '700', color: THEME.colors.text },
  typeBtnTextActive: { color: '#fff' },
  prodItem: {
    flexDirection: 'row', justifyContent: 'space-between', padding: 14,
    backgroundColor: THEME.colors.card, borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  prodItemActive: { borderColor: THEME.colors.accent, backgroundColor: THEME.colors.accentSoft },
  prodName: { fontWeight: '600', color: THEME.colors.text },
  prodPrice: { color: THEME.colors.accent, fontWeight: '700' },
  input: {
    backgroundColor: THEME.colors.card, borderRadius: 12, borderWidth: 1,
    borderColor: THEME.colors.border, padding: 14, fontSize: 15,
  },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  previewOld: { fontSize: 16, color: THEME.colors.textMuted, textDecorationLine: 'line-through' },
  previewNew: { fontSize: 22, fontWeight: '900', color: THEME.colors.text },
  hint: { fontSize: 13, color: THEME.colors.textSecondary, marginTop: 4 },
  submitBtn: {
    backgroundColor: THEME.colors.primary, borderRadius: 14, padding: 18,
    alignItems: 'center', marginTop: 24,
  },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
