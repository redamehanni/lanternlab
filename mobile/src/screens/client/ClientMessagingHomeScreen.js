import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useCommunication } from '../../context/CommunicationContext';
import UnreadDot from '../../components/ui/UnreadDot';
import FadeIn from '../../components/ui/FadeIn';
import { THEME } from '../../theme';

const SECTIONS = [
  {
    id: 'merchants',
    icon: 'storefront-outline',
    label: 'Messages de mes commerçants',
    sub: 'Conversations durables avec vos boutiques',
    screen: 'MesCommerces',
    color: '#059669',
    unreadKey: 'merchants',
  },
  {
    id: 'support',
    icon: 'headset-outline',
    label: 'Support client',
    sub: 'Assistance Ma Zone (bientôt disponible)',
    screen: 'SupportChat',
    color: '#2563EB',
    unreadKey: 'support',
  },
];

export default function ClientMessagingHomeScreen({ navigation }) {
  const { loadThreads, getTotalUnreadMessagingTab, threads } = useCommunication();

  useFocusEffect(useCallback(() => {
    loadThreads({ kind: 'client_merchant', lifecycle: 'durable' });
  }, [loadThreads]));

  function merchantUnread() {
    return Object.values(threads).reduce((sum, t) => {
      if (t.kind === 'client_merchant' && t.lifecycle === 'durable' && t.status !== 'archived') {
        return sum + (t.unread_count || 0);
      }
      return sum;
    }, 0);
  }

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.content}>
      <FadeIn>
        <Text style={styles.title}>Messagerie</Text>
        <Text style={styles.sub}>Vos échanges avec les commerçants et le support</Text>
      </FadeIn>

      {SECTIONS.map((section, i) => {
        const unread = section.unreadKey === 'merchants' ? merchantUnread() : 0;
        return (
          <FadeIn key={section.id} delay={i * 80}>
            <TouchableOpacity
              style={[styles.card, THEME.shadow.sm]}
              onPress={() => navigation.navigate(section.screen)}
              activeOpacity={0.88}
            >
              <View style={[styles.iconWrap, { backgroundColor: section.color + '15' }]}>
                <Ionicons name={section.icon} size={26} color={section.color} />
                {unread > 0 && <UnreadDot count={unread} style={styles.dot} />}
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardLabel}>{section.label}</Text>
                <Text style={styles.cardSub}>{section.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          </FadeIn>
        );
      })}
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
  dot: { position: 'absolute', top: -2, right: -2 },
  cardBody: { flex: 1 },
  cardLabel: { ...THEME.typography.subtitle, color: THEME.colors.text },
  cardSub: { fontSize: 13, color: THEME.colors.textSecondary, marginTop: 4 },
});
