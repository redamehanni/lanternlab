import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDriverStats } from '../../api';
import { euro } from '../../utils/format';
import { THEME } from '../../theme';
import FadeIn from '../../components/ui/FadeIn';

export default function DriverEarningsScreen() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await getDriverStats();
      setStats(res.data.stats);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <ActivityIndicator style={styles.center} color={THEME.colors.accent} />;

  return (
    <View style={styles.root}>
      <FadeIn>
        <View style={styles.card}>
          <Text style={styles.label}>Revenu du jour</Text>
          <Text style={styles.value}>{euro(stats?.earnings_today)}</Text>
        </View>
      </FadeIn>
      <FadeIn delay={80}>
        <View style={[styles.card, styles.cardAlt]}>
          <Text style={styles.labelAlt}>Revenu de la semaine</Text>
          <Text style={styles.valueAlt}>{euro(stats?.earnings_week)}</Text>
        </View>
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.colors.bg, padding: THEME.spacing.lg, gap: THEME.spacing.md },
  center: { flex: 1 },
  card: {
    backgroundColor: THEME.colors.card, borderRadius: THEME.radius.lg, padding: THEME.spacing.xl,
    borderWidth: 1, borderColor: THEME.colors.borderLight, ...THEME.shadow.md,
  },
  cardAlt: { backgroundColor: THEME.colors.primary },
  labelAlt: { ...THEME.typography.caption, color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  valueAlt: { fontSize: 40, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  label: { ...THEME.typography.caption, color: THEME.colors.textMuted, marginBottom: 8 },
  value: { fontSize: 40, fontWeight: '800', color: THEME.colors.text, letterSpacing: -1 },
});
