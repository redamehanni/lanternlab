import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { getEventById, requestEventTicket } from '../../api';
import { useToast } from '../../components/ui/Toast';
import { AME } from '../../theme';

/**
 * Détail d'une initiative. Rendu piloté par `event.display` (aucune règle métier
 * ici). Actions orchestrées par l'organe : billet (Wallet) si canTicket.
 * Pour une Lanterne, on présente son QR physique (l'artefact posé dans la ville).
 */
export default function EventDetailScreen({ route, navigation }) {
  const { eventId } = route.params || {};
  const toast = useToast();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ticketing, setTicketing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getEventById(eventId);
      setEvent(res.data.event);
    } catch {
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleTicket() {
    setTicketing(true);
    try {
      await requestEventTicket(eventId);
      toast('Billet ajouté à votre Wallet');
      await load(); // rafraîchit la jauge (places restantes)
      navigation.navigate('WalletTab');
    } catch (err) {
      toast(err.response?.data?.error || 'Impossible d\u2019obtenir un billet.');
    } finally {
      setTicketing(false);
    }
  }

  if (loading) return <ActivityIndicator style={styles.center} color={AME.colors.accent} />;
  if (!event) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={40} color={AME.colors.textMuted} />
        <Text style={styles.errText}>Initiative introuvable</Text>
      </View>
    );
  }

  const d = event.display || {};
  const caps = event.capabilities || {};
  const title = d.title || event.title;
  const subtitle = d.subtitle || event.summary;
  const resv = event.reservation || null; // fourni par l'organe si type billetterie
  const priceLabel = resv && resv.price > 0 ? `${resv.price} ${resv.currency || 'EUR'}` : 'Gratuit';

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.content}>
      {d.category ? <Text style={styles.category}>{String(d.category).toUpperCase()}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      <View style={styles.metaCard}>
        {(d.when || event.startsAt) ? (
          <Meta icon="time-outline" label="Quand" value={d.when || event.startsAt} />
        ) : null}
        {(d.where || event.address) ? (
          <Meta icon="location-outline" label="Où" value={d.where || event.address} />
        ) : null}
        {event.channels?.length ? (
          <Meta icon="pricetags-outline" label="Canaux" value={event.channels.join(', ')} />
        ) : null}
      </View>

      {event.body ? <Text style={styles.body}>{event.body}</Text> : null}

      {/* Régime de réservation — piloté par l'organe (event.reservation). */}
      {resv && resv.required ? (
        <View style={styles.reservationCard}>
          <View style={styles.reservationHead}>
            <Ionicons name="ticket-outline" size={18} color={AME.colors.accent} />
            <Text style={styles.reservationTitle}>Sur réservation · {priceLabel}</Text>
          </View>
          {resv.capacity != null ? (
            <Text style={styles.reservationSeats}>
              {resv.soldOut ? 'Complet' : `${resv.seatsLeft} place${resv.seatsLeft > 1 ? 's' : ''} restante${resv.seatsLeft > 1 ? 's' : ''} sur ${resv.capacity}`}
            </Text>
          ) : null}
          <TouchableOpacity
            style={[styles.cta, resv.soldOut && styles.ctaDisabled, AME.shadow.md]}
            onPress={handleTicket}
            disabled={ticketing || resv.soldOut}
            activeOpacity={0.9}
          >
            {ticketing ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name={resv.soldOut ? 'lock-closed-outline' : 'ticket-outline'} size={20} color="#fff" />
                <Text style={styles.ctaText}>
                  {resv.soldOut ? 'Complet' : (resv.price > 0 ? `Réserver — ${priceLabel}` : 'Réserver ma place (gratuit)')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : caps.canTicket ? (
        <View style={styles.openCard}>
          <Ionicons name="people-outline" size={18} color={AME.colors.accent} />
          <Text style={styles.openText}>Ouvert à tous — participation libre, aucune réservation nécessaire.</Text>
        </View>
      ) : null}

      {caps.isLantern ? (
        <View style={[styles.qrCard, AME.shadow.sm]}>
          <Text style={styles.qrTitle}>QR de cette lanterne</Text>
          <Text style={styles.qrHint}>À imprimer et poser sur le lieu. Les habitants le scannent pour révéler la lanterne.</Text>
          <View style={styles.qrBox}>
            <QRCode value={String(event.id)} size={180} backgroundColor="#FFFFFF" color={AME.colors.primary} />
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Meta({ icon, label, value }) {
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon} size={16} color={AME.colors.textMuted} />
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: AME.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  errText: { color: AME.colors.textSecondary, fontSize: 15, fontWeight: '600' },
  content: { padding: AME.spacing.md, paddingBottom: 48 },
  category: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: AME.colors.accent },
  title: { ...AME.typography.hero, fontSize: 26, color: AME.colors.text, marginTop: 6 },
  subtitle: { fontSize: 15, color: AME.colors.textSecondary, marginTop: 8, lineHeight: 22 },
  metaCard: {
    backgroundColor: AME.colors.card, borderRadius: AME.radius.lg, padding: 16, marginTop: 18,
    borderWidth: 1, borderColor: AME.colors.borderLight, gap: 12,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaLabel: { fontSize: 12.5, fontWeight: '700', color: AME.colors.textMuted, width: 56 },
  metaValue: { fontSize: 13.5, color: AME.colors.text, flex: 1 },
  body: { fontSize: 15, color: AME.colors.text, lineHeight: 23, marginTop: 18 },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: AME.colors.primary, borderRadius: AME.radius.md, padding: 16, marginTop: 14,
  },
  ctaDisabled: { backgroundColor: AME.colors.textMuted },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  reservationCard: {
    backgroundColor: AME.colors.card, borderRadius: AME.radius.lg, padding: 16, marginTop: 22,
    borderWidth: 1, borderColor: AME.colors.borderLight,
  },
  reservationHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reservationTitle: { fontSize: 15, fontWeight: '800', color: AME.colors.text },
  reservationSeats: { fontSize: 13, color: AME.colors.textSecondary, marginTop: 6 },
  openCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22,
    backgroundColor: AME.colors.accentSoft, borderRadius: AME.radius.md, padding: 14,
  },
  openText: { flex: 1, fontSize: 13.5, color: AME.colors.text, lineHeight: 19 },
  qrCard: {
    backgroundColor: AME.colors.card, borderRadius: AME.radius.lg, padding: 18, marginTop: 22,
    borderWidth: 1, borderColor: AME.colors.borderLight, alignItems: 'center',
  },
  qrTitle: { fontSize: 15, fontWeight: '800', color: AME.colors.text },
  qrHint: { fontSize: 12.5, color: AME.colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  qrBox: { backgroundColor: '#fff', padding: 16, borderRadius: AME.radius.md, marginTop: 16 },
});
