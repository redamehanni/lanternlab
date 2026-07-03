import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { useCart } from '../../context/CartContext';
import { imageUrl } from '../../utils/format';
import PriceTag from '../../components/ui/PriceTag';
import PromoBadge from '../../components/ui/PromoBadge';
import FadeIn from '../../components/ui/FadeIn';
import { THEME } from '../../theme';

export default function ProductDetailScreen({ navigation, route }) {
  const { socket } = useApp();
  const { addToCart } = useCart();
  const [product, setProduct] = useState(route.params.product);
  const [adding, setAdding] = useState(false);

  const promoPrice = product.promo_price ?? product.promotion?.promo_price;
  const displayPrice = promoPrice ?? product.price;
  const hasDiscount = promoPrice != null && promoPrice < product.price;
  const buyGetLabel = product.promo_type === 'buy_get' || product.promotion?.type === 'buy_get'
    ? (product.promo_label || product.promotion?.promo_label)
    : null;

  useEffect(() => {
    if (!socket) return;
    const onStock = ({ productId, quantity }) => {
      if (productId === product.id) setProduct((p) => ({ ...p, quantity }));
    };
    const onPromo = (data) => {
      const promotion = data.promotion;
      if (promotion?.product_id === product.id) {
        setProduct((p) => ({
          ...p,
          promo_price: promotion.promo_price,
          discount_percent: promotion.discount_percent,
          promo_label: promotion.promo_label,
          promo_type: promotion.type,
          promotion,
        }));
      }
    };
    const onPromoDel = ({ product_id }) => {
      if (product_id === product.id) {
        setProduct((p) => ({ ...p, promo_price: null, promotion: null, promo_label: null, promo_type: null }));
      }
    };
    socket.on('product:stock_updated', onStock);
    socket.on('promotion:created', onPromo);
    socket.on('promotion:updated', onPromo);
    socket.on('promotion:deleted', onPromoDel);
    return () => {
      socket.off('product:stock_updated', onStock);
      socket.off('promotion:created', onPromo);
      socket.off('promotion:updated', onPromo);
      socket.off('promotion:deleted', onPromoDel);
    };
  }, [socket, product.id]);

  const stockQty = product.quantity ?? product.product_stock ?? 0;
  const inStock = stockQty > 0;
  const store = product.store || {
    name: product.store_name, address: product.store_address,
    id: product.store_id, category: product.store_category,
  };

  async function handleAddToCart() {
    setAdding(true);
    const ok = await addToCart(product.id, 1);
    setAdding(false);
    if (ok) {
      Alert.alert('Ajouté au panier', `${product.name} a été ajouté.`, [
        { text: 'Continuer' },
        { text: 'Voir le panier', onPress: () => navigation.navigate('CartTab') },
      ]);
    } else {
      Alert.alert('Erreur', 'Impossible d\'ajouter au panier.');
    }
  }

  function handleBuyNow() {
    navigation.navigate('OrderConfirm', {
      product: { ...product, price: displayPrice },
    });
  }

  return (
    <ScrollView style={styles.bg} contentContainerStyle={{ paddingBottom: 120 }}>
      <FadeIn>
        <View style={styles.heroWrap}>
          {product.image_url ? (
            <Image source={{ uri: imageUrl(product.image_url) }} style={styles.hero} />
          ) : (
            <View style={[styles.hero, styles.heroPlaceholder]}><Text style={{ fontSize: 64 }}>📦</Text></View>
          )}
          {(hasDiscount || buyGetLabel) && (
            <PromoBadge
              discountPercent={product.discount_percent}
              label={buyGetLabel || undefined}
              style={styles.heroBadge}
            />
          )}
        </View>
      </FadeIn>

      <View style={styles.body}>
        <FadeIn delay={80}>
          <Text style={styles.name}>{product.name}</Text>
          <PriceTag price={product.price} promoPrice={hasDiscount ? promoPrice : null} size="lg" />
          {buyGetLabel && (
            <View style={styles.buyGetBanner}>
              <Text style={styles.buyGetText}>🎁 {buyGetLabel}</Text>
            </View>
          )}

          <View style={[styles.stockBadge, { backgroundColor: inStock ? THEME.colors.successSoft : THEME.colors.errorSoft }]}>
            <View style={[styles.dot, { backgroundColor: inStock ? THEME.colors.success : THEME.colors.error }]} />
            <Text style={[styles.stockText, { color: inStock ? THEME.colors.success : THEME.colors.error }]}>
              {inStock ? `${stockQty} en stock` : 'Épuisé'}
            </Text>
          </View>
        </FadeIn>

        <FadeIn delay={120}>
          <TouchableOpacity
            style={[styles.storeBox, THEME.shadow.sm]}
            activeOpacity={store.id ? 0.7 : 1}
            onPress={() => store.id && navigation.navigate('StoreDetail', { storeId: store.id })}
          >
            <Text style={styles.storeLabel}>Vendu par</Text>
            <Text style={styles.storeName}>{store.name}</Text>
            {store.category ? (
              <View style={styles.catBadge}><Text style={styles.catText}>{store.category}</Text></View>
            ) : null}
            <Text style={styles.storeAddr}>{store.address}</Text>
            {store.id ? <Text style={styles.storeLink}>Voir la boutique ›</Text> : null}
          </TouchableOpacity>
        </FadeIn>

        {product.description ? (
          <FadeIn delay={160}>
            <Text style={styles.descLabel}>Description</Text>
            <Text style={styles.desc}>{product.description}</Text>
          </FadeIn>
        ) : null}
      </View>

      {/* Actions fixes en bas */}
      <View style={[styles.footer, THEME.shadow.lg]}>
        <TouchableOpacity
          style={[styles.cartBtn, (!inStock || adding) && styles.btnDisabled]}
          onPress={handleAddToCart}
          disabled={!inStock || adding}
        >
          <Ionicons name="cart-outline" size={20} color={THEME.colors.primary} />
          <Text style={styles.cartBtnText}>Ajouter au panier</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.buyBtn, !inStock && styles.btnDisabled]}
          onPress={handleBuyNow}
          disabled={!inStock}
        >
          <Text style={styles.buyBtnText}>{inStock ? 'Acheter maintenant' : 'Épuisé'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  heroWrap: { position: 'relative' },
  hero: { width: '100%', height: 280, resizeMode: 'cover' },
  heroBadge: { position: 'absolute', top: 16, left: 16 },
  heroPlaceholder: { backgroundColor: THEME.colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  buyGetBanner: {
    marginTop: 12, backgroundColor: THEME.colors.accentSoft, borderRadius: 12,
    padding: 12, alignSelf: 'flex-start',
  },
  buyGetText: { color: THEME.colors.accent, fontWeight: '800', fontSize: 14 },
  body: { padding: THEME.spacing.lg },
  name: { ...THEME.typography.hero, fontSize: 26, color: THEME.colors.text },
  stockBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginTop: 14,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  stockText: { fontSize: 13, fontWeight: '700' },
  storeBox: {
    backgroundColor: THEME.colors.card, borderRadius: THEME.radius.lg, padding: 16,
    marginTop: 20, borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  storeLabel: { fontSize: 11, color: THEME.colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  storeName: { fontSize: 17, fontWeight: '800', color: THEME.colors.text, marginTop: 4 },
  catBadge: { alignSelf: 'flex-start', backgroundColor: THEME.colors.accentSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 },
  catText: { fontSize: 11, color: THEME.colors.accent, fontWeight: '700' },
  storeAddr: { fontSize: 13, color: THEME.colors.textSecondary, marginTop: 6 },
  storeLink: { fontSize: 13, color: THEME.colors.accent, fontWeight: '700', marginTop: 10 },
  descLabel: { fontSize: 16, fontWeight: '700', color: THEME.colors.text, marginTop: 20, marginBottom: 8 },
  desc: { fontSize: 15, color: THEME.colors.textSecondary, lineHeight: 24 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 10, backgroundColor: THEME.colors.card,
    padding: THEME.spacing.md, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: THEME.colors.borderLight,
  },
  cartBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: THEME.radius.md, padding: 16, borderWidth: 2, borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.card,
  },
  cartBtnText: { color: THEME.colors.primary, fontWeight: '800', fontSize: 14 },
  buyBtn: {
    flex: 1, backgroundColor: THEME.colors.primary, borderRadius: THEME.radius.md,
    padding: 16, alignItems: 'center', justifyContent: 'center',
  },
  buyBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  btnDisabled: { opacity: 0.45 },
});
