import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Image, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { getMyStore, getStoreProducts, updateProductStock, deleteProduct } from '../../api';
import { imageUrl, euro } from '../../utils/format';
import PriceTag from '../../components/ui/PriceTag';
import PromoBadge from '../../components/ui/PromoBadge';
import { confirmAction } from '../../utils/confirm';
import { COLORS } from '../../config';

export default function ManageStockScreen({ navigation }) {
  const { socket } = useApp();
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [refresh,  setRefresh]  = useState(false);
  const [updating, setUpdating] = useState({});

  const load = useCallback(async () => {
    try {
      const storeRes = await getMyStore();
      if (!storeRes.data.store) { setProducts([]); return; }
      const prodRes = await getStoreProducts(storeRes.data.store.id);
      setProducts(prodRes.data.products || []);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les produits.');
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!socket) return;
    const onStock = ({ productId, quantity }) =>
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, quantity } : p));
    socket.on('product:stock_updated', onStock);
    return () => socket.off('product:stock_updated', onStock);
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => load();
    socket.on('promotion:created', refresh);
    socket.on('promotion:updated', refresh);
    socket.on('promotion:deleted', refresh);
    return () => {
      socket.off('promotion:created', refresh);
      socket.off('promotion:updated', refresh);
      socket.off('promotion:deleted', refresh);
    };
  }, [socket, load]);

  async function adjust(product, delta) {
    if (updating[product.id]) return;
    setUpdating(u => ({ ...u, [product.id]: true }));
    try {
      await updateProductStock(product.id, delta);
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, quantity: Math.max(0, p.quantity + delta) } : p));
    } catch {
      Alert.alert('Erreur', 'Mise à jour impossible.');
    } finally {
      setUpdating(u => ({ ...u, [product.id]: false }));
    }
  }

  function handleDelete(product) {
    confirmAction(
      'Supprimer le produit',
      `Êtes-vous sûr de vouloir supprimer "${product.name}" ?`,
      async () => {
        try {
          await deleteProduct(product.id);
          setProducts(prev => prev.filter(p => p.id !== product.id));
        } catch {
          Alert.alert('Erreur', 'Suppression impossible.');
        }
      },
      'Supprimer'
    );
  }

  if (loading) return <ActivityIndicator style={styles.center} size="large" color={COLORS.primary} />;

  return (
    <FlatList
      style={styles.bg}
      data={products}
      keyExtractor={p => p.id}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} />}
      ListEmptyComponent={<Text style={styles.empty}>Aucun produit. Ajoutez-en depuis le tableau de bord.</Text>}
      ListHeaderComponent={
        <TouchableOpacity style={styles.promoHeaderBtn} onPress={() => navigation.navigate('CreatePromotion')}>
          <Text style={styles.promoHeaderText}>🏷️ Lancer une promotion</Text>
        </TouchableOpacity>
      }
      contentContainerStyle={{ padding: 16 }}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.row}>
            {item.image_url ? (
              <Image source={{ uri: imageUrl(item.image_url) }} style={styles.img} />
            ) : (
              <View style={[styles.img, styles.noImg]}><Text style={{ fontSize: 28 }}>📦</Text></View>
            )}
            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                {(item.promo_price || item.promo_label) && (
                  <PromoBadge discountPercent={item.discount_percent} label={item.promo_label} small />
                )}
              </View>
              {item.promo_price ? (
                <PriceTag price={item.price} promoPrice={item.promo_price} />
              ) : (
                <Text style={styles.price}>{euro(item.price)}</Text>
              )}
              <Text style={styles.cat}>{item.category || '—'}</Text>
            </View>
          </View>

          <View style={styles.stockRow}>
            <TouchableOpacity style={[styles.stockBtn, { backgroundColor: '#ef4444' }]}
              onPress={() => adjust(item, -1)} disabled={item.quantity === 0 || !!updating[item.id]}>
              <Text style={styles.stockBtnText}>−</Text>
            </TouchableOpacity>

            <View style={[styles.stockBadge, item.quantity === 0 && styles.stockBadgeEmpty]}>
              {updating[item.id]
                ? <ActivityIndicator size="small" color={COLORS.primary} />
                : <Text style={[styles.stockQty, item.quantity === 0 && { color: '#ef4444' }]}>{item.quantity}</Text>}
              <Text style={styles.stockUnit}>en stock</Text>
            </View>

            <TouchableOpacity style={[styles.stockBtn, { backgroundColor: COLORS.success }]}
              onPress={() => adjust(item, +1)} disabled={!!updating[item.id]}>
              <Text style={styles.stockBtnText}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.stockBtn, { backgroundColor: '#6366f1', marginLeft: 4 }]}
              onPress={() => adjust(item, +10)} disabled={!!updating[item.id]}>
              <Text style={styles.stockBtnText}>+10</Text>
            </TouchableOpacity>
          </View>

          {/* Modifier / Supprimer / Promotion */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('AddProduct', { product: item })}>
              <Text style={styles.editBtnText}>✏️ Modifier</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.promoBtn} onPress={() => navigation.navigate('CreatePromotion', { product: item })}>
              <Text style={styles.promoBtnText}>🏷️ Promo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
              <Text style={styles.deleteBtnText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1 },
  empty: { textAlign: 'center', color: COLORS.textLight, padding: 40, fontSize: 15 },
  promoHeaderBtn: {
    backgroundColor: '#7C3AED', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 16,
  },
  promoHeaderText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  card: { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 12 },
  row: { flexDirection: 'row', marginBottom: 12 },
  img: { width: 64, height: 64, borderRadius: 8, resizeMode: 'cover' },
  noImg: { backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  price: { fontSize: 14, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  cat: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  stockRow: { flexDirection: 'row', alignItems: 'center' },
  stockBtn: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  stockBtnText: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 24 },
  stockBadge: {
    flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8,
    paddingVertical: 6, backgroundColor: COLORS.bg, marginHorizontal: 8, minHeight: 40,
  },
  stockBadgeEmpty: { backgroundColor: '#fee2e2' },
  stockQty: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  stockUnit: { fontSize: 11, color: COLORS.textLight },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  editBtn: { flex: 1, backgroundColor: COLORS.primary + '15', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  editBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  promoBtn: { flex: 1, backgroundColor: '#f3e8ff', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  promoBtnText: { color: '#7C3AED', fontWeight: '700', fontSize: 13 },
  deleteBtn: { width: 44, backgroundColor: '#fee2e2', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  deleteBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 13 },
});
