import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Image, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { getMyStore, getStoreProducts, updateProductStock, deleteProduct } from '../../api';
import { getStoreInventory, declareOnHand } from '../../api/v1';
import { imageUrl, euro } from '../../utils/format';
import PriceTag from '../../components/ui/PriceTag';
import PromoBadge from '../../components/ui/PromoBadge';
import { confirmAction } from '../../utils/confirm';
import { COLORS, FEATURES } from '../../config';

/**
 * PREMIER ÉCRAN BASCULÉ SUR L'API v1 (étape 7 de la roadmap Organe d'Orchestration).
 *
 * Le rendu, les styles et les gestes sont INCHANGÉS. Seule la provenance des nombres
 * change, et un détail d'affichage s'ajoute quand la v1 est active : le commerçant voit
 * enfin ce que l'API historique ne pouvait pas lui dire — combien d'unités sont
 * physiquement là, et combien sont déjà promises à des clients.
 *
 * POURQUOI CET ÉCRAN D'ABORD. Sur `/api`, le nombre affiché est `products.quantity`, devenu
 * la projection du VENDABLE à l'étape 4. Quand le commerçant le réenregistrait, le backend
 * devait deviner qu'il parlait de vendable et non de physique, sous peine de faire fondre le
 * stock à chaque saisie. Sur `/api/v1`, les champs portent leur vrai nom : plus de devinette.
 *
 * LES DEUX CHEMINS COEXISTENT, ET AUCUN N'EST DÉGRADÉ. `FEATURES.stockV1` vaut `false` par
 * défaut : la bascule s'éprouve en activant un drapeau, pas en livrant une réécriture.
 */
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
      const list = prodRes.data.products || [];

      if (!FEATURES.stockV1) {
        setProducts(list);
        return;
      }

      // Le catalogue vient encore de `/api` — promotions, images, catégories n'ont pas
      // d'équivalent commerçant en v1 — et seuls les NOMBRES viennent de l'inventaire
      // versionné. Une bascule progressive est exactement cela : déplacer une
      // responsabilité, pas un écran entier.
      const inventory = await getStoreInventory(storeRes.data.store.id);
      const byProduct = new Map((inventory.data.levels || []).map(l => [l.product_id, l]));

      setProducts(list.map(p => {
        const level = byProduct.get(p.id);
        if (!level) return p;
        return {
          ...p,
          // `quantity` reste le champ qu'affiche le rendu : le vendable, comme avant.
          quantity: level.available,
          on_hand: level.on_hand,
          reserved: level.reserved,
          inventory_owner: level.inventory_owner,
        };
      }));
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
    // `available` est le nom juste depuis l'étape 7 ; `quantity` porte le même nombre le
    // temps que les autres écrans migrent. Lire les deux évite de dépendre de l'ordre de
    // déploiement entre le backend et l'application.
    const onStock = ({ productId, available, quantity }) => {
      const value = available ?? quantity;
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, quantity: value } : p));
    };
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
      if (!FEATURES.stockV1) {
        await updateProductStock(product.id, delta);
        setProducts(prev => prev.map(p => p.id === product.id
          ? { ...p, quantity: Math.max(0, p.quantity + delta) }
          : p));
        return;
      }

      // En v1 le bouton « + » déclare une CIBLE de stock physique, pas un incrément. Le
      // rejeu d'un appel perdu sur un réseau mobile ne peut donc pas compter deux fois.
      const currentOnHand = product.on_hand ?? product.quantity;
      const res = await declareOnHand(
        product.id,
        Math.max(0, currentOnHand + delta),
        delta > 0 ? 'réassort' : 'correction à la baisse'
      );

      // On affiche ce que le serveur a retenu, jamais ce qu'on espérait : c'est ce qui rend
      // visible un refus, une réservation concurrente, ou une valeur bornée par l'organe.
      const level = res.data.stock;
      setProducts(prev => prev.map(p => p.id === product.id
        ? { ...p, quantity: level.available, on_hand: level.on_hand, reserved: level.reserved }
        : p));
    } catch (err) {
      // 409 : le stock physique est le miroir d'une caisse. Le dire, plutôt qu'un « Mise à
      // jour impossible » qui laisserait chercher une panne réseau (Loi 12).
      const mirrored = err?.response?.status === 409;
      Alert.alert(
        mirrored ? 'Stock géré par votre caisse' : 'Erreur',
        mirrored
          ? err.response.data?.error || 'Ce stock se corrige dans votre logiciel de caisse.'
          : 'Mise à jour impossible.'
      );
      load();
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

          {/* Ce que l'API historique ne pouvait pas dire : d'où vient l'écart entre le
              stock physique et ce qui reste vendable. Affiché seulement quand il y a un
              écart — une ligne qui répète « 12 en stock, 12 vendables » n'informe personne. */}
          {FEATURES.stockV1 && item.reserved > 0 && (
            <Text style={styles.stockDetail}>
              {item.on_hand} en rayon · {item.reserved} promis à des clients
            </Text>
          )}

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
  stockDetail: { fontSize: 11, color: COLORS.textLight, marginTop: 8, textAlign: 'center' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  editBtn: { flex: 1, backgroundColor: COLORS.primary + '15', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  editBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  promoBtn: { flex: 1, backgroundColor: '#f3e8ff', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  promoBtnText: { color: '#7C3AED', fontWeight: '700', fontSize: 13 },
  deleteBtn: { width: 44, backgroundColor: '#fee2e2', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  deleteBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 13 },
});
