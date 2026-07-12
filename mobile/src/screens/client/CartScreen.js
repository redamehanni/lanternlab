import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../../context/CartContext';
import { checkoutCart } from '../../api';
import PriceTag from '../../components/ui/PriceTag';
import FadeIn from '../../components/ui/FadeIn';
import { imageUrl, euro } from '../../utils/format';
import { THEME } from '../../theme';

export default function CartScreen({ navigation }) {
  const { items, total, count, updateQty, removeItem, clearCart, refresh } = useCart();
  const [checking, setChecking] = useState(false);

  async function handleCheckout() {
    if (!items.length) return;
    setChecking(true);
    try {
      const res = await checkoutCart({});
      await clearCart();
      const orders = res.data.orders || [];
      if (orders.length === 1) {
        navigation.navigate('OrderTracking', { orderId: orders[0].id });
      } else {
        Alert.alert('Commandes passées', `${orders.length} commandes ont été créées.`, [
          { text: 'Voir mes commandes', onPress: () => navigation.navigate('HomeTab', { screen: 'OrderHistory' }) },
          { text: 'OK' },
        ]);
      }
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.error || 'Paiement impossible.');
    } finally {
      setChecking(false);
    }
  }

  if (!items.length) {
    return (
      <View style={styles.empty}>
        <FadeIn>
          <View style={[styles.emptyCard, THEME.shadow.md]}>
            <Ionicons name="cart-outline" size={56} color={THEME.colors.textMuted} />
            <Text style={styles.emptyTitle}>Votre panier est vide</Text>
            <Text style={styles.emptySub}>Ajoutez des produits pour commencer</Text>
            <TouchableOpacity style={styles.exploreBtn} onPress={() => navigation.navigate('HomeTab')}>
              <Text style={styles.exploreBtnText}>Explorer</Text>
            </TouchableOpacity>
          </View>
        </FadeIn>
      </View>
    );
  }

  return (
    <View style={styles.bg}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        onRefresh={refresh}
        refreshing={false}
        renderItem={({ item, index }) => (
          <FadeIn delay={index * 40}>
            <View style={[styles.item, THEME.shadow.sm]}>
              {item.image_url ? (
                <Image source={{ uri: imageUrl(item.image_url) }} style={styles.img} />
              ) : (
                <View style={[styles.img, styles.imgPh]}><Text style={{ fontSize: 24 }}>📦</Text></View>
              )}
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.store}>{item.store_name}</Text>
                <PriceTag price={item.price} promoPrice={item.promo_price} />
                <View style={styles.qtyRow}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => item.quantity > 1 ? updateQty(item.id, item.quantity - 1) : removeItem(item.id)}>
                    <Ionicons name="remove" size={18} color={THEME.colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.qty}>{item.quantity}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, item.quantity + 1)} disabled={item.quantity >= item.stock}>
                    <Ionicons name="add" size={18} color={THEME.colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.remove}>
                <Ionicons name="trash-outline" size={20} color={THEME.colors.error} />
              </TouchableOpacity>
            </View>
          </FadeIn>
        )}
      />

      <View style={[styles.footer, THEME.shadow.lg]}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{count} article{count > 1 ? 's' : ''}</Text>
          <Text style={styles.total}>{euro(total)}</Text>
        </View>
        <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout} disabled={checking}>
          {checking ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.checkoutText}>Commander · {euro(total)}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  list: { padding: THEME.spacing.md, paddingBottom: 160 },
  item: {
    flexDirection: 'row', backgroundColor: THEME.colors.card, borderRadius: THEME.radius.lg,
    padding: 12, marginBottom: 10, borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  img: { width: 72, height: 72, borderRadius: 12, resizeMode: 'cover' },
  imgPh: { backgroundColor: THEME.colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 15, fontWeight: '700', color: THEME.colors.text },
  store: { fontSize: 12, color: THEME.colors.textSecondary, marginVertical: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  qtyBtn: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: THEME.colors.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  qty: { fontSize: 16, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  remove: { padding: 8 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: THEME.colors.card, padding: THEME.spacing.md,
    paddingBottom: 28, borderTopWidth: 1, borderTopColor: THEME.colors.borderLight,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  totalLabel: { color: THEME.colors.textSecondary, fontSize: 14 },
  total: { fontSize: 22, fontWeight: '900', color: THEME.colors.text },
  checkoutBtn: {
    backgroundColor: THEME.colors.primary, borderRadius: THEME.radius.md,
    padding: 18, alignItems: 'center',
  },
  checkoutText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  empty: { flex: 1, backgroundColor: THEME.colors.bg, justifyContent: 'center', padding: THEME.spacing.lg },
  emptyCard: {
    backgroundColor: THEME.colors.card, borderRadius: THEME.radius.xl,
    padding: THEME.spacing.xxl, alignItems: 'center', borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  emptyTitle: { ...THEME.typography.title, color: THEME.colors.text, marginTop: 16 },
  emptySub: { ...THEME.typography.body, color: THEME.colors.textSecondary, marginTop: 8, textAlign: 'center' },
  exploreBtn: {
    marginTop: 24, backgroundColor: THEME.colors.accent, borderRadius: THEME.radius.md,
    paddingHorizontal: 32, paddingVertical: 14,
  },
  exploreBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
