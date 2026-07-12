import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { useCommunication } from '../../context/CommunicationContext';
import { getMerchantOrders } from '../../api';
import { openCommunication } from '../../communication/openCommunication';
import UnreadDot from '../../components/ui/UnreadDot';
import { THEME } from '../../theme';
import { ORDER_STATUS_LABEL } from '../../config';

function driverAssignedToOrder(status) {
  return !['placed', 'pending_driver', 'pending', 'searching_driver', 'offered'].includes(status);
}

export default function MerchantOrdersScreen({ navigation }) {
  const { socket } = useApp();
  const { getUnreadForStore, getUnreadForOrder, getUnreadForClientOnStore, loadThreads, registerThread } = useCommunication();
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  async function openChat(order, targetRole, fallbackTitle) {
    await openCommunication(navigation, {
      orderId: order.id,
      targetRole,
      title: fallbackTitle,
      contextOrderId: order.id,
    }, { registerThread });
  }

  const load = useCallback(async () => {
    try {
      const res = await getMerchantOrders();
      setOrders(res.data.orders || []);
      loadThreads({ kind: 'client_merchant', lifecycle: 'durable' });
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les commandes.');
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, [loadThreads]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!socket) return;
    socket.on('order:new', ({ order }) => {
      setOrders(prev => [order, ...prev.filter(o => o.id !== order.id)]);
    });
    socket.on('order:status_updated', ({ order }) => {
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...order } : o));
    });
    socket.on('mission:accepted', ({ mission }) => {
      setOrders(prev => prev.map(o => o.id === mission.order_id
        ? {
          ...o,
          status: 'driver_assigned',
          mission_status: mission.status,
          driver_name: mission.driver_name,
        } : o
      ));
    });
    socket.on('mission:assigned', ({ mission }) => {
      setOrders(prev => prev.map(o => o.id === mission.order_id
        ? {
          ...o,
          status: 'driver_assigned',
          mission_status: mission.status,
          driver_name: mission.driver_name,
        } : o
      ));
    });
    socket.on('mission:status_updated', ({ mission }) => {
      setOrders(prev => prev.map(o => o.id === mission.order_id
        ? { ...o, mission_status: mission.status, status: mission.order_status || o.status } : o
      ));
    });
    socket.on('order:cancelled', ({ order }) => {
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...order } : o));
    });
    return () => {
      socket.off('order:new');
      socket.off('order:status_updated');
      socket.off('mission:accepted');
      socket.off('mission:assigned');
      socket.off('mission:status_updated');
      socket.off('order:cancelled');
    };
  }, [socket]);

  const statusColor = {
    placed: '#94a3b8', searching_driver: '#f59e0b', pending_driver: '#f59e0b',
    offered: '#f97316', accepted_by_driver: '#059669', driver_assigned: '#059669',
    picking_up: '#3b82f6', picked_up: '#8b5cf6', delivering: '#f97316',
    delivered: '#10b981', cancelled: '#ef4444',
    pending: '#f59e0b', accepted: '#059669',
  };

  if (loading) return <ActivityIndicator style={styles.center} size="large" color={THEME.colors.accent} />;

  return (
    <FlatList
      style={styles.bg}
      data={orders}
      keyExtractor={o => o.id}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} />}
      ListEmptyComponent={<Text style={styles.empty}>Aucune commande reçue.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.product}>{item.product_name}</Text>
            <View style={[styles.badge, { backgroundColor: (statusColor[item.status] || '#6b7280') + '22' }]}>
              <Text style={[styles.badgeText, { color: statusColor[item.status] || '#6b7280' }]}>
                {ORDER_STATUS_LABEL[item.status] || item.status}
              </Text>
            </View>
          </View>

          <Text style={styles.meta}>Client : {item.client_name} — {item.client_phone}</Text>
          <Text style={styles.meta}>Montant : {item.total_price?.toFixed(2)} € · Qté : {item.quantity}</Text>

          {item.mission_status && (
            <Text style={styles.driver}>
              {driverAssignedToOrder(item.status)
                ? `Livreur : ${item.driver_name || '—'}`
                : ORDER_STATUS_LABEL[item.status] || 'Recherche d\'un livreur'}
            </Text>
          )}

          {item.status !== 'delivered' && (
            <View style={styles.chatRow}>
              <TouchableOpacity style={[styles.chatBtn, styles.chatBtnPos]} onPress={() => openChat(item, 'client', item.client_name)}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={THEME.colors.accent} />
                <Text style={styles.chatBtnText}>Messagerie client</Text>
                <UnreadDot count={getUnreadForClientOnStore(item.store_id, item.client_id)} />
              </TouchableOpacity>
              {item.driver_name && driverAssignedToOrder(item.status) ? (
                <TouchableOpacity style={[styles.chatBtn, styles.chatBtnDriver, styles.chatBtnPos]} onPress={() => openChat(item, 'driver', item.driver_name)}>
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color="#1d4ed8" />
                  <Text style={[styles.chatBtnText, styles.chatBtnTextDriver]}>Chat livreur</Text>
                  <UnreadDot count={getUnreadForOrder(item.id, 'merchant_driver')} />
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  center: { flex: 1 },
  empty: { textAlign: 'center', color: THEME.colors.textMuted, padding: 40 },
  card: {
    backgroundColor: THEME.colors.card, borderRadius: THEME.radius.lg, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: THEME.colors.borderLight, ...THEME.shadow.sm,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  product: { fontSize: 16, fontWeight: '700', color: THEME.colors.text, flex: 1 },
  meta: { fontSize: 13, color: THEME.colors.textSecondary, marginTop: 2 },
  driver: { fontSize: 13, color: THEME.colors.accent, marginTop: 4, fontWeight: '600' },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  chatRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  chatBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.accentSoft, borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  chatBtnDriver: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  chatBtnText: { color: THEME.colors.accent, fontWeight: '700', fontSize: 14 },
  chatBtnTextDriver: { color: '#1d4ed8' },
  chatBtnPos: { position: 'relative' },
});
