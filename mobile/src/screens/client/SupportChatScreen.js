import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../theme';

export default function SupportChatScreen({ route }) {
  return (
    <View style={styles.bg}>
      <View style={[styles.card, THEME.shadow.lg]}>
        <Ionicons name="chatbubbles-outline" size={56} color={THEME.colors.textMuted} />
        <Text style={styles.title}>Service client</Text>
        <Text style={styles.sub}>
          Le chat support sera bientôt disponible.
          {route.params?.orderId ? `\nCommande : ${route.params.orderId.slice(0, 8)}…` : ''}
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Bientôt disponible</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg, justifyContent: 'center', padding: THEME.spacing.lg },
  card: {
    backgroundColor: THEME.colors.card, borderRadius: THEME.radius.xl,
    padding: THEME.spacing.xxl, alignItems: 'center',
    borderWidth: 1.5, borderColor: THEME.colors.error + '44',
  },
  title: { ...THEME.typography.title, color: THEME.colors.text, marginTop: 16 },
  sub: { color: THEME.colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  badge: {
    marginTop: 20, backgroundColor: THEME.colors.errorSoft, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 6,
  },
  badgeText: { color: THEME.colors.error, fontWeight: '800', fontSize: 12, textTransform: 'uppercase' },
});
