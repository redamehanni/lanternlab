import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getMerchantOrders } from '../../api';
import { THEME } from '../../theme';

/**
 * Statistiques — surface Piloter. Lecture seule : agrège l'organe Orders pour
 * un aperçu synthétique. Les indicateurs riches viendront quand un organe
 * Analytics existera ; cette surface se contentera alors de l'orchestrer.
 */
const TERMINAL = ['delivered', 'cancelled'];

export default function MerchantStatsScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getMerchantOrders();
      setOrders(res.data.orders || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return <ActivityIndicator style={styles.center} size="large" color={THEME.colors.accent} />;
  }

  const delivered = orders.filter((o) => o.status === 'delivered');
  const pending = orders.filter((o) => !TERMINAL.includes(o.status));
  const revenue = delivered.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
  const clients = new Set(orders.map((o) => o.client_id || o.client_name).filter(Boolean)).size;

  const cards = [
    { icon: 'receipt-outline', label: 'Commandes reçues', value: String(orders.length), tone: THEME.colors.accent },
    { icon: 'time-outline', label: 'En cours', value: String(pending.length), tone: THEME.colors.warning },
    { icon: 'checkmark-done-outline', label: 'Livrées', value: String(delivered.length), tone: THEME.colors.success },
    { icon: 'cash-outline', label: 'Chiffre livré', value: `${revenue.toFixed(2)} €`, tone: THEME.colors.primary },
    { icon: 'people-outline', label: 'Clients servis', value: String(clients), tone: THEME.colors.accent },
  ];

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} />}
    >
      <Text style={styles.intro}>Un aperçu de votre activité. Des indicateurs plus fins arriveront.</Text>
      <View style={styles.grid}>
        {cards.map((c) => (
          <View key={c.label} style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: c.tone + '18' }]}>
              <Ionicons name={c.icon} size={22} color={c.tone} />
            </View>
            <Text style={styles.statValue}>{c.value}</Text>
            <Text style={styles.statLabel}>{c.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: THEME.colors.bg },
  content: { padding: THEME.spacing.md },
  intro: { color: THEME.colors.textSecondary, fontSize: 14, marginBottom: THEME.spacing.md, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: THEME.spacing.sm },
  statCard: {
    width: '48%',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1, borderColor: THEME.colors.borderLight,
    ...THEME.shadow.sm,
  },
  statIcon: {
    width: 44, height: 44, borderRadius: THEME.radius.md,
    alignItems: 'center', justifyContent: 'center', marginBottom: THEME.spacing.sm,
  },
  statValue: { ...THEME.typography.hero, fontSize: 24, color: THEME.colors.text },
  statLabel: { color: THEME.colors.textSecondary, fontSize: 13, marginTop: 2 },
});
