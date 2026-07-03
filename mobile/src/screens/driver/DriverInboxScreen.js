import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getDriverNotifications, resolveDriverSupport } from '../../api';
import { THEME } from '../../theme';

export default function DriverInboxScreen() {
  const navigation = useNavigation();
  const [tab, setTab] = useState('notifications');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await getDriverNotifications();
      setNotifications(res.data.notifications || []);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function openSupport() {
    try {
      const res = await resolveDriverSupport();
      navigation.navigate('DriverSupportChat', {
        threadId: res.data.thread.id,
      });
    } catch { /* ignore */ }
  }

  const supportItems = notifications.filter((n) => n.type === 'support');
  const systemItems = notifications.filter((n) => n.type !== 'support');

  return (
    <View style={styles.root}>
      <Text style={styles.pageTitle}>Boîte de réception</Text>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'notifications' && styles.tabActive]}
          onPress={() => setTab('notifications')}
        >
          <Ionicons name="notifications-outline" size={18} color={tab === 'notifications' ? THEME.colors.accent : THEME.colors.textMuted} />
          <Text style={[styles.tabText, tab === 'notifications' && styles.tabTextActive]}>NOTIFICATIONS</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'assistance' && styles.tabActive]}
          onPress={() => setTab('assistance')}
        >
          <Ionicons name="headset-outline" size={18} color={tab === 'assistance' ? THEME.colors.accent : THEME.colors.textMuted} />
          <Text style={[styles.tabText, tab === 'assistance' && styles.tabTextActive]}>ASSISTANCE</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.center} color={THEME.colors.accent} />
      ) : tab === 'notifications' ? (
        <View style={styles.folder}>
          <FlatList
            data={systemItems}
            keyExtractor={(i) => i.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.empty}>Aucune notification pour le moment.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.notifCard}>
                <Text style={styles.notifTitle}>{item.title}</Text>
                <Text style={styles.notifBody}>{item.body}</Text>
                <Text style={styles.notifDate}>
                  {item.created_at ? new Date(item.created_at + 'Z').toLocaleString('fr-FR') : ''}
                </Text>
              </View>
            )}
          />
        </View>
      ) : (
        <View style={styles.folder}>
          <TouchableOpacity style={styles.supportCard} onPress={openSupport}>
            <View style={styles.supportIcon}>
              <Ionicons name="chatbubbles" size={24} color={THEME.colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.supportTitle}>Assistance Ma Zone</Text>
              <Text style={styles.supportSub}>Discutez avec notre équipe support</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={THEME.colors.textMuted} />
          </TouchableOpacity>
          {supportItems.map((item) => (
            <View key={item.id} style={styles.notifCard}>
              <Text style={styles.notifTitle}>{item.title}</Text>
              <Text style={styles.notifBody}>{item.body}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.colors.bg },
  pageTitle: { ...THEME.typography.title, padding: THEME.spacing.lg, paddingBottom: 8, color: THEME.colors.text },
  tabs: { flexDirection: 'row', marginHorizontal: THEME.spacing.lg, gap: 10, marginBottom: THEME.spacing.md },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: THEME.radius.md, backgroundColor: THEME.colors.card,
    borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  tabActive: { borderColor: THEME.colors.accent, backgroundColor: THEME.colors.accentSoft },
  tabText: { fontSize: 11, fontWeight: '700', color: THEME.colors.textMuted, letterSpacing: 0.3 },
  tabTextActive: { color: THEME.colors.accent },
  folder: { flex: 1, marginHorizontal: THEME.spacing.lg, backgroundColor: THEME.colors.card, borderRadius: THEME.radius.lg, ...THEME.shadow.sm, overflow: 'hidden' },
  list: { padding: THEME.spacing.md },
  center: { marginTop: 40 },
  empty: { textAlign: 'center', color: THEME.colors.textMuted, padding: 32 },
  notifCard: {
    padding: THEME.spacing.md, borderBottomWidth: 1, borderBottomColor: THEME.colors.borderLight,
  },
  notifTitle: { fontWeight: '700', color: THEME.colors.text, marginBottom: 4 },
  notifBody: { color: THEME.colors.textSecondary, lineHeight: 20 },
  notifDate: { fontSize: 11, color: THEME.colors.textMuted, marginTop: 8 },
  supportCard: {
    flexDirection: 'row', alignItems: 'center', padding: THEME.spacing.lg, gap: 14,
    borderBottomWidth: 1, borderBottomColor: THEME.colors.borderLight,
  },
  supportIcon: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: THEME.colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  supportTitle: { fontWeight: '700', color: THEME.colors.text },
  supportSub: { fontSize: 13, color: THEME.colors.textMuted, marginTop: 2 },
});
