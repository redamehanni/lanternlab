import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { acceptOpportunity, dismissOpportunity } from '../../api';
import { useToast } from '../../components/ui/Toast';
import { THEME } from '../../theme';

/**
 * Parcours d'acceptation d'une Opportunité Volante.
 *
 * Affichage → « Cette opportunité vous intéresse ? »
 *  - Oui → ticket/badge Wallet + message de confirmation
 *  - Non → dismiss (reste consultable comme « passée »)
 *
 * Aucune règle métier ici : l'organe matérialise l'objet Wallet.
 */
export default function OpportunityInterestScreen({ route, navigation }) {
  const { inboxId, preview } = route.params || {};
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [accepted, setAccepted] = useState(preview?.status === 'accepted');

  const ev = preview?.event || {};
  const alreadyDone = preview?.status === 'accepted' || preview?.status === 'dismissed';

  async function onYes() {
    setBusy(true);
    try {
      await acceptOpportunity(inboxId);
      setAccepted(true);
      setDone(true);
      toast('Ticket ajouté à votre Wallet');
    } catch (err) {
      toast(err.response?.data?.error || 'Acceptation impossible');
    } finally {
      setBusy(false);
    }
  }

  async function onNo() {
    setBusy(true);
    try {
      await dismissOpportunity(inboxId);
      toast('Opportunité mise de côté');
      navigation.goBack();
    } catch {
      toast('Action impossible');
    } finally {
      setBusy(false);
    }
  }

  if (done || accepted) {
    return (
      <View style={styles.bg}>
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <Ionicons name="ticket-outline" size={36} color={THEME.colors.accent} />
          </View>
          <Text style={styles.successTitle}>Super !</Text>
          <Text style={styles.successText}>
            Retrouvez votre ticket d'accès à cet événement dans votre Wallet.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('WalletTab')}
            activeOpacity={0.9}
          >
            <Ionicons name="wallet-outline" size={18} color="#fff" />
            <Text style={styles.primaryText}>Ouvrir mon Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryText}>Retour à la boîte</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.content}>
      <Text style={styles.category}>{(ev.label || ev.type || 'OPPORTUNITÉ').toUpperCase()}</Text>
      <Text style={styles.title}>{ev.title}</Text>
      {ev.summary ? <Text style={styles.summary}>{ev.summary}</Text> : null}

      <View style={styles.metaCard}>
        {preview?.distanceKm != null ? (
          <Row icon="navigate-outline" label="Distance" value={`${preview.distanceKm} km`} />
        ) : null}
        {ev.address ? <Row icon="location-outline" label="Lieu" value={ev.address} /> : null}
        {ev.startsAt ? <Row icon="time-outline" label="Quand" value={ev.startsAt} /> : null}
        {ev.reservation?.required ? (
          <Row
            icon="ticket-outline"
            label="Réservation"
            value={ev.reservation.price > 0
              ? `${ev.reservation.price} ${ev.reservation.currency || 'EUR'}`
              : 'Gratuit'}
          />
        ) : null}
      </View>

      {!alreadyDone ? (
        <View style={styles.askCard}>
          <Text style={styles.askTitle}>Cette opportunité vous intéresse ?</Text>
          <Text style={styles.askHint}>
            Si oui, un ticket d'accès sera ajouté automatiquement à votre Wallet.
          </Text>
          <View style={styles.askRow}>
            <TouchableOpacity style={styles.noBtn} onPress={onNo} disabled={busy} activeOpacity={0.85}>
              {busy ? <ActivityIndicator color={THEME.colors.text} /> : <Text style={styles.noText}>Non</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.yesBtn} onPress={onYes} disabled={busy} activeOpacity={0.9}>
              {busy ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="heart" size={18} color="#fff" />
                  <Text style={styles.yesText}>Oui</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('EventDetail', { eventId: ev.id })}>
          <Text style={styles.primaryText}>Voir le détail</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function Row({ icon, label, value }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={THEME.colors.textMuted} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { padding: THEME.spacing.md, paddingBottom: 48 },
  category: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: THEME.colors.accent },
  title: { ...THEME.typography.hero, fontSize: 26, color: THEME.colors.text, marginTop: 6 },
  summary: { fontSize: 15, color: THEME.colors.textSecondary, marginTop: 8, lineHeight: 22 },
  metaCard: {
    backgroundColor: THEME.colors.card, borderRadius: THEME.radius.lg, padding: 16, marginTop: 18,
    borderWidth: 1, borderColor: THEME.colors.borderLight, gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { fontSize: 12.5, fontWeight: '700', color: THEME.colors.textMuted, width: 88 },
  rowValue: { fontSize: 13.5, color: THEME.colors.text, flex: 1 },
  askCard: {
    marginTop: 24, backgroundColor: THEME.colors.card, borderRadius: THEME.radius.lg, padding: 18,
    borderWidth: 1.5, borderColor: THEME.colors.accent,
  },
  askTitle: { fontSize: 17, fontWeight: '800', color: THEME.colors.text, textAlign: 'center' },
  askHint: { fontSize: 13.5, color: THEME.colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  askRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  noBtn: {
    flex: 1, padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: THEME.colors.border,
    alignItems: 'center', backgroundColor: THEME.colors.bg,
  },
  noText: { fontWeight: '800', color: THEME.colors.textSecondary, fontSize: 16 },
  yesBtn: {
    flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 16, borderRadius: 14, backgroundColor: THEME.colors.primary,
  },
  yesText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  successCard: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: THEME.colors.accentSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  successTitle: { fontSize: 28, fontWeight: '900', color: THEME.colors.text },
  successText: { fontSize: 16, color: THEME.colors.textSecondary, textAlign: 'center', marginTop: 10, lineHeight: 24 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: THEME.colors.primary, borderRadius: 14, padding: 16, marginTop: 28, alignSelf: 'stretch',
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondaryBtn: { marginTop: 14, padding: 12 },
  secondaryText: { color: THEME.colors.accent, fontWeight: '700', fontSize: 15 },
});
