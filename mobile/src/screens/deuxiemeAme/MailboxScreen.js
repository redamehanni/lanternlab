import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getOpportunityInbox } from '../../api';
import { AME } from '../../theme';

const SORTS = [
  { id: 'date', label: 'Date', icon: 'time-outline' },
  { id: 'distance', label: 'Distance', icon: 'navigate-outline' },
  { id: 'interest', label: 'Centres d\'intérêt', icon: 'pricetags-outline' },
  { id: 'seats', label: 'Places', icon: 'people-outline' },
];

/**
 * Boîte aux lettres — espace personnel des Opportunités Volantes reçues.
 * Surface pure : lecture + tri, aucune règle de ciblage. L'organe a déjà décidé
 * qui reçoit ; ici on explore et on ouvre le parcours d'acceptation.
 */
export default function MailboxScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [sort, setSort] = useState('date');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (nextSort = sort) => {
    try {
      const res = await getOpportunityInbox({ sort: nextSort });
      setItems(res.data.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sort]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  function changeSort(id) {
    setSort(id);
    setLoading(true);
    load(id);
  }

  function openItem(item) {
    navigation.navigate('OpportunityInterest', { inboxId: item.id, preview: item });
  }

  if (loading && !refreshing) {
    return <ActivityIndicator style={styles.center} color={AME.colors.accent} />;
  }

  return (
    <View style={styles.bg}>
      <View style={styles.sortRow}>
        {SORTS.map((s) => {
          const on = sort === s.id;
          return (
            <TouchableOpacity key={s.id} style={[styles.sortChip, on && styles.sortChipOn]} onPress={() => changeSort(s.id)}>
              <Ionicons name={s.icon} size={14} color={on ? '#fff' : AME.colors.textSecondary} />
              <Text style={[styles.sortText, on && styles.sortTextOn]}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <Ionicons name="mail-open-outline" size={42} color={AME.colors.textMuted} />
            <Text style={styles.emptyTitle}>Boîte vide</Text>
            <Text style={styles.emptyHint}>Les opportunités volantes autour de vous apparaîtront ici.</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const ev = item.event || {};
          const statusLabel = item.status === 'accepted' ? 'Acceptée' : item.status === 'dismissed' ? 'Passée' : 'Nouvelle';
          return (
            <TouchableOpacity style={styles.card} onPress={() => openItem(item)} activeOpacity={0.88}>
              <View style={styles.cardTop}>
                <Text style={styles.category}>{(ev.label || ev.type || '').toUpperCase()}</Text>
                <View style={[styles.pill, item.status !== 'received' && styles.pillMuted]}>
                  <Text style={styles.pillText}>{statusLabel}</Text>
                </View>
              </View>
              <Text style={styles.title}>{ev.title}</Text>
              {ev.summary ? <Text style={styles.summary} numberOfLines={2}>{ev.summary}</Text> : null}
              <View style={styles.metaRow}>
                {item.distanceKm != null ? (
                  <Meta icon="navigate-outline" text={`${item.distanceKm} km`} />
                ) : null}
                {ev.startsAt ? <Meta icon="time-outline" text={ev.startsAt} /> : null}
                {ev.reservation?.required && ev.reservation.seatsLeft != null ? (
                  <Meta icon="people-outline" text={`${ev.reservation.seatsLeft} place${ev.reservation.seatsLeft > 1 ? 's' : ''}`} />
                ) : null}
                {(item.channels || []).slice(0, 1).map((c) => (
                  <Meta key={c} icon="pricetag-outline" text={c.replace(/_/g, ' ')} />
                ))}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

function Meta({ icon, text }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={12} color={AME.colors.textMuted} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: AME.colors.bg },
  center: { flex: 1 },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: AME.spacing.md, paddingTop: 12, paddingBottom: 4 },
  sortChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: AME.radius.full,
    borderWidth: 1.5, borderColor: AME.colors.border, backgroundColor: AME.colors.card,
  },
  sortChipOn: { backgroundColor: AME.colors.primary, borderColor: AME.colors.primary },
  sortText: { fontSize: 12.5, fontWeight: '700', color: AME.colors.textSecondary },
  sortTextOn: { color: '#fff' },
  list: { padding: AME.spacing.md, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: AME.colors.text, marginTop: 12 },
  emptyHint: { fontSize: 14, color: AME.colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  card: {
    backgroundColor: AME.colors.card, borderRadius: AME.radius.lg, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: AME.colors.borderLight,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  category: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1, color: AME.colors.accent },
  pill: { backgroundColor: AME.colors.accentSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  pillMuted: { backgroundColor: AME.colors.borderLight },
  pillText: { fontSize: 11, fontWeight: '700', color: AME.colors.text },
  title: { fontSize: 16, fontWeight: '800', color: AME.colors.text, marginTop: 6 },
  summary: { fontSize: 13.5, color: AME.colors.textSecondary, marginTop: 4, lineHeight: 19 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: AME.colors.textMuted, fontWeight: '600' },
});
