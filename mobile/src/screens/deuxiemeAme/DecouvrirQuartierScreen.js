import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getStores } from '../../api';
import { imageUrl } from '../../utils/format';
import { AME } from '../../theme';

/**
 * Porte « Découvrir mon quartier ».
 *
 * Première version : les lieux vivants du quartier = les commerces de la
 * Marketplace (organe existant). Le patrimoine, les cafés et coins inspirants
 * curatés arriveront via leurs organes (annoncés honnêtement ci-dessous). La
 * Deuxième Âme compose : elle réutilise les organes, sans les réimplémenter.
 */
const FUTURE_CATEGORIES = [
  { id: 'patrimoine', label: 'Patrimoine', icon: 'business-outline' },
  { id: 'cafes', label: 'Cafés & terrasses', icon: 'cafe-outline' },
  { id: 'nature', label: 'Coins nature', icon: 'leaf-outline' },
  { id: 'inspirants', label: 'Lieux inspirants', icon: 'bulb-outline' },
];

export default function DecouvrirQuartierScreen({ navigation }) {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getStores();
      setStores(res.data.stores || res.data || []);
    } catch {
      setStores([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openStore(store) {
    navigation.navigate('StoreDetail', { storeId: store.id, store });
  }

  if (loading) return <ActivityIndicator style={styles.center} color={AME.colors.accent} />;

  return (
    <FlatList
      style={styles.bg}
      data={stores}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.intro}>Les lieux qui font battre le cœur de votre quartier.</Text>
          <View style={styles.futureRow}>
            {FUTURE_CATEGORIES.map((c) => (
              <View key={c.id} style={styles.futureChip}>
                <Ionicons name={c.icon} size={15} color={AME.colors.textMuted} />
                <Text style={styles.futureText}>{c.label}</Text>
                <View style={styles.futureSoon}><Text style={styles.futureSoonText}>Bientôt</Text></View>
              </View>
            ))}
          </View>
          <Text style={styles.sectionTitle}>Commerces autour de vous</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="compass-outline" size={40} color={AME.colors.textMuted} />
          <Text style={styles.emptyText}>Aucun lieu à afficher</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity style={[styles.card, AME.shadow.sm]} onPress={() => openStore(item)} activeOpacity={0.9}>
          {item.photo_url ? (
            <Image source={{ uri: imageUrl(item.photo_url) }} style={styles.img} />
          ) : (
            <View style={[styles.img, styles.imgPh]}><Text style={{ fontSize: 26 }}>🏪</Text></View>
          )}
          <View style={styles.body}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            {item.address ? <Text style={styles.addr} numberOfLines={2}>{item.address}</Text> : null}
          </View>
          <Ionicons name="chevron-forward" size={20} color={AME.colors.textMuted} />
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: AME.colors.bg },
  center: { flex: 1 },
  list: { padding: AME.spacing.md, paddingBottom: 40, flexGrow: 1 },
  intro: { color: AME.colors.textSecondary, fontSize: 14, marginBottom: 14 },
  futureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  futureChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: AME.colors.card,
    borderRadius: AME.radius.full, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: AME.colors.borderLight,
  },
  futureText: { fontSize: 12.5, color: AME.colors.textSecondary, fontWeight: '600' },
  futureSoon: { backgroundColor: AME.colors.warningSoft, borderRadius: AME.radius.full, paddingHorizontal: 6, paddingVertical: 1 },
  futureSoonText: { fontSize: 9, fontWeight: '800', color: AME.colors.warning },
  sectionTitle: { ...AME.typography.subtitle, color: AME.colors.text, marginBottom: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: AME.colors.card,
    borderRadius: AME.radius.lg, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: AME.colors.borderLight,
  },
  img: { width: 56, height: 56, borderRadius: 12 },
  imgPh: { backgroundColor: AME.colors.bg, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, marginHorizontal: 12 },
  name: { fontWeight: '700', fontSize: 16, color: AME.colors.text },
  addr: { fontSize: 13, color: AME.colors.textSecondary, marginTop: 4 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: AME.colors.text, fontWeight: '700', marginTop: 12, fontSize: 16 },
});
