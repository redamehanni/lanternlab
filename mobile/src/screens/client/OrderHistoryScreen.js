import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getMyOrders, createOrder, cancelOrder } from '../../api';
import ComingSoonButton from '../../components/ui/ComingSoonButton';
import FadeIn from '../../components/ui/FadeIn';
import { euro } from '../../utils/format';
import { ORDER_STATUS_LABEL, CANCELLABLE_ORDER_STATUSES } from '../../config';
import { THEME } from '../../theme';

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR')} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

function canCancel(status) {
  return CANCELLABLE_ORDER_STATUSES.includes(status);
}

export default function OrderHistoryScreen({ navigation }) {
  const { socket } = useApp();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await getMyOrders();
      setOrders(res.data.orders || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!socket) return;
    const reload = () => load();
    socket.on('order:status_updated', reload);
    socket.on('mission:accepted', reload);
    socket.on('order:cancelled', reload);
    return () => {
      socket.off('order:status_updated', reload);
      socket.off('mission:accepted', reload);
      socket.off('order:cancelled', reload);
    };
  }, [socket, load]);

  async function handleReorder(order) {
    try {
      await createOrder({
        product_id: order.product_id,
        quantity: order.quantity,
        delivery_address: order.delivery_address,
      });
      Alert.alert('Commande passée', 'Votre commande a été recréée.');
      load();
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.error || 'Impossible de repasser la commande.');
    }
  }

  async function handleCancel(order) {
    Alert.alert(
      'Annuler la commande',
      'Confirmer l\'annulation ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(order.id);
            try {
              await cancelOrder(order.id);
              load();
            } catch (err) {
              Alert.alert('Erreur', err.response?.data?.error || 'Annulation impossible.');
            } finally {
              setCancellingId(null);
            }
          },
        },
      ],
    );
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={THEME.colors.accent} />;

  return (
    <View style={styles.bg}>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <FadeIn>
            <Text style={styles.header}>Vos commandes</Text>
            <Text style={styles.headerSub}>Historique complet</Text>
          </FadeIn>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 48 }}>📦</Text>
            <Text style={styles.emptyText}>Aucune commande pour le moment</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const isActive = !['delivered', 'cancelled'].includes(item.status);
          const showCancel = isActive && canCancel(item.status);
          return (
            <FadeIn delay={index * 40}>
              <View style={[styles.card, THEME.shadow.md]}>
                <View style={styles.cardTop}>
                  <Text style={styles.date}>{formatDateTime(item.created_at)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: THEME.colors.accentSoft }]}>
                    <Text style={styles.statusText}>{ORDER_STATUS_LABEL[item.status] || item.status}</Text>
                  </View>
                </View>
                <Text style={styles.store}>{item.store_name}</Text>
                <Text style={styles.product}>{item.product_name} × {item.quantity}</Text>
                {item.driver_name ? (
                  <Text style={styles.driver}>Livreur : {item.driver_name}</Text>
                ) : (
                  <Text style={styles.driverMuted}>Livreur : en attente</Text>
                )}
                <Text style={styles.amount}>{euro(item.total_price)}</Text>

                {isActive && (
                  <Text style={styles.cancelNote}>
                    {showCancel
                      ? 'Annulation possible jusqu\'à la prise en charge du produit par le livreur.'
                      : 'Cette commande ne peut plus être annulée.'}
                  </Text>
                )}

                <View style={styles.actions}>
                  {showCancel && (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => handleCancel(item)}
                      disabled={cancellingId === item.id}
                    >
                      <Ionicons name="close-circle-outline" size={16} color={THEME.colors.error} />
                      <Text style={styles.cancelBtnText}>
                        {cancellingId === item.id ? 'Annulation…' : 'Annuler la commande'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.reorderBtn} onPress={() => handleReorder(item)}>
                    <Ionicons name="refresh" size={16} color="#fff" />
                    <Text style={styles.reorderText}>Repasser la commande</Text>
                  </TouchableOpacity>
                  <ComingSoonButton
                    label="Service client"
                    icon="💬"
                    onPress={() => navigation.navigate('SupportChat', { orderId: item.id })}
                  />
                </View>

                <TouchableOpacity onPress={() => navigation.navigate('OrderTracking', { orderId: item.id })}>
                  <Text style={styles.trackLink}>Voir le suivi ›</Text>
                </TouchableOpacity>
              </View>
            </FadeIn>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  list: { padding: THEME.spacing.md, paddingBottom: 100 },
  header: { ...THEME.typography.hero, fontSize: 28, color: THEME.colors.text },
  headerSub: { color: THEME.colors.textSecondary, marginBottom: THEME.spacing.md },
  card: {
    backgroundColor: THEME.colors.card, borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md, marginBottom: 14, borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 12, color: THEME.colors.textSecondary, fontWeight: '600' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700', color: THEME.colors.accent },
  store: { fontSize: 17, fontWeight: '800', color: THEME.colors.text, marginTop: 10 },
  product: { fontSize: 14, color: THEME.colors.textSecondary, marginTop: 4 },
  driver: { fontSize: 13, color: THEME.colors.text, marginTop: 6 },
  driverMuted: { fontSize: 13, color: THEME.colors.textMuted, marginTop: 6 },
  amount: { fontSize: 20, fontWeight: '900', color: THEME.colors.text, marginTop: 8 },
  cancelNote: { fontSize: 12, color: THEME.colors.textMuted, marginTop: 10, lineHeight: 17 },
  actions: { marginTop: 14, gap: 8 },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fee2e2', borderRadius: THEME.radius.md, padding: 14,
  },
  cancelBtnText: { color: THEME.colors.error, fontWeight: '700', fontSize: 15 },
  reorderBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: THEME.colors.primary, borderRadius: THEME.radius.md, padding: 14,
  },
  reorderText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  trackLink: { color: THEME.colors.accent, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  empty: { alignItems: 'center', padding: 48 },
  emptyText: { color: THEME.colors.textSecondary, marginTop: 12, fontSize: 16 },
});
