import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { getMyOrders } from '../../api';
import { imageUrl, euro, formatMinutes } from '../../utils/format';
import { COLORS, ORDER_STATUS_LABEL } from '../../config';

const statusColor = {
  placed: '#94a3b8', searching_driver: '#f59e0b', pending_driver: '#f59e0b',
  offered: '#f97316', accepted_by_driver: '#059669', driver_assigned: '#059669',
  picking_up: '#3b82f6', picked_up: '#8b5cf6', delivering: '#f97316',
  delivered: '#10b981', cancelled: '#ef4444',
  pending: '#f59e0b', accepted: '#059669',
};

export default function ClientOrdersScreen({ navigation }) {
  const { socket } = useApp();
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getMyOrders();
      setOrders(res.data.orders || []);
    } catch { setOrders([]); }
    finally { setLoading(false); setRefresh(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!socket) return;
    const reload = () => load();
    socket.on('order:status_updated', reload);
    socket.on('mission:accepted', reload);
    socket.on('mission:assigned', reload);
    socket.on('order:cancelled', reload);
    return () => {
      socket.off('order:status_updated', reload);
      socket.off('mission:accepted', reload);
      socket.off('mission:assigned', reload);
      socket.off('order:cancelled', reload);
    };
  }, [socket, load]);

  if (loading) return <ActivityIndicator style={styles.center} size="large" color={COLORS.primary} />;

  return (
    <FlatList
      style={styles.bg}
      data={orders}
      keyExtractor={o => o.id}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} />}
      ListEmptyComponent={<Text style={styles.empty}>Aucune commande pour le moment.</Text>}
      renderItem={({ item }) => {
        const active = !['delivered', 'cancelled'].includes(item.status);
        return (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('OrderTracking', { orderId: item.id })}>
            {item.product_image ? (
              <Image source={{ uri: imageUrl(item.product_image) }} style={styles.img} />
            ) : (
              <View style={[styles.img, styles.noImg]}><Text style={{ fontSize: 26 }}>📦</Text></View>
            )}
            <View style={styles.info}>
              <Text style={styles.product} numberOfLines={1}>{item.product_name}</Text>
              <Text style={styles.store}>{item.store_name}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.price}>{euro(item.total_price)}</Text>
                {active && item.estimated_minutes ? <Text style={styles.eta}>· ⏱️ {formatMinutes(item.estimated_minutes)}</Text> : null}
              </View>
            </View>
            <View style={[styles.badge, { backgroundColor: (statusColor[item.status] || '#6b7280') + '22' }]}>
              <Text style={[styles.badgeText, { color: statusColor[item.status] || '#6b7280' }]}>{ORDER_STATUS_LABEL[item.status]}</Text>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1 },
  empty: { textAlign: 'center', color: COLORS.textLight, padding: 48, fontSize: 15 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, padding: 12, marginBottom: 10 },
  img: { width: 60, height: 60, borderRadius: 8, resizeMode: 'cover' },
  noImg: { backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, marginLeft: 12 },
  product: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  store: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 4 },
  price: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  eta: { fontSize: 12, color: COLORS.secondary },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
