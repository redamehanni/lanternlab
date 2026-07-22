import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { THEME } from '../../theme';

/**
 * Bascule d'Âme — mécanisme UNIQUE et SYMÉTRIQUE.
 *
 * Le même composant est monté sur les DEUX faces (Première Âme / Deuxième Âme),
 * à la même position, avec le même geste. L'habitant n'a donc jamais deux façons
 * différentes de faire la même action : où qu'il soit, un bouton flottant
 * toujours visible le fait basculer vers l'autre univers.
 *
 * Il ne connaît aucune règle de navigation : il délègue à `switchSoul`, qui
 * gère le reset vers l'écran frère (FirstSoul / SecondSoul). Le libellé indique
 * la DESTINATION, jamais l'état courant, pour lever toute ambiguïté.
 */
export default function SoulSwitchFab() {
  const { activeSoul, switchSoul } = useApp();
  const insets = useSafeAreaInsets();

  const target = activeSoul === 'second' ? 'first' : 'second';
  const isGoingToMarketplace = target === 'first';

  const label = isGoingToMarketplace ? 'Marketplace' : 'Deuxième Âme';
  const icon = isGoingToMarketplace ? 'storefront' : 'planet';

  // Au-dessus de la barre d'onglets (hauteur 64 + marge de sécurité).
  const bottom = (insets.bottom || 0) + 64 + 14;

  return (
    <TouchableOpacity
      style={[styles.fab, THEME.shadow.lg, { bottom }]}
      onPress={() => switchSoul(target)}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`Basculer vers ${label}`}
    >
      <Ionicons name={icon} size={18} color="#fff" />
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: THEME.radius.full,
  },
  label: { color: '#fff', fontWeight: '800', fontSize: 13.5, letterSpacing: 0.2 },
});
