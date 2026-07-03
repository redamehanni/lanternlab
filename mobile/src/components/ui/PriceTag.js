import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { euro } from '../../utils/format';
import { THEME } from '../../theme';

export default function PriceTag({ price, promoPrice, size = 'md' }) {
  const hasPromo = promoPrice != null && promoPrice < price;
  const saved = hasPromo ? Math.round((1 - promoPrice / price) * 100) : 0;

  if (!hasPromo) {
    return <Text style={[styles.price, size === 'lg' && styles.priceLg]}>{euro(price)}</Text>;
  }

  return (
    <View style={styles.row}>
      <Text style={[styles.old, size === 'lg' && styles.oldLg]}>{euro(price)}</Text>
      <Text style={[styles.promo, size === 'lg' && styles.promoLg]}>{euro(promoPrice)}</Text>
      {saved > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>-{saved}%</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  price: { fontSize: 16, fontWeight: '800', color: THEME.colors.text },
  priceLg: { fontSize: 26 },
  old: {
    fontSize: 14,
    color: THEME.colors.textMuted,
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  oldLg: { fontSize: 18 },
  promo: { fontSize: 18, fontWeight: '900', color: THEME.colors.text },
  promoLg: { fontSize: 28 },
  badge: {
    backgroundColor: THEME.colors.promoSoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 12, fontWeight: '800', color: THEME.colors.promo },
});
