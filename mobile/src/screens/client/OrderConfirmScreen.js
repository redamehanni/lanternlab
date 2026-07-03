import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, TextInput, Image,
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { createOrder, getAddresses, addAddress } from '../../api';
import { imageUrl, euro } from '../../utils/format';
import { COLORS } from '../../config';

export default function OrderConfirmScreen({ navigation, route }) {
  const { user } = useApp();
  const { product } = route.params;

  // mode : 'current' (position actuelle / adresse du profil) | 'saved' | 'new'
  const [mode, setMode]         = useState('current');
  const [addresses, setAddresses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [newLabel, setNewLabel] = useState('');
  const [newAddr, setNewAddr]   = useState('');
  const [loading, setLoading]   = useState(false);

  const loadAddresses = useCallback(async () => {
    try {
      const res = await getAddresses();
      setAddresses(res.data.addresses || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadAddresses(); }, [loadAddresses]);

  function resolveAddress() {
    if (mode === 'current') return user.address || 'Position actuelle';
    if (mode === 'saved') {
      const a = addresses.find(x => x.id === selectedId);
      return a?.address || null;
    }
    if (mode === 'new') return newAddr.trim() || null;
    return null;
  }

  async function handleOrder() {
    const address = resolveAddress();
    if (!address) {
      Alert.alert('Adresse requise', 'Sélectionnez ou saisissez une adresse de livraison.');
      return;
    }
    setLoading(true);
    try {
      // Enregistrer la nouvelle adresse si demandé
      if (mode === 'new' && newAddr.trim()) {
        try { await addAddress({ label: newLabel.trim() || 'Adresse', address: newAddr.trim() }); } catch {}
      }
      const res = await createOrder({ product_id: product.id, quantity: 1, delivery_address: address });
      navigation.replace('OrderTracking', { orderId: res.data.order.id });
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.error || 'Commande impossible.');
    } finally {
      setLoading(false);
    }
  }

  const store = product.store || { name: product.store_name };

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Récapitulatif</Text>

      <View style={styles.card}>
        {product.image_url ? <Image source={{ uri: imageUrl(product.image_url) }} style={styles.img} /> : null}
        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.storeName}>{store.name}</Text>
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>Total</Text>
        <Text style={styles.price}>{euro(product.price)}</Text>
      </View>

      {/* Choix d'adresse (issue #9) */}
      <Text style={styles.label}>Adresse de livraison</Text>

      <Option selected={mode === 'current'} onPress={() => setMode('current')}
        title="Utiliser ma position actuelle" subtitle={user.address || 'Adresse de votre profil'} />

      <Option selected={mode === 'saved'} onPress={() => setMode('saved')}
        title="Utiliser une adresse enregistrée"
        subtitle={addresses.length ? `${addresses.length} adresse(s)` : 'Aucune adresse enregistrée'} />

      {mode === 'saved' && (
        <View style={styles.savedList}>
          {addresses.length === 0 ? (
            <Text style={styles.noAddr}>Aucune adresse. Ajoutez-en une ci-dessous.</Text>
          ) : addresses.map(a => (
            <TouchableOpacity key={a.id}
              style={[styles.savedItem, selectedId === a.id && styles.savedItemActive]}
              onPress={() => setSelectedId(a.id)}>
              <Text style={styles.savedLabel}>{a.label}</Text>
              <Text style={styles.savedAddr}>{a.address}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Option selected={mode === 'new'} onPress={() => setMode('new')}
        title="Ajouter une nouvelle adresse" subtitle="Sera enregistrée dans votre carnet" />

      {mode === 'new' && (
        <View style={styles.newBox}>
          <TextInput style={styles.input} value={newLabel} onChangeText={setNewLabel} placeholder="Libellé (Maison, Bureau...)" />
          <TextInput style={styles.input} value={newAddr} onChangeText={setNewAddr} placeholder="Adresse complète" />
        </View>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Un livreur sera automatiquement assigné. Le temps de livraison estimé s'affichera dès la validation.
        </Text>
      </View>

      <TouchableOpacity style={styles.btn} onPress={handleOrder} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Confirmer la commande</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

function Option({ selected, onPress, title, subtitle }) {
  return (
    <TouchableOpacity style={[styles.option, selected && styles.optionActive]} onPress={onPress}>
      <View style={[styles.radio, selected && styles.radioActive]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.optTitle}>{title}</Text>
        <Text style={styles.optSub}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 20 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.primary, marginBottom: 16 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 12, alignItems: 'center' },
  img: { width: 90, height: 90, borderRadius: 10, resizeMode: 'cover', marginBottom: 10 },
  productName: { fontSize: 17, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  storeName: { fontSize: 14, color: COLORS.textLight, marginTop: 4 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, padding: 16, marginBottom: 16 },
  priceLabel: { fontSize: 15, color: COLORS.text, fontWeight: '600' },
  price: { fontSize: 22, fontWeight: '900', color: COLORS.primary },
  label: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  option: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card,
    borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1.5, borderColor: COLORS.border,
  },
  optionActive: { borderColor: COLORS.primary },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.border, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: COLORS.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  optTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  optSub: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  savedList: { marginBottom: 8, marginLeft: 8 },
  noAddr: { color: COLORS.textLight, fontSize: 13, paddingVertical: 6 },
  savedItem: { backgroundColor: COLORS.card, borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1.5, borderColor: COLORS.border },
  savedItemActive: { borderColor: COLORS.success },
  savedLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  savedAddr: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  newBox: { marginBottom: 8 },
  input: { backgroundColor: COLORS.card, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, padding: 13, fontSize: 15, marginBottom: 8 },
  infoBox: { backgroundColor: '#eff6ff', borderRadius: 10, padding: 12, marginVertical: 12 },
  infoText: { fontSize: 13, color: '#1d4ed8', lineHeight: 20 },
  btn: { backgroundColor: COLORS.success, borderRadius: 14, padding: 18, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
