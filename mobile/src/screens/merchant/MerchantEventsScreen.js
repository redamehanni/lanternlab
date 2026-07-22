import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { getMyEvents, publishEvent, cancelEvent } from '../../api';
import FadeIn from '../../components/ui/FadeIn';
import { useToast } from '../../components/ui/Toast';
import { THEME } from '../../theme';

/**
 * Épée — Mes initiatives locales.
 *
 * SURFACE : liste les initiatives produites par le commerçant et orchestre leur
 * cycle de vie (publier, annuler) via l'Event Engine. Aucune règle métier ici :
 * les transitions autorisées sont décidées par l'organe.
 */

const STATUS_META = {
  draft: { label: 'Brouillon', color: THEME.colors.textMuted, soft: THEME.colors.borderLight },
  scheduled: { label: 'Planifiée', color: THEME.colors.accent, soft: THEME.colors.accentSoft },
  published: { label: 'Publiée', color: THEME.colors.success, soft: THEME.colors.successSoft },
  live: { label: 'En cours', color: THEME.colors.success, soft: THEME.colors.successSoft },
  ended: { label: 'Terminée', color: THEME.colors.textMuted, soft: THEME.colors.borderLight },
  archived: { label: 'Archivée', color: THEME.colors.textMuted, soft: THEME.colors.borderLight },
  cancelled: { label: 'Annulée', color: THEME.colors.error, soft: THEME.colors.errorSoft },
};

function EventCard({ item, index, onPublish, onCancel }) {
  const meta = STATUS_META[item.status] || STATUS_META.draft;
  const canPublish = item.status === 'draft' || item.status === 'scheduled';
  const canCancel = ['draft', 'scheduled', 'published', 'live'].includes(item.status);
  return (
    <FadeIn delay={index * 40}>
      <View style={[styles.card, THEME.shadow.sm]}>
        <View style={styles.cardTop}>
          <View style={[styles.badge, { backgroundColor: meta.soft }]}>
            <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <Text style={styles.typeLabel}>{item.label}</Text>
        </View>
        <Text style={styles.eventTitle}>{item.title}</Text>
        {item.summary ? <Text style={styles.summary} numberOfLines={2}>{item.summary}</Text> : null}
        {item.startsAt ? <Text style={styles.meta}>Quand : {item.startsAt}</Text> : null}
        {item.address ? <Text style={styles.meta}>Où : {item.address}</Text> : null}
        {item.channels?.length ? <Text style={styles.meta}>Canaux : {item.channels.join(', ')}</Text> : null}
        {(canPublish || canCancel) && (
          <View style={styles.actions}>
            {canPublish && (
              <TouchableOpacity style={styles.publishBtn} onPress={() => onPublish(item)}>
                <Text style={styles.publishText}>Publier</Text>
              </TouchableOpacity>
            )}
            {canCancel && (
              <TouchableOpacity style={styles.cancelBtn} onPress={() => onCancel(item)}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </FadeIn>
  );
}

export default function MerchantEventsScreen({ navigation }) {
  const { socket } = useApp();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await getMyEvents();
      setItems(res.data.events || []);
    } catch {
      // La liste reste affichable même si l'organe est momentanément indisponible.
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!socket) return;
    const refresh = () => load();
    socket.on('event:published', refresh);
    socket.on('event:cancelled', refresh);
    socket.on('event:updated', refresh);
    return () => {
      socket.off('event:published', refresh);
      socket.off('event:cancelled', refresh);
      socket.off('event:updated', refresh);
    };
  }, [socket, load]);

  async function handlePublish(item) {
    try {
      await publishEvent(item.id);
      toast('Initiative publiée');
      load();
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.error || 'Publication impossible.');
    }
  }

  function handleCancel(item) {
    Alert.alert('Annuler l\'initiative', `Annuler « ${item.title} » ?`, [
      { text: 'Retour', style: 'cancel' },
      { text: 'Annuler l\'initiative', style: 'destructive', onPress: async () => {
        try {
          await cancelEvent(item.id);
          toast('Initiative annulée');
          load();
        } catch (err) {
          Alert.alert('Erreur', err.response?.data?.error || 'Annulation impossible.');
        }
      }},
    ]);
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={THEME.colors.accent} />;

  const activeCount = items.filter((e) => ['draft', 'scheduled', 'published', 'live'].includes(e.status)).length;

  return (
    <View style={styles.bg}>
      <FlatList
        data={items}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Vos initiatives</Text>
            <Text style={styles.sub}>{activeCount} en cours · {items.length} au total</Text>
            <TouchableOpacity
              style={[styles.createBtn, THEME.shadow.md]}
              onPress={() => navigation.navigate('CreateEvent')}
            >
              <Text style={styles.createBtnText}>+ Créer une initiative</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 48 }}>✨</Text>
            <Text style={styles.emptyText}>Aucune initiative pour l'instant</Text>
            <Text style={styles.emptyHint}>Faites naître un moment de vie locale dans votre quartier.</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <EventCard item={item} index={index} onPublish={handlePublish} onCancel={handleCancel} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  list: { padding: THEME.spacing.md, paddingBottom: 100 },
  title: { ...THEME.typography.hero, fontSize: 26, color: THEME.colors.text },
  sub: { color: THEME.colors.textSecondary, marginBottom: 16 },
  createBtn: {
    backgroundColor: THEME.colors.primary, borderRadius: THEME.radius.md,
    padding: 16, alignItems: 'center', marginBottom: 20,
  },
  createBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  card: {
    backgroundColor: THEME.colors.card, borderRadius: THEME.radius.lg,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontWeight: '700', fontSize: 12 },
  typeLabel: { color: THEME.colors.textMuted, fontWeight: '600', fontSize: 12 },
  eventTitle: { fontSize: 17, fontWeight: '800', color: THEME.colors.text, marginTop: 10 },
  summary: { color: THEME.colors.textSecondary, marginTop: 4, lineHeight: 20 },
  meta: { fontSize: 12, color: THEME.colors.textMuted, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  publishBtn: { flex: 1, backgroundColor: THEME.colors.primary, borderRadius: 10, padding: 12, alignItems: 'center' },
  publishText: { color: '#fff', fontWeight: '700' },
  cancelBtn: { flex: 1, backgroundColor: THEME.colors.errorSoft, borderRadius: 10, padding: 12, alignItems: 'center' },
  cancelText: { color: THEME.colors.error, fontWeight: '700' },
  empty: { alignItems: 'center', padding: 48 },
  emptyText: { color: THEME.colors.text, fontWeight: '700', marginTop: 12, fontSize: 16 },
  emptyHint: { color: THEME.colors.textSecondary, marginTop: 6, textAlign: 'center' },
});
