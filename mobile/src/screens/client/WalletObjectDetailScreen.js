import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getWalletObject, getWalletObjectEvents } from '../../api';
import FadeIn from '../../components/ui/FadeIn';
import { THEME } from '../../theme';
import { STATUS_META } from './walletStatus';

const EVENT_LABEL = {
  issued: 'Créé',
  consumed: 'Utilisé',
  revoked: 'Annulé',
  expired: 'Expiré',
  reserved: 'Réservé',
  released: 'Libéré',
  transferred: 'Transféré',
  enriched: 'Enrichi',
};

export default function WalletObjectDetailScreen({ route }) {
  const { objectId } = route.params;
  const [object, setObject] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [objRes, evRes] = await Promise.all([
        getWalletObject(objectId),
        getWalletObjectEvents(objectId),
      ]);
      setObject(objRes.data.object);
      setEvents(evRes.data.events || []);
    } catch {
      setObject(null);
    } finally {
      setLoading(false);
    }
  }, [objectId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function onCapability(cap) {
    // Le Wallet EXPOSE l'action ; il ne l'exécute pas. L'organe responsable
    // (handledBy) la traitera lorsqu'il sera disponible.
    Alert.alert(cap.label, `Cette action sera gérée par : ${cap.handledBy}.`);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={THEME.colors.accent} />
      </View>
    );
  }

  if (!object) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Objet introuvable.</Text>
      </View>
    );
  }

  const meta = STATUS_META[object.status] || STATUS_META.active;
  const payloadEntries = object.payload && typeof object.payload === 'object'
    ? Object.entries(object.payload)
    : [];

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.content}>
      <FadeIn>
        <View style={styles.header}>
          <Text style={styles.title}>{object.display?.title || object.label}</Text>
          {object.display?.subtitle ? (
            <Text style={styles.subtitle}>{object.display.subtitle}</Text>
          ) : null}
          <View style={styles.badgeRow}>
            <View style={[styles.statusPill, { backgroundColor: meta.color + '18' }]}>
              <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
              <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
            </View>
            {object.isMemory && (
              <View style={[styles.statusPill, { backgroundColor: THEME.colors.accentSoft }]}>
                <Ionicons name="sparkles-outline" size={13} color={THEME.colors.accent} />
                <Text style={[styles.statusPillText, { color: THEME.colors.accent }]}> Souvenir</Text>
              </View>
            )}
          </View>
        </View>
      </FadeIn>

      {payloadEntries.length > 0 && (
        <FadeIn delay={60}>
          <View style={[styles.section, THEME.shadow.sm]}>
            {payloadEntries.map(([key, val]) => (
              <View key={key} style={styles.infoRow}>
                <Text style={styles.infoKey}>{key}</Text>
                <Text style={styles.infoVal}>{String(val)}</Text>
              </View>
            ))}
          </View>
        </FadeIn>
      )}

      {object.capabilities && object.capabilities.length > 0 && (
        <FadeIn delay={120}>
          <Text style={styles.sectionTitle}>Gérer cet objet numérique</Text>
          <View style={[styles.section, THEME.shadow.sm]}>
            {object.capabilities.map((cap, i) => (
              <TouchableOpacity
                key={cap.id}
                style={[styles.capRow, i < object.capabilities.length - 1 && styles.capDivider]}
                onPress={() => onCapability(cap)}
                activeOpacity={0.7}
              >
                <Ionicons name={cap.icon || 'ellipse-outline'} size={20} color={THEME.colors.accent} />
                <Text style={styles.capLabel}>{cap.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </FadeIn>
      )}

      <FadeIn delay={180}>
        <Text style={styles.sectionTitle}>Histoire de l'objet</Text>
        <View style={[styles.section, THEME.shadow.sm]}>
          {events.map((ev, i) => (
            <View key={ev.id} style={[styles.eventRow, i < events.length - 1 && styles.capDivider]}>
              <View style={styles.eventDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.eventLabel}>{EVENT_LABEL[ev.type] || ev.type}</Text>
                <Text style={styles.eventDate}>{ev.createdAt}</Text>
              </View>
            </View>
          ))}
        </View>
      </FadeIn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { padding: THEME.spacing.md, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.colors.bg },
  emptyText: { ...THEME.typography.body, color: THEME.colors.textSecondary },
  header: { marginBottom: THEME.spacing.lg },
  title: { ...THEME.typography.hero, color: THEME.colors.text, marginBottom: 4 },
  subtitle: { ...THEME.typography.body, color: THEME.colors.textSecondary, marginBottom: 10 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: THEME.radius.full },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusPillText: { fontSize: 13, fontWeight: '600' },
  section: {
    backgroundColor: THEME.colors.card, borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md, marginBottom: THEME.spacing.lg,
    borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  sectionTitle: { ...THEME.typography.caption, color: THEME.colors.textMuted, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  infoKey: { fontSize: 14, color: THEME.colors.textSecondary, textTransform: 'capitalize' },
  infoVal: { fontSize: 14, color: THEME.colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: 12 },
  capRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  capDivider: { borderBottomWidth: 1, borderBottomColor: THEME.colors.borderLight },
  capLabel: { flex: 1, ...THEME.typography.subtitle, fontWeight: '500', color: THEME.colors.text },
  eventRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  eventDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: THEME.colors.accent, marginRight: 14 },
  eventLabel: { ...THEME.typography.subtitle, fontWeight: '600', color: THEME.colors.text },
  eventDate: { fontSize: 12, color: THEME.colors.textMuted, marginTop: 2 },
});
