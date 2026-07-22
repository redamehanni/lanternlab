import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getEventDiscovery } from '../../api';
import EventListItem from '../../components/deuxiemeAme/EventListItem';
import { THEME } from '../../theme';

/**
 * Porte « Les Événements » — vue composée sur la projection listDiscoverable.
 * On exclut les Lanternes (porte dédiée). L'organe fournit, la surface compose.
 */
export default function EventsScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getEventDiscovery();
      setEvents((res.data.events || []).filter((e) => !e.capabilities?.isLantern));
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <ActivityIndicator style={styles.center} color={THEME.colors.accent} />;

  return (
    <FlatList
      style={styles.bg}
      data={events}
      keyExtractor={(e) => e.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListHeaderComponent={
        <Text style={styles.intro}>Tout ce qui fait vivre le quartier en ce moment.</Text>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="calendar-outline" size={40} color={THEME.colors.textMuted} />
          <Text style={styles.emptyText}>Aucun événement pour l'instant</Text>
          <Text style={styles.emptyHint}>De nouvelles initiatives naîtront bientôt près de chez vous.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <EventListItem event={item} onPress={() => navigation.navigate('EventDetail', { eventId: item.id })} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  center: { flex: 1 },
  list: { padding: THEME.spacing.md, paddingBottom: 40, flexGrow: 1 },
  intro: { color: THEME.colors.textSecondary, fontSize: 14, marginBottom: 14 },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 },
  emptyText: { color: THEME.colors.text, fontWeight: '700', marginTop: 12, fontSize: 16 },
  emptyHint: { color: THEME.colors.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 20 },
});
