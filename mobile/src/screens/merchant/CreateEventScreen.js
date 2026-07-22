import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getEventTypes, getEventChannels, createEvent, publishEvent } from '../../api';
import { useToast } from '../../components/ui/Toast';
import { THEME } from '../../theme';

/**
 * Épée — Créer une initiative locale.
 *
 * SURFACE, PAS ORGANE : cet écran ne contient aucune règle métier. Il lit les
 * types, canaux et capacités déclarés par l'Event Engine (registre Open/Closed)
 * et demande à l'organe de créer l'initiative.
 *
 * Réservation : choix d'INSTANCE (ouvert à tous vs places limitées, gratuit ou
 * payant), traduit en `payload.reservation` — le modèle générique de l'organe.
 * Aucune logique de billetterie ici : elle vit dans le Wallet, orchestrée par
 * l'Event Engine. Le modèle est extensible (futurs régimes) sans nouvel écran.
 */
export default function CreateEventScreen({ navigation }) {
  const toast = useToast();
  const [types, setTypes] = useState([]);
  const [channels, setChannels] = useState([]);
  const [type, setType] = useState(null);
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [address, setAddress] = useState('');

  // Régime de réservation (choix d'instance).
  const [reservationMode, setReservationMode] = useState('open'); // 'open' | 'ticket'
  const [tarif, setTarif] = useState('free'); // 'free' | 'paid'
  const [price, setPrice] = useState('');
  const [capacity, setCapacity] = useState('');

  const [publishNow, setPublishNow] = useState(true);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadMeta = useCallback(async () => {
    setReady(false);
    setLoadError(false);
    try {
      const [typesRes, channelsRes] = await Promise.all([getEventTypes(), getEventChannels()]);
      // Un commerçant produit surtout des initiatives de commerce : on masque
      // les types curés par l'équipe (ex. Lanterne) côté production commerçant.
      const producible = (typesRes.data.types || []).filter((t) => !t.capabilities?.isLantern);
      setTypes(producible);
      setChannels(channelsRes.data.channels || []);
      if (producible[0]) {
        setType(producible[0].type);
        setSelectedChannels(producible[0].defaultChannels || []);
      }
    } catch {
      setTypes([]);
      setLoadError(true);
      toast('Impossible de charger les types. Vérifiez la connexion.');
    } finally {
      setReady(true);
    }
  }, [toast]);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  const selectedType = useMemo(() => types.find((t) => t.type === type) || null, [types, type]);
  const ticketable = !!selectedType?.capabilities?.canTicket;

  function selectType(t) {
    setType(t.type);
    setSelectedChannels(t.defaultChannels || []);
    // Un type non billetterie ne peut pas être « à places limitées ».
    if (!t.capabilities?.canTicket) setReservationMode('open');
  }

  function toggleChannel(id) {
    setSelectedChannels((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function buildPayload() {
    if (ticketable && reservationMode === 'ticket') {
      const p = tarif === 'paid' ? Number(String(price).replace(',', '.')) || 0 : 0;
      return { reservation: { mode: 'ticket', price: p, currency: 'EUR' } };
    }
    return { reservation: { mode: 'open' } };
  }

  async function handleCreate() {
    if (!type) return toast('Choisissez un type d\u2019initiative.');
    if (!title.trim()) return toast('Donnez un titre à votre initiative.');
    if (ticketable && reservationMode === 'ticket' && tarif === 'paid') {
      const p = Number(String(price).replace(',', '.'));
      if (!Number.isFinite(p) || p <= 0) return toast('Indiquez un prix supérieur à 0 €.');
    }

    const limited = ticketable && reservationMode === 'ticket';
    const capacityValue = limited && String(capacity).trim()
      ? Math.max(1, Math.floor(Number(capacity)))
      : null;

    setLoading(true);
    try {
      const res = await createEvent({
        type,
        title: title.trim(),
        summary: summary.trim() || undefined,
        startsAt: startsAt.trim() || undefined,
        address: address.trim() || undefined,
        channels: selectedChannels,
        capacity: capacityValue,
        payload: buildPayload(),
      });
      const created = res.data.event;
      if (!created?.id) throw new Error('Réponse inattendue du serveur');
      if (publishNow) {
        await publishEvent(created.id);
        toast('Initiative créée et publiée');
      } else {
        toast('Initiative créée (brouillon)');
      }
      navigation.goBack();
    } catch (err) {
      const msg = err.response?.data?.error
        || (err.response?.status === 404 ? 'Service indisponible (serveur à redémarrer ?)' : null)
        || 'Création impossible. Réessayez.';
      toast(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return <ActivityIndicator style={{ flex: 1 }} color={THEME.colors.accent} />;

  if (loadError && types.length === 0) {
    return (
      <View style={styles.errorState}>
        <Ionicons name="cloud-offline-outline" size={44} color={THEME.colors.textMuted} />
        <Text style={styles.errorTitle}>Types indisponibles</Text>
        <Text style={styles.errorText}>Le service des initiatives n'a pas répondu.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadMeta} activeOpacity={0.9}>
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={styles.retryText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Créer une initiative</Text>
      <Text style={styles.intro}>Faites naître un moment de vie locale dans votre quartier.</Text>

      <Text style={styles.label}>Type d'initiative</Text>
      <View style={styles.chipWrap}>
        {types.map((t) => (
          <TouchableOpacity
            key={t.type}
            style={[styles.chip, type === t.type && styles.chipActive]}
            onPress={() => selectType(t)}
          >
            <Text style={[styles.chipText, type === t.type && styles.chipTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Titre</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="ex : Dégustation de fromages fermiers" />

      <Text style={styles.label}>Résumé (optionnel)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={summary}
        onChangeText={setSummary}
        placeholder="Quelques mots qui donnent envie de venir"
        multiline
      />

      <Text style={styles.label}>Date & heure (optionnel)</Text>
      <TextInput style={styles.input} value={startsAt} onChangeText={setStartsAt} placeholder="YYYY-MM-DD HH:MM" />

      <Text style={styles.label}>Lieu (optionnel)</Text>
      <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="ex : 12 place du Marché" />

      {/* ── Participation / réservation (uniquement si le type est billetterie) ── */}
      {ticketable ? (
        <>
          <Text style={styles.label}>Participation</Text>
          <View style={styles.segRow}>
            <Seg
              active={reservationMode === 'open'}
              icon="people-outline"
              title="Ouvert à tous"
              subtitle="Sans réservation"
              onPress={() => setReservationMode('open')}
            />
            <Seg
              active={reservationMode === 'ticket'}
              icon="ticket-outline"
              title="Places limitées"
              subtitle="Réservation requise"
              onPress={() => setReservationMode('ticket')}
            />
          </View>

          {reservationMode === 'ticket' ? (
            <View style={styles.reservationBox}>
              <Text style={styles.subLabel}>Tarif du billet</Text>
              <View style={styles.segRow}>
                <Seg
                  active={tarif === 'free'}
                  icon="gift-outline"
                  title="Gratuit"
                  subtitle="Billet à 0 €"
                  onPress={() => setTarif('free')}
                />
                <Seg
                  active={tarif === 'paid'}
                  icon="card-outline"
                  title="Payant"
                  subtitle="Prix au choix"
                  onPress={() => setTarif('paid')}
                />
              </View>

              {tarif === 'paid' ? (
                <>
                  <Text style={styles.subLabel}>Prix de la place (€)</Text>
                  <TextInput
                    style={styles.input}
                    value={price}
                    onChangeText={setPrice}
                    placeholder="ex : 12"
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.note}>
                    Le règlement en ligne d'un billet payant arrivera avec l'organe Paiement. Le billet est déjà émis dans le Wallet avec son prix.
                  </Text>
                </>
              ) : null}

              <Text style={styles.subLabel}>Nombre de places (optionnel)</Text>
              <TextInput
                style={styles.input}
                value={capacity}
                onChangeText={setCapacity}
                placeholder="ex : 20 (laisser vide = illimité)"
                keyboardType="number-pad"
              />
            </View>
          ) : null}
        </>
      ) : null}

      <Text style={styles.label}>Canaux de diffusion</Text>
      <Text style={styles.hint}>Sur quels canaux du Mode Réception porter votre initiative ?</Text>
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

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, publishNow && styles.toggleBtnActive]}
          onPress={() => setPublishNow(true)}
        >
          <Text style={[styles.toggleText, publishNow && styles.toggleTextActive]}>Publier maintenant</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, !publishNow && styles.toggleBtnActive]}
          onPress={() => setPublishNow(false)}
        >
          <Text style={[styles.toggleText, !publishNow && styles.toggleTextActive]}>Garder en brouillon</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} disabled={loading} activeOpacity={0.9}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Créer l'initiative</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

function Seg({ active, icon, title, subtitle, onPress }) {
  return (
    <TouchableOpacity style={[styles.seg, active && styles.segActive]} onPress={onPress} activeOpacity={0.85}>
      <Ionicons name={icon} size={20} color={active ? THEME.colors.accent : THEME.colors.textSecondary} />
      <Text style={[styles.segTitle, active && styles.segTitleActive]}>{title}</Text>
      <Text style={styles.segSub}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { padding: THEME.spacing.md, paddingBottom: 60 },
  title: { ...THEME.typography.hero, fontSize: 24, color: THEME.colors.text },
  intro: { color: THEME.colors.textSecondary, marginTop: 4, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: THEME.colors.textSecondary, marginTop: 16, marginBottom: 8, textTransform: 'uppercase' },
  subLabel: { fontSize: 12.5, fontWeight: '700', color: THEME.colors.textSecondary, marginTop: 14, marginBottom: 8 },
  hint: { fontSize: 13, color: THEME.colors.textSecondary, marginTop: -4, marginBottom: 8 },
  note: { fontSize: 12, color: THEME.colors.textMuted, marginTop: 8, lineHeight: 17, fontStyle: 'italic' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: THEME.radius.full,
    borderWidth: 1.5, borderColor: THEME.colors.border, backgroundColor: THEME.colors.card,
  },
  chipActive: { borderColor: THEME.colors.primary, backgroundColor: THEME.colors.primary },
  chipText: { fontWeight: '700', color: THEME.colors.text, fontSize: 13 },
  chipTextActive: { color: '#fff' },
  input: {
    backgroundColor: THEME.colors.card, borderRadius: 12, borderWidth: 1,
    borderColor: THEME.colors.border, padding: 14, fontSize: 15, color: THEME.colors.text,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  segRow: { flexDirection: 'row', gap: 10 },
  seg: {
    flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.card, padding: 14, gap: 3,
  },
  segActive: { borderColor: THEME.colors.accent, backgroundColor: THEME.colors.accentSoft },
  segTitle: { fontWeight: '800', fontSize: 14, color: THEME.colors.text, marginTop: 4 },
  segTitleActive: { color: THEME.colors.accent },
  segSub: { fontSize: 12, color: THEME.colors.textMuted },
  reservationBox: {
    marginTop: 12, padding: 14, borderRadius: 14,
    backgroundColor: THEME.colors.card, borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  toggleRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  toggleBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: THEME.colors.border, alignItems: 'center' },
  toggleBtnActive: { borderColor: THEME.colors.accent, backgroundColor: THEME.colors.accentSoft },
  toggleText: { fontWeight: '700', color: THEME.colors.textSecondary, fontSize: 13 },
  toggleTextActive: { color: THEME.colors.accent },
  submitBtn: {
    backgroundColor: THEME.colors.primary, borderRadius: 14, padding: 18,
    alignItems: 'center', marginTop: 24,
  },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10, backgroundColor: THEME.colors.bg },
  errorTitle: { fontSize: 18, fontWeight: '800', color: THEME.colors.text, marginTop: 6 },
  errorText: { fontSize: 14, color: THEME.colors.textSecondary, textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
    backgroundColor: THEME.colors.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12,
  },
  retryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
