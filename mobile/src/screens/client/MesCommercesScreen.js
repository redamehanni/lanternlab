import React, { useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useCommunication } from '../../context/CommunicationContext';
import { openCommunication } from '../../communication/openCommunication';
import UnreadDot from '../../components/ui/UnreadDot';
import { THEME } from '../../theme';

export default function MesCommercesScreen({ navigation }) {
  const { threads, loadThreads, registerThread } = useCommunication();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const list = Object.values(threads).filter(
    (t) => t.kind === 'client_merchant' && t.lifecycle === 'durable' && t.status !== 'archived'
  );

  const fetch = useCallback(async () => {
    await loadThreads({ kind: 'client_merchant', lifecycle: 'durable' });
    setLoading(false);
    setRefreshing(false);
  }, [loadThreads]);

  useFocusEffect(useCallback(() => { fetch(); }, [fetch]));

  if (loading) {
    return <ActivityIndicator style={styles.center} size="large" color={THEME.colors.accent} />;
  }

  return (
    <FlatList
      style={styles.bg}
      data={list}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 12, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🏪</Text>
          <Text style={styles.emptyText}>
            Vos commerces de proximité apparaîtront ici après votre première commande.
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const storeName = item.party?.store?.name || item.displayName || 'Commerce';
        return (
          <TouchableOpacity
            style={styles.row}
            onPress={() => openCommunication(navigation, {
              storeId: item.store_id,
              targetRole: 'merchant',
              title: storeName,
            }, { registerThread })}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{storeName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>{storeName}</Text>
              <Text style={styles.last} numberOfLines={1}>{item.last_message || 'Démarrer la conversation'}</Text>
            </View>
            <View style={styles.right}>
              <UnreadDot count={item.unread_count} style={styles.dot} />
              <Text style={styles.arrow}>›</Text>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  center: { flex: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.colors.card,
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: THEME.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, fontWeight: '700', color: THEME.colors.text },
  last: { fontSize: 13, color: THEME.colors.textMuted, marginTop: 4 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { position: 'relative', top: 0, right: 0 },
  arrow: { fontSize: 22, color: THEME.colors.textMuted },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: THEME.colors.textMuted, textAlign: 'center', lineHeight: 24 },
});
