import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Avatar from '../Avatar';
import SoftIcon from '../ui/SoftIcon';
import { AME } from '../../theme';

/**
 * En-tête de la Deuxième Âme.
 *
 * Deux accès seulement, sans ambiguïté :
 *  - le Mode Réception, matérialisé par une BOÎTE AUX LETTRES À FANION ;
 *  - le profil (avatar).
 *
 * La messagerie vit dans la barre d'onglets ; le changement d'Âme via SoulSwitchFab.
 */
export default function AmeHeader({ user, onReception, onProfile, receptionActive, unread = 0 }) {
  const firstName = (user?.name || '').trim().split(/\s+/)[0] || 'toi';

  return (
    <View style={styles.wrap}>
      <View style={styles.brandCol}>
        <View style={styles.brandRow}>
          <SoftIcon name="planet" size={18} wellSize={40} color={AME.colors.accentDeep} wellColor={AME.colors.accentSoft} />
          <View>
            <Text style={styles.brand}>Ma Zone</Text>
            <Text style={styles.brandSub}>DEUXIÈME ÂME</Text>
          </View>
        </View>
        <Text style={styles.greeting}>Bonjour {firstName}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.iconBtn, receptionActive && styles.iconBtnActive]}
          onPress={onReception}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityState={{ selected: !!receptionActive }}
          accessibilityLabel={receptionActive ? 'Mode Réception activé' : 'Mode Réception désactivé'}
        >
          <MaterialCommunityIcons
            name={receptionActive ? 'mailbox-up' : 'mailbox-outline'}
            size={22}
            color={receptionActive ? AME.colors.accentDeep : AME.colors.textSecondary}
          />
          {receptionActive && unread <= 0 ? <View style={styles.flag} /> : null}
          {unread > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity onPress={onProfile} activeOpacity={0.85} accessibilityLabel="Mon profil">
          <View style={styles.avatarRing}>
            <Avatar name={user?.name} photoUrl={user?.photo_url} role={user?.role} size={40} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: AME.spacing.md,
    paddingTop: 8,
    paddingBottom: 6,
  },
  brandCol: { flex: 1, paddingRight: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: {
    fontFamily: AME.fonts.display,
    fontSize: 22,
    color: AME.colors.text,
    letterSpacing: -0.3,
  },
  brandSub: {
    fontFamily: AME.fonts.uiSemiBold,
    fontSize: 9.5,
    color: AME.colors.textMuted,
    letterSpacing: 2.2,
    marginTop: 1,
  },
  greeting: {
    fontFamily: AME.fonts.displayRegular,
    fontSize: 17,
    color: AME.colors.textSecondary,
    marginTop: 10,
    marginLeft: 2,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 2 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: AME.radius.md,
    backgroundColor: AME.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AME.colors.borderLight,
  },
  iconBtnActive: {
    borderColor: AME.colors.accent,
    backgroundColor: AME.colors.accentSoft,
  },
  flag: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 6,
    height: 6,
    borderRadius: 2,
    backgroundColor: AME.colors.error,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: AME.colors.error,
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: AME.fonts.uiBold,
  },
  avatarRing: {
    borderRadius: 22,
    borderWidth: 2,
    borderColor: AME.colors.borderLight,
    padding: 1,
  },
});
