import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getMyEvents, getEventChannels, diffuseEvent } from '../../api';
import { useToast } from '../../components/ui/Toast';
import { THEME } from '../../theme';

/**
 * Épée — Opportunité Volante.
 *
 * Une diffusion active n'est PAS un type d'initiative : c'est une stratégie. Le
 * producteur porte une initiative publiée et « flyable » vers les habitants
 * abonnés (Mode Réception). La surface choisit ; l'organe cible et diffuse.
 */
export default function DiffuseOpportunityScreen() {
  const toast = useToast();
  const [events, setEvents] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [note, setNote] = useState('');
  const [quota, setQuota] = useState('20');
  const [radiusKm, setRadiusKm] = useState('2');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const [evRes, chRes] = await Promise.all([getMyEvents(), getEventChannels()]);
      const flyable = (evRes.data.events || []).filter(
        (e) => e.capabilities?.isFlyable && ['published', 'live'].includes(e.status)
      );
      setEvents(flyable);
      setChannels(chRes.data.channels || []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function selectEvent(ev) {
    setSelectedEvent(ev);
    setSelectedChannels(ev.channels?.length ? ev.channels : []);
  }

  function toggleChannel(id) {
    setSelectedChannels((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function diffuse() {
    if (!selectedEvent) return;
    if (!selectedChannels.length) return Alert.alert('Canaux requis', 'Choisissez au moins un canal de diffusion.');
    const q = Math.floor(Number(String(quota).replace(',', '.')));
    const r = Number(String(radiusKm).replace(',', '.'));
    if (!Number.isFinite(q) || q < 1) return Alert.alert('Quota', 'Indiquez un nombre d\'opportunités ≥ 1.');
    if (!Number.isFinite(r) || r <= 0) return Alert.alert('Périmètre', 'Indiquez un rayon en km > 0.');
    setSending(true);
    try {
      // Clé d'idempotence : campagne = event + canaux + quota + rayon.
      const idempotencyKey = `${selectedEvent.id}:${[...selectedChannels].sort().join(',')}:q${q}:r${r}`;
      const res = await diffuseEvent(selectedEvent.id, {
        channels: selectedChannels,
        note: note.trim() || undefined,
        quota: q,
        radiusKm: r,
        idempotencyKey,
      });
      const reached = res.data?.reached;
      toast(res.data?.replayed
        ? 'Opportunité déjà diffusée'
        : `Opportunité envoyée${reached != null ? ` à ${reached} habitant${reached > 1 ? 's' : ''}` : ''}`);
      setSelectedEvent(null);
      setNote('');
    } catch (err) {
      Alert.alert('Diffusion impossible', err.response?.data?.error || 'Réessayez plus tard.');
    } finally {
      setSending(false);
    }
  }

  if (loading) return <ActivityIndicator style={styles.center} color={THEME.colors.accent} />;

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Opportunité Volante</Text>
      <Text style={styles.intro}>
        Portez activement une de vos initiatives vers les habitants à l'écoute autour de vous.
      </Text>

      <Text style={styles.label}>Initiative à diffuser</Text>
      {events.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="send-outline" size={36} color={THEME.colors.textMuted} />
          <Text style={styles.emptyText}>Aucune initiative diffusable</Text>
          <Text style={styles.emptyHint}>Publiez une initiative « flyable » (ex. dégustation) pour pouvoir la diffuser.</Text>
        </View>
      ) : (
        events.map((ev) => {
          const on = selectedEvent?.id === ev.id;
          return (
            <TouchableOpacity key={ev.id} style={[styles.eventCard, on && styles.eventCardOn]} onPress={() => selectEvent(ev)} activeOpacity={0.9}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.eventTitle, on && styles.eventTitleOn]}>{ev.title}</Text>
                <Text style={styles.eventMeta}>{ev.label}{ev.startsAt ? ` · ${ev.startsAt}` : ''}</Text>
              </View>
              <View style={[styles.radio, on && styles.radioOn]}>{on ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}</View>
            </TouchableOpacity>
          );
        })
      )}

      {selectedEvent ? (
        <>
          <Text style={styles.label}>Canaux de diffusion</Text>
          <View style={styles.chipWrap}>
            {channels.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, selectedChannels.includes(c.id) && styles.chipActive]}
                onPress={() => toggleChannel(c.id)}
              >
                <Text style={[styles.chipText, selectedChannels.includes(c.id) && styles.chipTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Campagne</Text>
          <Text style={styles.hint}>Le moteur sélectionne automatiquement les habitants abonnés dans le périmètre, les plus proches d'abord.</Text>
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.subLabel}>Nombre à diffuser</Text>
              <TextInput
                style={styles.input}
                value={quota}
                onChangeText={setQuota}
                keyboardType="number-pad"
                placeholder="ex : 20"
                placeholderTextColor={THEME.colors.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.subLabel}>Périmètre (km)</Text>
              <TextInput
                style={styles.input}
                value={radiusKm}
                onChangeText={setRadiusKm}
                keyboardType="decimal-pad"
                placeholder="ex : 2"
                placeholderTextColor={THEME.colors.textMuted}
              />
            </View>
          </View>

          <Text style={styles.label}>Note (optionnel)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={note}
            onChangeText={setNote}
            placeholder="Un mot qui donne envie de venir maintenant"
            placeholderTextColor={THEME.colors.textMuted}
            multiline
          />

          <TouchableOpacity style={styles.diffuseBtn} onPress={diffuse} disabled={sending} activeOpacity={0.9}>
            {sending ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="send" size={18} color="#fff" />
                <Text style={styles.diffuseText}>Diffuser l'opportunité</Text>
              </>
            )}
          </TouchableOpacity>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  center: { flex: 1 },
  content: { padding: THEME.spacing.md, paddingBottom: 60 },
  title: { ...THEME.typography.hero, fontSize: 24, color: THEME.colors.text },
  intro: { color: THEME.colors.textSecondary, marginTop: 4, marginBottom: 8, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '700', color: THEME.colors.textSecondary, marginTop: 18, marginBottom: 10, textTransform: 'uppercase' },
  empty: { alignItems: 'center', padding: 24 },
  emptyText: { color: THEME.colors.text, fontWeight: '700', marginTop: 10, fontSize: 15 },
  emptyHint: { color: THEME.colors.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 19 },
  eventCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.md, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: THEME.colors.borderLight,
  },
  eventCardOn: { borderColor: THEME.colors.accent, backgroundColor: THEME.colors.accentSoft },
  eventTitle: { fontSize: 15, fontWeight: '800', color: THEME.colors.text },
  eventTitleOn: { color: THEME.colors.accent },
  eventMeta: { fontSize: 12.5, color: THEME.colors.textMuted, marginTop: 3 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: THEME.colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: THEME.colors.accent, borderColor: THEME.colors.accent },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: THEME.radius.full,
    borderWidth: 1.5, borderColor: THEME.colors.border, backgroundColor: THEME.colors.card,
  },
  chipActive: { borderColor: THEME.colors.primary, backgroundColor: THEME.colors.primary },
  chipText: { fontWeight: '700', color: THEME.colors.text, fontSize: 13 },
  chipTextActive: { color: '#fff' },
  hint: { fontSize: 13, color: THEME.colors.textSecondary, marginTop: -4, marginBottom: 10, lineHeight: 18 },
  subLabel: { fontSize: 12, fontWeight: '700', color: THEME.colors.textMuted, marginBottom: 6 },
  row2: { flexDirection: 'row', gap: 10 },
  input: { backgroundColor: THEME.colors.card, borderRadius: 12, borderWidth: 1, borderColor: THEME.colors.border, padding: 14, fontSize: 15, color: THEME.colors.text },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  diffuseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: THEME.colors.primary, borderRadius: 14, padding: 18, marginTop: 24,
  },
  diffuseText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
