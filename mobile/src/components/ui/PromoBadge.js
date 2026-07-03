import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../../theme';

export default function PromoBadge({ discountPercent, label, style, small }) {
  const text = label || (discountPercent ? `-${Math.round(discountPercent)}%` : 'PROMO');
  return (
    <View style={[styles.badge, small && styles.badgeSm, style]}>
      <Text style={[styles.text, small && styles.textSm]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: THEME.colors.promo,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeSm: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  text: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },
  textSm: { fontSize: 9 },
});
