import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { getConversations } from '../api';
import Avatar from '../components/Avatar';
import { COLORS } from '../config';

export default function ConversationsScreen({ navigation }) {
  const { socket } = useApp();
  const [convs,   setConvs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getConversations();
      setConvs(res.data.conversations || []);
    } catch {
      setConvs([]);
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!socket) return;
    const reload = () => load();
    socket.on('conversation:updated', reload);
    socket.on('mission:accepted', reload);
    return () => { socket.off('conversation:updated', reload); socket.off('mission:accepted', reload); };
  }, [socket, load]);

  if (loading) return <ActivityIndicator style={styles.center} size="large" color={COLORS.primary} />;

  return (
    <FlatList
      style={styles.bg}
      data={convs}
      keyExtractor={c => c.id}
      contentContainerStyle={{ padding: 12 }}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyText}>Aucune conversation.{'\n'}Elles apparaissent après une commande.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.row}
          onPress={() => navigation.navigate('Chat', { conversationId: item.id, title: item.other?.name })}>
          <Avatar name={item.other?.name} photoUrl={item.other?.photo_url} role={item.other?.role} size={48} />
          <View style={styles.info}>
            <View style={styles.topLine}>
              <Text style={styles.name} numberOfLines={1}>{item.other?.name || 'Utilisateur'}</Text>
              <Text style={styles.kind}>{item.kind_label}</Text>
            </View>
            <Text style={styles.product} numberOfLines={1}>📦 {item.order?.product_name || 'Commande'}</Text>
            <Text style={styles.last} numberOfLines={1}>{item.last_message || 'Démarrer la conversation'}</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, padding: 12, marginBottom: 8 },
  info: { flex: 1, marginLeft: 12 },
  topLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  kind: { fontSize: 10, color: COLORS.secondary, fontWeight: '700', marginLeft: 8 },
  product: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  last: { fontSize: 13, color: COLORS.text, marginTop: 3 },
  arrow: { fontSize: 22, color: COLORS.textLight, marginLeft: 6 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: COLORS.textLight, textAlign: 'center', lineHeight: 24 },
});
