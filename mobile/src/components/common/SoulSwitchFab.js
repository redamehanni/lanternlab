import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { AME, THEME } from '../../theme';

/**
 * Bascule d'Âme — mécanisme UNIQUE et SYMÉTRIQUE.
 * Costume DA (pilule crème / terracotta) quand on est dans la Deuxième Âme ;
 * costume marketplace discret depuis la Première Âme — même geste, même place.
 */
export default function SoulSwitchFab() {
  const { activeSoul, switchSoul } = useApp();
  const insets = useSafeAreaInsets();

  const target = activeSoul === 'second' ? 'first' : 'second';
  const isGoingToMarketplace = target === 'first';
  const onSecond = activeSoul === 'second';

  const label = isGoingToMarketplace ? 'Marketplace' : 'Deuxième Âme';
  const icon = isGoingToMarketplace ? 'storefront' : 'planet';
  const bottom = (insets.bottom || 0) + 64 + 14;

  return (
    <TouchableOpacity
      style={[
        styles.fab,
        onSecond ? [styles.fabAme, AME.shadow.float] : [styles.fabMarket, THEME.shadow.lg],
        { bottom },
      ]}
      onPress={() => switchSoul(target)}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`Basculer vers ${label}`}
    >
      <Ionicons name={icon} size={18} color={onSecond ? AME.colors.accentDeep : '#fff'} />
      <Text style={[styles.label, onSecond && styles.labelAme]}>{label}</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
  },
  fabAme: {
    backgroundColor: AME.colors.card,
    borderWidth: 1,
    borderColor: AME.colors.border,
  },
  fabMarket: {
    backgroundColor: THEME.colors.primary,
  },
  label: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13.5,
    letterSpacing: 0.2,
  },
  labelAme: {
    color: AME.colors.text,
    fontFamily: AME.fonts.uiSemiBold,
    fontWeight: '600',
  },
});
