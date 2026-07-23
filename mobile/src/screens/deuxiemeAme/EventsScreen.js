import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getEventDiscovery } from '../../api';
import EventListItem from '../../components/deuxiemeAme/EventListItem';
import { AME } from '../../theme';

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

  if (loading) return <ActivityIndicator style={styles.center} color={AME.colors.accent} />;

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
          <Ionicons name="calendar-outline" size={40} color={AME.colors.textMuted} />
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
  bg: { flex: 1, backgroundColor: AME.colors.bg },
  center: { flex: 1 },
  list: { padding: AME.spacing.md, paddingBottom: 40, flexGrow: 1 },
  intro: {
    fontFamily: AME.fonts.ui,
    color: AME.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 },
  emptyText: {
    fontFamily: AME.fonts.display,
    color: AME.colors.text,
    marginTop: 12,
    fontSize: 20,
  },
  emptyHint: {
    fontFamily: AME.fonts.ui,
    color: AME.colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
  },
});
