import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../../theme';

/**
 * Accès rapide au Mode Réception depuis la cloche. Présentationnel : l'état et
 * les écritures (get/setModeReception) sont pilotés par l'écran hôte. Le toggle
 * rapide (ré)active une écoute par défaut ; « Gérer » ouvre le réglage fin.
 */
export default function ModeReceptionPopover({ visible, onClose, active, loading, onToggle, onManage }) {
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.card, THEME.shadow.lg]}>
        <View style={styles.headRow}>
          <MaterialCommunityIcons name={active ? 'mailbox-up' : 'mailbox-outline'} size={20} color={THEME.colors.accent} />
          <Text style={styles.title}>Mode Réception</Text>
        </View>
        <Text style={styles.desc}>
          Fanion levé, vous recevez les opportunités volantes autour de vous. Baissé, votre boîte reste fermée.
        </Text>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{active ? 'Activé' : 'Désactivé'}</Text>
          <TouchableOpacity
            style={[styles.switch, active && styles.switchOn]}
            onPress={onToggle}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color={active ? '#fff' : THEME.colors.textMuted} />
            ) : (
              <View style={[styles.knob, active && styles.knobOn]} />
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.manage} onPress={onManage} activeOpacity={0.8}>
          <Text style={styles.manageText}>Gérer le mode réception</Text>
          <Ionicons name="chevron-forward" size={16} color={THEME.colors.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute', top: 4, right: THEME.spacing.md, width: 260,
    backgroundColor: THEME.colors.card, borderRadius: THEME.radius.lg, padding: 16,
    borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '800', color: THEME.colors.text },
  desc: { fontSize: 13, color: THEME.colors.textSecondary, marginTop: 6, lineHeight: 18 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  toggleLabel: { fontSize: 13, fontWeight: '700', color: THEME.colors.text },
  switch: {
    width: 48, height: 28, borderRadius: 14, backgroundColor: THEME.colors.border,
    padding: 3, justifyContent: 'center',
  },
  switchOn: { backgroundColor: THEME.colors.accent, alignItems: 'flex-end' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  knobOn: {},
  manage: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: THEME.colors.borderLight,
  },
  manageText: { fontSize: 13.5, fontWeight: '700', color: THEME.colors.accent },
});
