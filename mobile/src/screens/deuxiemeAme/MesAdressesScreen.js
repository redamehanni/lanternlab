import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getFavoriteStores } from '../../api';
import { imageUrl } from '../../utils/format';
import { THEME } from '../../theme';

/**
 * Porte « Mes adresses » — les lieux préférés de l'habitant. Réutilise l'organe
 * des favoris (getFavoriteStores) : la Deuxième Âme compose, elle ne duplique pas.
 */
export default function MesAdressesScreen({ navigation }) {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getFavoriteStores();
      setStores(res.data.stores || []);
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

  if (loading) return <ActivityIndicator style={styles.center} color={THEME.colors.accent} />;

  return (
    <FlatList
      style={styles.bg}
      data={stores}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListHeaderComponent={<Text style={styles.intro}>Vos coups de cœur locaux, réunis au même endroit.</Text>}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="heart-outline" size={40} color={THEME.colors.textMuted} />
          <Text style={styles.emptyText}>Aucune adresse favorite</Text>
          <Text style={styles.emptyHint}>Ajoutez un cœur sur un lieu pour le retrouver ici.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity style={[styles.card, THEME.shadow.sm]} onPress={() => openStore(item)} activeOpacity={0.9}>
          {item.photo_url ? (
            <Image source={{ uri: imageUrl(item.photo_url) }} style={styles.img} />
          ) : (
            <View style={[styles.img, styles.imgPh]}><Text style={{ fontSize: 26 }}>🏪</Text></View>
          )}
          <View style={styles.body}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            {item.address ? <Text style={styles.addr} numberOfLines={2}>{item.address}</Text> : null}
          </View>
          <Ionicons name="chevron-forward" size={20} color={THEME.colors.textMuted} />
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  center: { flex: 1 },
  list: { padding: THEME.spacing.md, paddingBottom: 40, flexGrow: 1 },
  intro: { color: THEME.colors.textSecondary, fontSize: 14, marginBottom: 14 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  img: { width: 56, height: 56, borderRadius: 12 },
  imgPh: { backgroundColor: THEME.colors.bg, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, marginHorizontal: 12 },
  name: { fontWeight: '700', fontSize: 16, color: THEME.colors.text },
  addr: { fontSize: 13, color: THEME.colors.textSecondary, marginTop: 4 },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyText: { color: THEME.colors.text, fontWeight: '700', marginTop: 12, fontSize: 16 },
  emptyHint: { color: THEME.colors.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 20 },
});
