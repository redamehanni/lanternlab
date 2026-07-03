import React, { useState, useCallback } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getStoreById, getFavoriteIds, toggleFavoriteStore } from '../../api';
import { imageUrl, euro } from '../../utils/format';
import MapView from '../../components/MapView';
import PriceTag from '../../components/ui/PriceTag';
import PromoBadge from '../../components/ui/PromoBadge';
import { THEME } from '../../theme';

export default function StoreDetailScreen({ navigation, route }) {
  const storeId = route.params.storeId;
  const [store,    setStore]    = useState(null);
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [favorited, setFavorited] = useState(false);

  const load = useCallback(async () => {
    try {
      const [res, favRes] = await Promise.all([
        getStoreById(storeId),
        getFavoriteIds().catch(() => ({ data: { store_ids: [] } })),
      ]);
      setStore(res.data.store);
      setProducts(res.data.products || []);
      setFavorited((favRes.data.store_ids || []).includes(storeId));
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  async function handleToggleFavorite() {
    const res = await toggleFavoriteStore(storeId);
    setFavorited(res.data.favorited);
  }

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <ActivityIndicator style={styles.center} size="large" color={THEME.colors.accent} />;
  if (!store)  return <Text style={styles.center}>Commerce introuvable.</Text>;

  return (
    <ScrollView style={styles.bg} contentContainerStyle={{ paddingBottom: 40 }}>
      {store.photo_url ? (
        <Image source={{ uri: imageUrl(store.photo_url) }} style={styles.hero} />
      ) : (
        <View style={[styles.hero, styles.heroPh]}><Text style={{ fontSize: 56 }}>🏪</Text></View>
      )}

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{store.name}</Text>
          <TouchableOpacity style={[styles.favBtn, favorited && styles.favBtnActive]} onPress={handleToggleFavorite}>
            <Ionicons name={favorited ? 'heart' : 'heart-outline'} size={22} color={favorited ? '#fff' : THEME.colors.error} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.favLabel} onPress={handleToggleFavorite}>
          <Text style={styles.favLabelText}>
            {favorited ? '❤️ Coup de cœur boutique' : '🤍 Coup de cœur boutique'}
          </Text>
        </TouchableOpacity>
        <View style={styles.badgeRow}>
          {store.category ? <View style={styles.catBadge}><Text style={styles.catText}>{store.category}</Text></View> : null}
          <Text style={styles.rating}>⭐ 5,0</Text>
          {store.distance_km != null && <Text style={styles.dist}>· {store.distance_km} km</Text>}
        </View>
        <Text style={styles.addr}>{store.address}</Text>
        {store.phone ? <Text style={styles.contact}>📞 {store.phone}</Text> : null}

        {store.description ? <Text style={styles.desc}>{store.description}</Text> : null}

        {/* Histoire du commerce (issue #13) */}
        {store.story ? (
          <View style={styles.storyBox}>
            <Text style={styles.storyTitle}>Notre histoire</Text>
            <Text style={styles.storyText}>{store.story}</Text>
          </View>
        ) : null}

        {/* Carte (issue #15) */}
        <Text style={styles.sectionTitle}>Localisation</Text>
        <MapView lat={store.lat} lng={store.lng} label={store.name} height={170} />

        {/* Produits */}
        <Text style={styles.sectionTitle}>Produits ({products.length})</Text>
        {products.length === 0 ? (
          <Text style={styles.emptyProd}>Aucun produit pour le moment.</Text>
        ) : (
          products.map(p => (
            <TouchableOpacity key={p.id} style={styles.prodCard}
              onPress={() => navigation.navigate('ProductDetail', {
                product: { ...p, store: { id: store.id, name: store.name, address: store.address, category: store.category, lat: store.lat, lng: store.lng }, distance_km: store.distance_km },
              })}>
              <View style={styles.prodImgWrap}>
                {p.image_url ? (
                  <Image source={{ uri: imageUrl(p.image_url) }} style={styles.prodImg} />
                ) : (
                  <View style={[styles.prodImg, styles.noImg]}><Text>📦</Text></View>
                )}
                {(p.promo_price || p.promo_label) && (
                  <PromoBadge discountPercent={p.discount_percent} label={p.promo_label} style={styles.prodBadge} small />
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.prodName} numberOfLines={1}>{p.name}</Text>
                <PriceTag price={p.price} promoPrice={p.promo_price} />
                <Text style={styles.prodStock}>{p.quantity > 0 ? `${p.quantity} dispo` : 'Épuisé'}</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  center: { flex: 1, textAlign: 'center', textAlignVertical: 'center', marginTop: 40 },
  hero: { width: '100%', height: 200, resizeMode: 'cover' },
  heroPh: { backgroundColor: THEME.colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 24, fontWeight: '800', color: THEME.colors.text, flex: 1 },
  favBtn: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: THEME.colors.error,
    alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.colors.card,
  },
  favBtnActive: { backgroundColor: THEME.colors.error, borderColor: THEME.colors.error },
  favLabel: { marginTop: 6, marginBottom: 4 },
  favLabelText: { fontSize: 13, fontWeight: '700', color: THEME.colors.error },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  catBadge: { backgroundColor: THEME.colors.accentSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  catText: { fontSize: 12, color: THEME.colors.accent, fontWeight: '700' },
  rating: { fontSize: 13, color: THEME.colors.warning, fontWeight: '600' },
  dist: { fontSize: 13, color: THEME.colors.textSecondary },
  addr: { fontSize: 14, color: THEME.colors.textSecondary, marginTop: 8 },
  contact: { fontSize: 14, color: THEME.colors.accent, marginTop: 4 },
  desc: { fontSize: 14, color: THEME.colors.text, lineHeight: 22, marginTop: 12 },
  storyBox: { backgroundColor: THEME.colors.warningSoft, borderRadius: 12, padding: 14, marginTop: 16, borderLeftWidth: 3, borderLeftColor: THEME.colors.warning },
  storyTitle: { fontSize: 14, fontWeight: '800', color: '#b45309', marginBottom: 6 },
  storyText: { fontSize: 14, color: '#78350f', lineHeight: 22 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: THEME.colors.text, marginTop: 20, marginBottom: 10 },
  emptyProd: { color: THEME.colors.textSecondary, fontSize: 14 },
  prodCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.colors.card,
    borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: THEME.colors.borderLight,
    ...THEME.shadow.sm,
  },
  prodImgWrap: { position: 'relative' },
  prodImg: { width: 56, height: 56, borderRadius: 10, resizeMode: 'cover' },
  prodBadge: { position: 'absolute', top: 2, left: 2 },
  noImg: { backgroundColor: THEME.colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  prodName: { fontSize: 14, fontWeight: '700', color: THEME.colors.text },
  prodStock: { fontSize: 12, color: THEME.colors.textSecondary, marginTop: 2 },
  arrow: { fontSize: 22, color: THEME.colors.textMuted, marginLeft: 6 },
});
