import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getWalletObjects } from '../../api';
import FadeIn from '../../components/ui/FadeIn';
import { THEME } from '../../theme';
import { STATUS_META } from './walletStatus';

export default function WalletFamilyScreen({ route, navigation }) {
  const { family } = route.params;
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await getWalletObjects({ family: family.id });
      setObjects(res.data.objects || []);
    } catch {
      setObjects([]);
    } finally {
      setLoading(false);
    }
  }, [family.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={THEME.colors.accent} />
      </View>
    );
  }

  if (objects.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name={family.icon} size={48} color={THEME.colors.textMuted} />
        <Text style={styles.emptyText}>Aucun objet dans « {family.label} »</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.bg}
      contentContainerStyle={styles.content}
      data={objects}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => {
        const meta = STATUS_META[item.status] || STATUS_META.active;
        return (
          <FadeIn delay={index * 60}>
            <TouchableOpacity
              style={[styles.card, THEME.shadow.sm]}
              onPress={() => navigation.navigate('WalletObjectDetail', { objectId: item.id, title: item.label })}
              activeOpacity={0.88}
            >
              <View style={[styles.iconWrap, { backgroundColor: family.color + '15' }]}>
                <Ionicons name={item.isMemory ? 'sparkles-outline' : family.icon} size={24} color={family.color} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardLabel}>{item.label}</Text>
                <View style={styles.metaRow}>
                  <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
                  <Text style={styles.statusText}>{item.isMemory ? 'Souvenir' : meta.label}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          </FadeIn>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { padding: THEME.spacing.md, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.colors.bg, padding: THEME.spacing.xl },
  emptyText: { ...THEME.typography.body, color: THEME.colors.textSecondary, marginTop: 12, textAlign: 'center' },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg, padding: THEME.spacing.md, marginBottom: 12,
    borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  cardBody: { flex: 1 },
  cardLabel: { ...THEME.typography.subtitle, color: THEME.colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 13, color: THEME.colors.textSecondary },
});
