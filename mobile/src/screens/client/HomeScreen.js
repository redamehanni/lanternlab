import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, Animated,
} from 'react-native';
import { useFocusEffect, useRoute, DrawerActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { searchProducts, getFlashPromotions, getFavoriteStores } from '../../api';
import { HOME_CATEGORIES, CATEGORY_SEARCH_MAP } from '../../data/categories';
import SearchBar from '../../components/ui/SearchBar';
import PriceTag from '../../components/ui/PriceTag';
import PromoBadge from '../../components/ui/PromoBadge';
import FadeIn from '../../components/ui/FadeIn';
import { SectionHeader } from '../../components/ui/Card';
import { useToast } from '../../components/ui/Toast';
import { imageUrl } from '../../utils/format';
import { THEME } from '../../theme';

const INITIAL_HOME = { query: '', hasSearched: false, results: [], categoryId: null };

function CategoryCard({ item, onPress, index }) {
  return (
    <FadeIn delay={index * 30}>
      <TouchableOpacity style={[styles.catCard, THEME.shadow.md]} onPress={onPress} activeOpacity={0.88}>
        <View style={[styles.catIconWrap, { backgroundColor: item.color + '18' }]}>
          <Ionicons name={item.icon} size={26} color={item.color} />
        </View>
        <Text style={styles.catName} numberOfLines={2}>{item.name}</Text>
      </TouchableOpacity>
    </FadeIn>
  );
}

function PromoCard({ promo, onPress, index }) {
  const isDiscount = promo.type === 'discount';
  return (
    <FadeIn delay={index * 50}>
      <TouchableOpacity style={[styles.promoCard, THEME.shadow.lg]} onPress={onPress} activeOpacity={0.9}>
        <View style={styles.promoImgWrap}>
          {promo.product_image ? (
            <Image source={{ uri: imageUrl(promo.product_image) }} style={styles.promoImg} />
          ) : (
            <View style={[styles.promoImg, styles.promoImgPh]}><Text style={{ fontSize: 32 }}>🏷️</Text></View>
          )}
          <PromoBadge
            discountPercent={promo.discount_percent}
            label={isDiscount ? `-${promo.saved_percent || promo.discount_percent}%` : promo.promo_label}
            style={styles.promoThumbBadge}
            small
          />
        </View>
        <View style={styles.promoBody}>
          <Text style={styles.promoStore} numberOfLines={1}>{promo.store_name}</Text>
          <Text style={styles.promoName} numberOfLines={2}>{promo.product_name}</Text>
          {isDiscount ? (
            <PriceTag price={promo.original_price || promo.product_price} promoPrice={promo.promo_price} />
          ) : (
            <Text style={styles.buyGetLabel}>{promo.promo_label}</Text>
          )}
        </View>
        <View style={styles.flashBadge}>
          <Text style={styles.flashText}>FLASH</Text>
        </View>
      </TouchableOpacity>
    </FadeIn>
  );
}

function StoreCard({ store, onPress, index }) {
  return (
    <FadeIn delay={index * 40}>
      <TouchableOpacity style={[styles.storeCard, THEME.shadow.md]} onPress={onPress} activeOpacity={0.88}>
        {store.photo_url ? (
          <Image source={{ uri: imageUrl(store.photo_url) }} style={styles.storeImg} />
        ) : (
          <View style={[styles.storeImg, styles.storeImgPh]}><Text style={{ fontSize: 28 }}>🏪</Text></View>
        )}
        <Text style={styles.storeName} numberOfLines={1}>{store.name}</Text>
        {store.distance_km != null && <Text style={styles.storeDist}>{store.distance_km} km</Text>}
      </TouchableOpacity>
    </FadeIn>
  );
}

function ProductResultCard({ item, onPress }) {
  const promoPrice = item.promo_price;
  const hasPromo = promoPrice != null && promoPrice < item.price;
  return (
    <TouchableOpacity style={[styles.resultCard, THEME.shadow.sm]} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.resultImgWrap}>
        {item.image_url ? (
          <Image source={{ uri: imageUrl(item.image_url) }} style={styles.resultImg} />
        ) : (
          <View style={[styles.resultImg, styles.resultImgPh]}><Text style={{ fontSize: 28 }}>📦</Text></View>
        )}
        {(hasPromo || item.promo_label) && (
          <PromoBadge
            discountPercent={item.discount_percent}
            label={item.promo_label}
            style={styles.resultBadge}
            small
          />
        )}
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.resultStore}>{item.store?.name || item.store_name}</Text>
        <PriceTag price={item.price} promoPrice={promoPrice} />
      </View>
      <Ionicons name="chevron-forward" size={20} color={THEME.colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }) {
  const route = useRoute();
  const { user, socket } = useApp();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState([]);
  const [promos, setPromos] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingHome, setLoadingHome] = useState(true);
  const [history, setHistory] = useState([]);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const lastReset = useRef(null);

  const loadHome = useCallback(async () => {
    setLoadingHome(true);
    try {
      const [promoRes, favRes] = await Promise.all([
        getFlashPromotions().catch(() => ({ data: { promotions: [] } })),
        getFavoriteStores().catch(() => ({ data: { stores: [] } })),
      ]);
      setPromos(promoRes.data.promotions || []);
      setFavorites(favRes.data.stores || []);
    } finally {
      setLoadingHome(false);
    }
  }, []);

  const resetHome = useCallback((showToast = false) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.3, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    setQuery('');
    setHasSearched(false);
    setResults([]);
    setHistory([]);
    loadHome();
    if (showToast) toast('Accueil réinitialisé');
  }, [fadeAnim, loadHome, toast]);

  // Reset complet quand on appuie sur Home (param reset)
  useEffect(() => {
    if (route.params?.reset && route.params.reset !== lastReset.current) {
      lastReset.current = route.params.reset;
      resetHome(true);
      navigation.setParams({ reset: undefined });
    }
  }, [route.params?.reset, resetHome, navigation]);

  useFocusEffect(useCallback(() => { loadHome(); }, [loadHome]));

  // Temps réel : nouvelles promotions
  useEffect(() => {
    if (!socket) return;
    const onPromo = () => loadHome();
    socket.on('promotion:created', onPromo);
    socket.on('promotion:updated', onPromo);
    socket.on('promotion:deleted', onPromo);
    return () => {
      socket.off('promotion:created', onPromo);
      socket.off('promotion:updated', onPromo);
      socket.off('promotion:deleted', onPromo);
    };
  }, [socket, loadHome]);

  async function runSearch(text, categoryId, pushHistory = true) {
    if (pushHistory && hasSearched) {
      setHistory((h) => [...h, { query, results, categoryId: null }]);
    }

    setLoading(true);
    setHasSearched(true);
    const searchQuery = text;
    setQuery(searchQuery);

    try {
      const searchTerm = categoryId ? (CATEGORY_SEARCH_MAP[categoryId] || text) : text;
      const res = await searchProducts(searchTerm || '');
      let products = res.data.products || [];
      if (categoryId && CATEGORY_SEARCH_MAP[categoryId]) {
        const cat = CATEGORY_SEARCH_MAP[categoryId].toLowerCase();
        products = products.filter((p) =>
          (p.category || '').toLowerCase().includes(cat) ||
          (p.name || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      setResults(products);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setQuery(prev.query);
      setResults(prev.results);
      setHasSearched(prev.hasSearched ?? true);
    } else {
      resetHome(false);
    }
  }

  function openProduct(promoOrProduct) {
    const product = promoOrProduct.product_id
      ? {
          id: promoOrProduct.product_id,
          name: promoOrProduct.name || promoOrProduct.product_name,
          description: promoOrProduct.description || promoOrProduct.product_description,
          price: promoOrProduct.original_price || promoOrProduct.product_price || promoOrProduct.price || promoOrProduct.promo_price,
          quantity: promoOrProduct.quantity ?? promoOrProduct.product_stock ?? 0,
          promo_price: promoOrProduct.promo_price,
          discount_percent: promoOrProduct.discount_percent,
          promo_label: promoOrProduct.promo_label,
          promo_type: promoOrProduct.type || promoOrProduct.promo_type,
          image_url: promoOrProduct.image_url || promoOrProduct.product_image,
          store: promoOrProduct.store || {
            name: promoOrProduct.store_name,
            id: promoOrProduct.store_id,
            address: promoOrProduct.store_address,
            lat: promoOrProduct.store_lat,
            lng: promoOrProduct.store_lng,
          },
          store_id: promoOrProduct.store_id,
          store_name: promoOrProduct.store_name,
          store_address: promoOrProduct.store_address,
        }
      : promoOrProduct;
    navigation.navigate('ProductDetail', { product });
  }

  const showBack = hasSearched;

  return (
    <Animated.View style={[styles.bg, { opacity: fadeAnim }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FadeIn>
          <View style={styles.hero}>
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
              activeOpacity={0.8}
              accessibilityLabel="Ouvrir le menu"
            >
              <Ionicons name="menu" size={26} color={THEME.colors.text} />
            </TouchableOpacity>
            <Text style={styles.greeting}>Bonjour{user?.first_name ? `, ${user.first_name}` : ''} 👋</Text>
            <Text style={styles.heroTitle}>Découvrez votre zone</Text>
            <Text style={styles.heroSub}>Livraison locale en moins d'une heure</Text>
          </View>
        </FadeIn>

        <SearchBar
          value={query}
          onChangeText={setQuery}
          onSubmit={() => runSearch(query)}
          showBack={showBack}
          onBack={handleBack}
        />

        {!hasSearched && (
          <>
            <SectionHeader title="Catégories" subtitle="Explorez par univers" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
              {HOME_CATEGORIES.map((cat, i) => (
                <CategoryCard
                  key={cat.id}
                  item={cat}
                  index={i}
                  onPress={() => runSearch(cat.name, cat.id, false)}
                />
              ))}
            </ScrollView>

            <SectionHeader title="Promotions flash" subtitle="Offres limitées près de chez vous" />
            {loadingHome ? (
              <ActivityIndicator color={THEME.colors.accent} style={{ marginVertical: 24 }} />
            ) : promos.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>Aucune promotion pour le moment</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
                {promos.map((p, i) => (
                  <PromoCard key={p.id} promo={p} index={i} onPress={() => openProduct(p)} />
                ))}
              </ScrollView>
            )}

            <SectionHeader title="Mes boutiques favorites" subtitle="Vos coups de cœur locaux" />
            {favorites.length === 0 ? (
              <View style={[styles.emptyFav, THEME.shadow.sm]}>
                <Ionicons name="heart-outline" size={32} color={THEME.colors.textMuted} />
                <Text style={styles.emptyFavTitle}>Pas encore de favori</Text>
                <Text style={styles.emptyFavSub}>Ajoutez un ❤️ sur une boutique pour la retrouver ici</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
                {favorites.map((s, i) => (
                  <StoreCard key={s.id} store={s} index={i} onPress={() => navigation.navigate('StoreDetail', { storeId: s.id })} />
                ))}
              </ScrollView>
            )}
          </>
        )}

        {hasSearched && (
          <FadeIn style={{ marginTop: THEME.spacing.lg }}>
            <SectionHeader
              title={query ? `Résultats pour « ${query} »` : 'Résultats'}
              subtitle={`${results.length} produit${results.length !== 1 ? 's' : ''}`}
            />
            {loading ? (
              <ActivityIndicator color={THEME.colors.accent} style={{ marginTop: 32 }} />
            ) : results.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>🔍</Text>
                <Text style={styles.emptyText}>Aucun produit trouvé</Text>
              </View>
            ) : (
              <View style={styles.results}>
                {results.map((item) => (
                  <ProductResultCard key={item.id} item={item} onPress={() => openProduct(item)} />
                ))}
              </View>
            )}
          </FadeIn>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { paddingBottom: 24 },
  hero: { paddingHorizontal: THEME.spacing.md, paddingTop: THEME.spacing.sm },
  menuBtn: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: THEME.colors.card, borderWidth: 1, borderColor: THEME.colors.borderLight,
    marginBottom: 8, alignSelf: 'flex-start',
  },
  greeting: { ...THEME.typography.caption, color: THEME.colors.textSecondary, textTransform: 'uppercase' },
  heroTitle: { ...THEME.typography.hero, color: THEME.colors.text, marginTop: 4 },
  heroSub: { ...THEME.typography.body, color: THEME.colors.textSecondary, marginTop: 4 },
  hRow: { paddingHorizontal: THEME.spacing.md, gap: 12, paddingBottom: 4 },
  catCard: {
    width: 100, backgroundColor: THEME.colors.card, borderRadius: THEME.radius.lg,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  catIconWrap: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  catName: { fontSize: 11, fontWeight: '600', color: THEME.colors.text, textAlign: 'center', lineHeight: 14 },
  promoCard: {
    width: 200, backgroundColor: THEME.colors.card, borderRadius: THEME.radius.lg,
    overflow: 'hidden', borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  promoImgWrap: { position: 'relative' },
  promoImg: { width: '100%', height: 110, resizeMode: 'cover' },
  promoImgPh: { backgroundColor: THEME.colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  promoThumbBadge: { position: 'absolute', bottom: 8, left: 8 },
  promoBody: { padding: 12 },
  promoStore: { fontSize: 11, color: THEME.colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  promoName: { fontSize: 14, fontWeight: '700', color: THEME.colors.text, marginVertical: 4 },
  buyGetLabel: { fontSize: 13, fontWeight: '700', color: THEME.colors.accent },
  flashBadge: {
    position: 'absolute', top: 10, right: 10, backgroundColor: THEME.colors.promo,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  flashText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  storeCard: {
    width: 140, backgroundColor: THEME.colors.card, borderRadius: THEME.radius.lg,
    padding: 10, borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  storeImg: { width: '100%', height: 80, borderRadius: 12, resizeMode: 'cover' },
  storeImgPh: { backgroundColor: THEME.colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  storeName: { fontSize: 13, fontWeight: '700', color: THEME.colors.text, marginTop: 8 },
  storeDist: { fontSize: 11, color: THEME.colors.textSecondary, marginTop: 2 },
  emptyRow: { alignItems: 'center', padding: THEME.spacing.xl },
  emptyText: { color: THEME.colors.textSecondary, fontSize: 15 },
  emptyFav: {
    marginHorizontal: THEME.spacing.md, backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg, padding: THEME.spacing.xl, alignItems: 'center',
    borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  emptyFavTitle: { ...THEME.typography.subtitle, color: THEME.colors.text, marginTop: 8 },
  emptyFavSub: { ...THEME.typography.caption, color: THEME.colors.textSecondary, textAlign: 'center', marginTop: 4 },
  results: { paddingHorizontal: THEME.spacing.md, gap: 10 },
  resultCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.md, padding: 12, borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  resultImgWrap: { position: 'relative' },
  resultImg: { width: 64, height: 64, borderRadius: 12, resizeMode: 'cover' },
  resultImgPh: { backgroundColor: THEME.colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  resultBadge: { position: 'absolute', top: 4, left: 4 },
  resultInfo: { flex: 1, marginLeft: 12 },
  resultName: { fontSize: 15, fontWeight: '700', color: THEME.colors.text },
  resultStore: { fontSize: 12, color: THEME.colors.textSecondary, marginVertical: 2 },
});
