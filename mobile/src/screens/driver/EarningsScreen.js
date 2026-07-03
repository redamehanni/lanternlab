import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDriverStats } from '../../api';
import { euro } from '../../utils/format';
import { COLORS } from '../../config';

export default function EarningsScreen() {
  const [stats,   setStats]   = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await getDriverStats();
      setStats(res.data.stats);
      setHistory(res.data.history || []);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <ActivityIndicator style={styles.center} size="large" color={COLORS.primary} />;

  return (
    <FlatList
      style={styles.bg}
      data={history}
      keyExtractor={h => h.id}
      contentContainerStyle={{ padding: 16 }}
      ListHeaderComponent={
        <>
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>Revenus aujourd'hui</Text>
            <Text style={styles.heroValue}>{euro(stats?.earnings_today)}</Text>
          </View>
          <View style={styles.grid}>
            <Box label="Cette semaine" value={euro(stats?.earnings_week)} />
            <Box label="Total" value={euro(stats?.earnings_total)} />
            <Box label="Livraisons" value={String(stats?.deliveries_total ?? 0)} />
            <Box label="Note moyenne" value={stats?.rating ? `⭐ ${String(stats.rating).replace('.', ',')}` : '—'} />
          </View>
          <Text style={styles.sectionTitle}>Historique des courses</Text>
        </>
      }
      ListEmptyComponent={<Text style={styles.empty}>Aucune course terminée pour le moment.</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.product} numberOfLines={1}>{item.product_name}</Text>
            <Text style={styles.store}>{item.store_name}</Text>
            <Text style={styles.date}>{item.date ? new Date(item.date + 'Z').toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</Text>
          </View>
          <Text style={styles.gain}>+{euro(item.gain)}</Text>
        </View>
      )}
    />
  );
}

function Box({ label, value }) {
  return (
    <View style={styles.box}>
      <Text style={styles.boxValue}>{value}</Text>
      <Text style={styles.boxLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1 },
  hero: { backgroundColor: COLORS.success, borderRadius: 16, padding: 22, alignItems: 'center', marginBottom: 12 },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  heroValue: { fontSize: 36, fontWeight: '900', color: '#fff', marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  box: { width: '47.5%', backgroundColor: COLORS.card, borderRadius: 12, padding: 16, alignItems: 'center' },
  boxValue: { fontSize: 20, fontWeight: '900', color: COLORS.primary },
  boxLabel: { fontSize: 12, color: COLORS.textLight, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 16, marginBottom: 10 },
  empty: { textAlign: 'center', color: COLORS.textLight, padding: 30 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 8 },
  product: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  store: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  date: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  gain: { fontSize: 17, fontWeight: '900', color: COLORS.success },
});
