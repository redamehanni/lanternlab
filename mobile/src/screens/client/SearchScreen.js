import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  Image, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { searchProducts } from '../../api';
import { imageUrl, euro } from '../../utils/format';
import { COLORS, PRODUCT_CATEGORIES } from '../../config';

const ALL = 'Tout';

export default function SearchScreen({ navigation }) {
  const { socket } = useApp();
  const [query,    setQuery]    = useState('');
  const [category, setCategory] = useState(ALL);
  const [allResults, setAllResults] = useState([]);
  const [loading,  setLoading]  = useState(false);

  const runSearch = useCallback(async (text) => {
    setLoading(true);
    try {
      const res = await searchProducts(text || '');
      setAllResults(res.data.products || []);
    } catch {
      setAllResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger tous les produits à l'ouverture
  useFocusEffect(useCallback(() => { runSearch(query); }, [runSearch]));

  useEffect(() => {
    if (!socket) return;
    const onStock = ({ productId, quantity }) =>
      setAllResults(prev => prev.map(p => p.id === productId ? { ...p, quantity } : p));
    socket.on('product:stock_updated', onStock);
    socket.on('product:created', () => runSearch(query));
    return () => { socket.off('product:stock_updated', onStock); socket.off('product:created'); };
  }, [socket, query, runSearch]);

  const results = category === ALL
    ? allResults
    : allResults.filter(p => (p.category || '').toLowerCase() === category.toLowerCase());

  const categories = [ALL, ...PRODUCT_CATEGORIES];

  return (
    <View style={styles.bg}>
      {/* Recherche texte */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher un produit..."
          returnKeyType="search"
          onSubmitEditing={() => runSearch(query)}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={() => runSearch(query)} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchBtnText}>OK</Text>}
        </TouchableOpacity>
      </View>

      {/* Onglets catégories (issue #10) */}
      <View style={styles.catBarWrap}>
        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(c) => c}
          contentContainerStyle={styles.catBar}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.catChip, category === item && styles.catChipActive]}
              onPress={() => setCategory(item)}
            >
              <Text style={[styles.catChipText, category === item && styles.catChipTextActive]}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={results}
        keyExtractor={p => p.id}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>😕</Text>
              <Text style={styles.emptyText}>Aucun produit{category !== ALL ? ` en « ${category} »` : ''}.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} activeOpacity={0.85}
            onPress={() => navigation.navigate('ProductDetail', { product: item })}>
            {item.image_url ? (
              <Image source={{ uri: imageUrl(item.image_url) }} style={styles.img} />
            ) : (
              <View style={[styles.img, styles.noImg]}><Text style={{ fontSize: 32 }}>📦</Text></View>
            )}
            <View style={styles.cardInfo}>
              <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.cardStore}>{item.store.name}</Text>
              <View style={styles.cardRow}>
                <Text style={styles.cardPrice}>{euro(item.price)}</Text>
                {item.distance_km !== null && <Text style={styles.cardDist}>· {item.distance_km} km</Text>}
                <View style={[styles.stockDot, { backgroundColor: item.quantity > 0 ? COLORS.success : '#ef4444' }]} />
                <Text style={styles.cardStock}>{item.quantity > 0 ? `${item.quantity} dispo` : 'Épuisé'}</Text>
              </View>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  searchBar: { flexDirection: 'row', margin: 16, marginBottom: 8, gap: 8 },
  searchInput: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
  },
  searchBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  catBarWrap: { height: 44 },
  catBar: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    height: 34, justifyContent: 'center',
  },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catChipText: { fontSize: 13, color: COLORS.text },
  catChipTextActive: { color: '#fff', fontWeight: '700' },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, borderRadius: 12, padding: 12, marginBottom: 10,
  },
  img: { width: 72, height: 72, borderRadius: 8, resizeMode: 'cover' },
  noImg: { backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  cardStore: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 4 },
  cardPrice: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  cardDist: { fontSize: 12, color: COLORS.textLight },
  stockDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 4 },
  cardStock: { fontSize: 12, color: COLORS.textLight },
  arrow: { fontSize: 24, color: COLORS.textLight, marginLeft: 8 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textLight, textAlign: 'center', lineHeight: 24 },
});
