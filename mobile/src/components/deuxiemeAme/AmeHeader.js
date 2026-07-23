import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Avatar from '../Avatar';
import { THEME } from '../../theme';

/**
 * En-tête de la Deuxième Âme.
 *
 * Deux accès seulement, sans ambiguïté :
 *  - le Mode Réception, matérialisé par une BOÎTE AUX LETTRES À FANION —
 *    métaphore explicite des Opportunités Volantes : fanion LEVÉ = j'accepte de
 *    recevoir (activé), fanion BAISSÉ = je ne reçois pas (désactivé) ;
 *  - le profil (avatar).
 *
 * La messagerie n'est PLUS ici (elle vit dans la barre d'onglets) et le
 * changement d'Âme se fait via le bouton flottant partagé (SoulSwitchFab), pour
 * un mécanisme unique et symétrique sur les deux faces.
 */
export default function AmeHeader({ user, onReception, onProfile, receptionActive, unread = 0 }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.brandRow}>
        <View style={styles.logo}>
          <Ionicons name="planet-outline" size={20} color={THEME.colors.accent} />
        </View>
        <View>
          <Text style={styles.brand}>Ma Zone</Text>
          <Text style={styles.brandSub}>DEUXIÈME ÂME</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.iconBtn, receptionActive && styles.iconBtnActive]}
          onPress={onReception}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityState={{ selected: !!receptionActive }}
          accessibilityLabel={receptionActive ? 'Mode Réception activé' : 'Mode Réception désactivé'}
        >
          <MaterialCommunityIcons
            name={receptionActive ? 'mailbox-up' : 'mailbox-outline'}
            size={22}
            color={receptionActive ? THEME.colors.accent : THEME.colors.textSecondary}
          />
          {receptionActive && unread <= 0 ? <View style={styles.flag} /> : null}
          {unread > 0 ? (
            <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View>
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity onPress={onProfile} activeOpacity={0.85} accessibilityLabel="Mon profil">
          <Avatar name={user?.name} photoUrl={user?.photo_url} role={user?.role} size={38} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: THEME.spacing.md, paddingVertical: 10 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  brand: { fontSize: 17, fontWeight: '900', color: THEME.colors.text, letterSpacing: -0.3 },
  brandSub: { fontSize: 9.5, fontWeight: '800', color: THEME.colors.textMuted, letterSpacing: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.colors.card,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  iconBtnActive: { borderColor: THEME.colors.accent, backgroundColor: THEME.colors.accentSoft },
  // Petit fanion rouge levé, renforce la lisibilité de l'état « activé ».
  flag: { position: 'absolute', top: 7, right: 8, width: 6, height: 6, borderRadius: 2, backgroundColor: THEME.colors.error },
  badge: {
    position: 'absolute', top: 2, right: 2, backgroundColor: THEME.colors.error, borderRadius: 9,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
