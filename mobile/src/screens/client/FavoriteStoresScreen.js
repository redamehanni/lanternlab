import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getFavoriteStores } from '../../api';
import { imageUrl } from '../../utils/format';
import { THEME } from '../../theme';

export default function FavoriteStoresScreen({ navigation }) {
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
    navigation.navigate('HomeMain', {
      screen: 'StoreDetail',
      params: { storeId: store.id, store },
    });
  }

  if (loading) {
    return <ActivityIndicator style={styles.center} size="large" color={THEME.colors.accent} />;
  }

  return (
    <FlatList
      style={styles.bg}
      data={stores}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 12, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="heart-outline" size={40} color={THEME.colors.textMuted} />
          <Text style={styles.emptyTitle}>Aucun coup de cœur</Text>
          <Text style={styles.emptySub}>Ajoutez un ❤️ sur une boutique depuis sa fiche pour la retrouver ici.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity style={[styles.card, THEME.shadow.sm]} onPress={() => openStore(item)} activeOpacity={0.88}>
          {item.photo_url ? (
            <Image source={{ uri: imageUrl(item.photo_url) }} style={styles.img} />
          ) : (
            <View style={[styles.img, styles.imgPh]}><Text style={{ fontSize: 28 }}>🏪</Text></View>
          )}
          <View style={styles.body}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.addr} numberOfLines={2}>{item.address}</Text>
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
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyTitle: { ...THEME.typography.subtitle, color: THEME.colors.text, marginTop: 12 },
  emptySub: { textAlign: 'center', color: THEME.colors.textSecondary, marginTop: 8, lineHeight: 22 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  img: { width: 56, height: 56, borderRadius: 12 },
  imgPh: { backgroundColor: THEME.colors.bg, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, marginHorizontal: 12 },
  name: { fontWeight: '700', fontSize: 16, color: THEME.colors.text },
  addr: { fontSize: 13, color: THEME.colors.textSecondary, marginTop: 4 },
});
