import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getEventDiscovery } from '../../api';
import EventListItem from '../../components/deuxiemeAme/EventListItem';
import { AME } from '../../theme';

/**
 * Porte « Les Lanternes » — vue composée sur listDiscoverable(capability isLantern).
 * Entrée vers le scan (découverte physique orchestrée par l'organe).
 */
export default function LanternsScreen({ navigation }) {
  const [lanterns, setLanterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getEventDiscovery({ capability: 'isLantern' });
      setLanterns(res.data.events || []);
    } catch {
      setLanterns([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <ActivityIndicator style={styles.center} color={AME.colors.accent} />;

  return (
    <FlatList
      style={styles.bg}
      data={lanterns}
      keyExtractor={(e) => e.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.intro}>Des trésors cachés à révéler en scannant leur lanterne, quelque part dans le quartier.</Text>
          <TouchableOpacity style={[styles.scanBtn, AME.shadow.md]} onPress={() => navigation.navigate('LanternScan')} activeOpacity={0.9}>
            <Ionicons name="scan-outline" size={20} color="#fff" />
            <Text style={styles.scanText}>Scanner une lanterne</Text>
          </TouchableOpacity>
          <Text style={styles.listTitle}>Lanternes actives</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="sparkles-outline" size={40} color={AME.colors.textMuted} />
          <Text style={styles.emptyText}>Aucune lanterne active</Text>
          <Text style={styles.emptyHint}>Ouvrez l'œil : elles apparaissent au fil des saisons du quartier.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <EventListItem event={item} onPress={() => navigation.navigate('EventDetail', { eventId: item.id })} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: AME.colors.bg },
  center: { flex: 1 },
  list: { padding: AME.spacing.md, paddingBottom: 40, flexGrow: 1 },
  intro: { color: AME.colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#7C3AED', borderRadius: AME.radius.md, padding: 16, marginBottom: 20,
  },
  scanText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  listTitle: { ...AME.typography.subtitle, color: AME.colors.text, marginBottom: 12 },
  empty: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 24 },
  emptyText: { color: AME.colors.text, fontWeight: '700', marginTop: 12, fontSize: 16 },
  emptyHint: { color: AME.colors.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 20 },
});
