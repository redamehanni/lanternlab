import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../../context/WalletContext';
import FadeIn from '../../components/ui/FadeIn';
import { THEME } from '../../theme';

export default function WalletScreen({ navigation }) {
  const { families, loading, refresh } = useWallet();

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={THEME.colors.accent} />}
    >
      <FadeIn>
        <Text style={styles.title}>Mon Wallet</Text>
        <Text style={styles.sub}>Vos objets numériques, organisés par famille</Text>
      </FadeIn>

      {loading && families.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={THEME.colors.accent} />
      ) : (
        families.map((family, i) => (
          <FadeIn key={family.id} delay={i * 70}>
            <TouchableOpacity
              style={[styles.card, THEME.shadow.sm]}
              onPress={() => navigation.navigate('WalletFamily', { family })}
              activeOpacity={0.88}
            >
              <View style={[styles.iconWrap, { backgroundColor: family.color + '15' }]}>
                <Ionicons name={family.icon} size={26} color={family.color} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardLabel}>{family.label}</Text>
                <Text style={styles.cardSub}>
                  {family.count === 0
                    ? 'Aucun objet pour le moment'
                    : `${family.count} objet${family.count > 1 ? 's' : ''}` +
                      (family.activeCount > 0 ? ` · ${family.activeCount} actif${family.activeCount > 1 ? 's' : ''}` : '')}
                </Text>
              </View>
              {family.count > 0 && (
                <View style={[styles.countPill, { backgroundColor: family.color }]}>
                  <Text style={styles.countText}>{family.count}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={20} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          </FadeIn>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { padding: THEME.spacing.md, paddingBottom: 100 },
  title: { ...THEME.typography.hero, fontSize: 32, color: THEME.colors.text },
  sub: { ...THEME.typography.body, color: THEME.colors.textSecondary, marginBottom: THEME.spacing.lg },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg, padding: THEME.spacing.md, marginBottom: 12,
    borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  iconWrap: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  cardBody: { flex: 1 },
  cardLabel: { ...THEME.typography.subtitle, color: THEME.colors.text },
  cardSub: { fontSize: 13, color: THEME.colors.textSecondary, marginTop: 4 },
  countPill: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  countText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
