import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AME } from '../../theme';

/**
 * Accès rapide au Mode Réception depuis la boîte aux lettres.
 */
export default function ModeReceptionPopover({
  visible, onClose, active, loading, onToggle, onManage, onOpenMailbox, unread = 0,
}) {
  if (!visible) return null;
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.card, AME.shadow.lg]}>
        <View style={styles.headRow}>
          <MaterialCommunityIcons
            name={active ? 'mailbox-up' : 'mailbox-outline'}
            size={20}
            color={AME.colors.accentDeep}
          />
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
              <ActivityIndicator size="small" color={active ? '#fff' : AME.colors.textMuted} />
            ) : (
              <View style={[styles.knob, active && styles.knobOn]} />
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.mailboxEntry} onPress={onOpenMailbox} activeOpacity={0.85}>
          <View style={styles.mailboxIcon}>
            <Ionicons name="mail-open-outline" size={18} color={AME.colors.accentDeep} />
            {unread > 0 ? (
              <View style={styles.unread}><Text style={styles.unreadText}>{unread > 9 ? '9+' : unread}</Text></View>
            ) : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mailboxTitle}>Voir toutes les opportunités</Text>
            <Text style={styles.mailboxSub}>contenues dans ma boîte aux lettres</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={AME.colors.accent} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.manage} onPress={onManage} activeOpacity={0.8}>
          <Text style={styles.manageText}>Gérer le mode réception</Text>
          <Ionicons name="chevron-forward" size={16} color={AME.colors.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 100, elevation: 100 },
  card: {
    position: 'absolute',
    top: 4,
    right: AME.spacing.md,
    width: 288,
    backgroundColor: AME.colors.card,
    borderRadius: AME.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: AME.colors.borderLight,
    zIndex: 101,
    elevation: 101,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontFamily: AME.fonts.display,
    fontSize: 18,
    color: AME.colors.text,
  },
  desc: {
    fontFamily: AME.fonts.ui,
    fontSize: 13.5,
    color: AME.colors.textSecondary,
    marginTop: 8,
    lineHeight: 19,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  toggleLabel: {
    fontFamily: AME.fonts.uiSemiBold,
    fontSize: 13.5,
    color: AME.colors.text,
  },
  switch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: AME.colors.border,
    padding: 3,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: AME.colors.accent, alignItems: 'flex-end' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  knobOn: {},
  mailboxEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: AME.colors.borderLight,
  },
  mailboxIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: AME.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unread: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: AME.colors.error,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  unreadText: { color: '#fff', fontSize: 9, fontFamily: AME.fonts.uiBold },
  mailboxTitle: {
    fontFamily: AME.fonts.uiSemiBold,
    fontSize: 13.5,
    color: AME.colors.text,
  },
  mailboxSub: {
    fontFamily: AME.fonts.ui,
    fontSize: 12,
    color: AME.colors.textSecondary,
    marginTop: 1,
  },
  manage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: AME.colors.borderLight,
  },
  manageText: {
    fontFamily: AME.fonts.uiSemiBold,
    fontSize: 13.5,
    color: AME.colors.accentDeep,
  },
});
