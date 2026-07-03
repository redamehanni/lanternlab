import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getStores } from '../../api';
import { imageUrl } from '../../utils/format';
import { COLORS, STORE_CATEGORIES } from '../../config';

const ALL = 'Tout';

export default function StoresScreen({ navigation }) {
  const [stores,   setStores]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [category, setCategory] = useState(ALL);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getStores();
      setStores(res.data.stores || []);
    } catch {
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = category === ALL
    ? stores
    : stores.filter(s => (s.category || '').toLowerCase() === category.toLowerCase());

  const categories = [ALL, ...STORE_CATEGORIES];

  return (
    <View style={styles.bg}>
      <View style={styles.catBarWrap}>
        <FlatList
          data={categories} horizontal showsHorizontalScrollIndicator={false}
          keyExtractor={(c) => c} contentContainerStyle={styles.catBar}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.catChip, category === item && styles.catChipActive]} onPress={() => setCategory(item)}>
              <Text style={[styles.catChipText, category === item && styles.catChipTextActive]}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={s => s.id}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          ListEmptyComponent={<Text style={styles.empty}>Aucun commerce{category !== ALL ? ` « ${category} »` : ''}.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} activeOpacity={0.85}
              onPress={() => navigation.navigate('StoreDetail', { storeId: item.id })}>
              {item.photo_url ? (
                <Image source={{ uri: imageUrl(item.photo_url) }} style={styles.img} />
              ) : (
                <View style={[styles.img, styles.noImg]}><Text style={{ fontSize: 30 }}>🏪</Text></View>
              )}
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                {item.category ? <Text style={styles.cat}>{item.category}</Text> : null}
                <Text style={styles.addr} numberOfLines={1}>{item.address}</Text>
                <View style={styles.metaRow}>
                  {item.distance_km != null && <Text style={styles.dist}>{item.distance_km} km</Text>}
                  <Text style={styles.count}>· {item.product_count} produit(s)</Text>
                  <Text style={styles.rating}>· ⭐ 5,0</Text>
                </View>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  catBarWrap: { height: 52, justifyContent: 'center' },
  catBar: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, height: 34, justifyContent: 'center',
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catChipText: { fontSize: 13, color: COLORS.text },
  catChipTextActive: { color: '#fff', fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, padding: 12, marginBottom: 10 },
  img: { width: 76, height: 76, borderRadius: 10, resizeMode: 'cover' },
  noImg: { backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  cat: { fontSize: 12, color: COLORS.secondary, fontWeight: '600', marginTop: 1 },
  addr: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 3, flexWrap: 'wrap' },
  dist: { fontSize: 12, color: COLORS.text, fontWeight: '600' },
  count: { fontSize: 12, color: COLORS.textLight },
  rating: { fontSize: 12, color: COLORS.warning },
  arrow: { fontSize: 24, color: COLORS.textLight, marginLeft: 8 },
  empty: { textAlign: 'center', color: COLORS.textLight, padding: 48, fontSize: 15 },
});
