import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getEventChannels, getModeReception, setModeReception } from '../../api';
import { useToast } from '../../components/ui/Toast';
import { AME } from '../../theme';

/**
 * Mode Réception — l'habitant construit ses canaux d'écoute. La surface lit les
 * canaux déclarés par l'organe (registre) et enregistre les abonnements choisis.
 * Aucune règle métier : l'organe valide les canaux et cible les diffusions.
 */
export default function ModeReceptionScreen({ navigation }) {
  const toast = useToast();
  const [channels, setChannels] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [chRes, recRes] = await Promise.all([getEventChannels(), getModeReception()]);
      setChannels(chRes.data.channels || []);
      setSelected(new Set((recRes.data.subscriptions || []).map((s) => s.channel)));
    } catch {
      setChannels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const subs = [...selected].map((channel) => ({ channel }));
      await setModeReception(subs);
      toast('Mode Réception enregistré');
      navigation.goBack();
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error;
      if (status === 401) toast('Session expirée — reconnectez-vous');
      else toast(msg || 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ActivityIndicator style={styles.center} color={AME.colors.accent} />;

  return (
    <View style={styles.bg}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Choisissez ce que vous souhaitez recevoir. Ma Zone vous portera les opportunités volantes correspondant à vos canaux, autour de vous.
        </Text>

        {channels.map((c) => {
          const on = selected.has(c.id);
          return (
            <TouchableOpacity key={c.id} style={[styles.row, on && styles.rowOn]} onPress={() => toggle(c.id)} activeOpacity={0.85}>
              <Text style={[styles.rowLabel, on && styles.rowLabelOn]}>{c.label}</Text>
              <View style={[styles.check, on && styles.checkOn]}>
                {on ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving} activeOpacity={0.9}>
          {saving ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.saveText}>{selected.size ? `Enregistrer (${selected.size})` : 'Ne rien recevoir'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: AME.colors.bg },
  center: { flex: 1 },
  content: { padding: AME.spacing.md, paddingBottom: 20 },
  intro: { color: AME.colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 18 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: AME.colors.card, borderRadius: AME.radius.md, padding: 16, marginBottom: 10,
    borderWidth: 1.5, borderColor: AME.colors.borderLight,
  },
  rowOn: { borderColor: AME.colors.accent, backgroundColor: AME.colors.accentSoft },
  rowLabel: { fontSize: 15, fontWeight: '600', color: AME.colors.text },
  rowLabelOn: { color: AME.colors.accent, fontWeight: '800' },
  check: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: AME.colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: AME.colors.accent, borderColor: AME.colors.accent },
  footer: { padding: AME.spacing.md, borderTopWidth: 1, borderTopColor: AME.colors.borderLight, backgroundColor: AME.colors.card },
  saveBtn: { backgroundColor: AME.colors.primary, borderRadius: AME.radius.md, padding: 16, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
