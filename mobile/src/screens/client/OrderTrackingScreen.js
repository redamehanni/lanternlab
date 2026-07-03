import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { getOrderById, resolveConversation, cancelOrder } from '../../api';
import { formatMinutes } from '../../utils/format';
import MapView from '../../components/MapView';
import { COLORS, ORDER_STATUS_LABEL, CANCELLABLE_ORDER_STATUSES } from '../../config';

const STEPS = [
  { key: 'placed',          label: 'Commande passée',           icon: '✅' },
  { key: 'pending_driver',  label: 'En attente de livreur',     icon: '⏳' },
  { key: 'driver_assigned', label: 'Livreur assigné',           icon: '🛵' },
  { key: 'picking_up',      label: 'En route vers le commerce', icon: '🏃' },
  { key: 'picked_up',       label: 'Produit récupéré',          icon: '📦' },
  { key: 'delivering',      label: 'En route vers vous',        icon: '🚀' },
  { key: 'delivered',       label: 'Livré !',                   icon: '🎉' },
];

function stepIndexForStatus(status) {
  const map = {
    placed: 0,
    pending_driver: 1,
    pending: 1,
    searching_driver: 1,
    offered: 1,
    driver_assigned: 2,
    accepted: 2,
    accepted_by_driver: 2,
    picking_up: 3,
    picked_up: 4,
    delivering: 5,
    delivered: 6,
    cancelled: -1,
  };
  return map[status] ?? 0;
}

function canCancelOrder(status) {
  return CANCELLABLE_ORDER_STATUSES.includes(status);
}

export default function OrderTrackingScreen({ navigation, route }) {
  const { socket } = useApp();
  const orderId = route.params?.orderId;
  const [order, setOrder] = useState(null);
  const [cancellable, setCancellable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getOrderById(orderId);
      setOrder(res.data.order);
      setCancellable(res.data.cancellable ?? canCancelOrder(res.data.order?.status));
    } catch {
      Alert.alert('Erreur', 'Impossible de charger la commande.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
    if (!socket) return;
    socket.emit('join:order', orderId);

    const onStatus = ({ order: updated }) => {
      setOrder((prev) => ({ ...prev, ...updated }));
      setCancellable(canCancelOrder(updated?.status));
    };
    const onAssigned = ({ mission }) => setOrder((prev) => (prev ? {
      ...prev,
      status: 'driver_assigned',
      driver_name: mission.driver_name,
      driver_phone: mission.driver_phone,
    } : prev));
    const onAccepted = ({ mission }) => onAssigned({ mission });
    const onMissionStatus = ({ status }) => setOrder((prev) => (prev ? { ...prev, status } : prev));
    const onCancelled = ({ order: updated }) => {
      setOrder(updated);
      setCancellable(false);
    };

    socket.on('order:status_updated', onStatus);
    socket.on('mission:assigned', onAssigned);
    socket.on('mission:accepted', onAccepted);
    socket.on('mission:status_updated', onMissionStatus);
    socket.on('order:cancelled', onCancelled);
    return () => {
      socket.off('order:status_updated', onStatus);
      socket.off('mission:assigned', onAssigned);
      socket.off('mission:accepted', onAccepted);
      socket.off('mission:status_updated', onMissionStatus);
      socket.off('order:cancelled', onCancelled);
    };
  }, [socket, orderId, load]);

  async function openChat(targetRole, fallbackTitle) {
    setOpening(true);
    try {
      const res = await resolveConversation(orderId, targetRole);
      const conv = res.data.conversation;
      navigation.navigate('Chat', { conversationId: conv.id, title: conv.other?.name || fallbackTitle });
    } catch (err) {
      Alert.alert('Indisponible', err.response?.data?.error || 'Conversation non disponible.');
    } finally {
      setOpening(false);
    }
  }

  async function handleCancel() {
    Alert.alert(
      'Annuler la commande',
      'Confirmer l\'annulation de cette commande ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await cancelOrder(orderId);
              await load();
              Alert.alert('Commande annulée', 'Votre commande a été annulée.');
            } catch (err) {
              Alert.alert('Erreur', err.response?.data?.error || 'Annulation impossible.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  }

  if (loading) return <ActivityIndicator style={styles.center} size="large" color={COLORS.primary} />;
  if (!order) return <Text style={styles.center}>Commande introuvable.</Text>;

  const currentIdx = stepIndexForStatus(order.status);
  const active = !['delivered', 'cancelled'].includes(order.status);
  const showCancel = active && (cancellable || canCancelOrder(order.status));

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{order.product_name}</Text>
        <Text style={styles.headerSub}>{order.store_name} · {order.total_price?.toFixed(2)} €</Text>
      </View>

      {active && order.estimated_minutes ? (
        <View style={styles.etaBox}>
          <Text style={styles.etaIcon}>⏱️</Text>
          <View>
            <Text style={styles.etaLabel}>Temps estimé de livraison</Text>
            <Text style={styles.etaValue}>{formatMinutes(order.estimated_minutes)}</Text>
          </View>
        </View>
      ) : null}

      <View style={[styles.statusCard, { backgroundColor: order.status === 'delivered' ? '#dcfce7' : order.status === 'cancelled' ? '#fee2e2' : '#eff6ff' }]}>
        <Text style={styles.statusIcon}>{order.status === 'cancelled' ? '❌' : STEPS[Math.max(0, currentIdx)]?.icon}</Text>
        <Text style={styles.statusText}>{ORDER_STATUS_LABEL[order.status] || order.status}</Text>
      </View>

      {order.store_lat != null && (
        <View style={{ marginBottom: 14 }}>
          <MapView lat={order.store_lat} lng={order.store_lng} label={order.store_name} height={150} />
        </View>
      )}

      {order.driver_name && !['pending_driver', 'pending', 'placed', 'searching_driver', 'offered'].includes(order.status) ? (
        <View style={styles.driverCard}>
          <Text style={styles.driverLabel}>Votre livreur</Text>
          <Text style={styles.driverName}>{order.driver_name}</Text>
          {order.driver_phone && <Text style={styles.driverPhone}>{order.driver_phone}</Text>}
        </View>
      ) : null}

      {active && (
        <View style={styles.cancelBox}>
          {showCancel ? (
            <>
              <Text style={styles.cancelHint}>
                Annulation possible jusqu'à la prise en charge du produit par le livreur.
              </Text>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleCancel}
                disabled={cancelling}
              >
                <Text style={styles.cancelBtnText}>
                  {cancelling ? 'Annulation…' : 'Annuler la commande'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.cancelDisabled}>Cette commande ne peut plus être annulée.</Text>
          )}
        </View>
      )}

      {order.status !== 'cancelled' && (
        <>
          <Text style={styles.sectionTitle}>Avancement</Text>
          {STEPS.map((step, idx) => {
            const done = idx <= currentIdx;
            return (
              <View key={step.key} style={styles.stepRow}>
                <View style={[styles.stepCircle, done ? styles.stepCircleDone : styles.stepCirclePending, idx === currentIdx && styles.stepCircleActive]}>
                  <Text style={styles.stepCircleText}>{done ? '✓' : idx + 1}</Text>
                </View>
                {idx < STEPS.length - 1 && <View style={[styles.stepLine, done && idx < currentIdx && styles.stepLineDone]} />}
                <View style={styles.stepLabelBox}>
                  <Text style={styles.stepIcon}>{step.icon}</Text>
                  <Text style={[styles.stepLabel, !done && styles.stepLabelPending]}>{step.label}</Text>
                </View>
              </View>
            );
          })}
        </>
      )}

      {active && (
        <TouchableOpacity style={styles.chatBtn} disabled={opening} onPress={() => openChat('merchant', order.store_name)}>
          <Text style={styles.chatBtnText}>💬 Contacter le commerçant</Text>
        </TouchableOpacity>
      )}
      {active && order.driver_name && (
        <TouchableOpacity style={[styles.chatBtn, { backgroundColor: '#eff6ff' }]} disabled={opening} onPress={() => openChat('driver', order.driver_name)}>
          <Text style={[styles.chatBtnText, { color: '#1d4ed8' }]}>🛵 Contacter le livreur</Text>
        </TouchableOpacity>
      )}

      {order.status === 'delivered' && (
        <TouchableOpacity
          style={styles.newOrderBtn}
          onPress={() => navigation.navigate('HomeTab', {
            screen: 'Home',
            params: { reset: Date.now() },
          })}
        >
          <Text style={styles.newOrderText}>Nouvelle commande</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 16, paddingBottom: 40 },
  header: { backgroundColor: COLORS.primary, borderRadius: 14, padding: 18, marginBottom: 14 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  etaBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfeff', borderRadius: 12, padding: 14, marginBottom: 14, gap: 12 },
  etaIcon: { fontSize: 28 },
  etaLabel: { fontSize: 12, color: '#0891b2', fontWeight: '600' },
  etaValue: { fontSize: 22, fontWeight: '900', color: '#0e7490' },
  statusCard: { borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 14 },
  statusIcon: { fontSize: 36, marginBottom: 6 },
  statusText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  driverCard: { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  driverLabel: { fontSize: 11, color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 1 },
  driverName: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 4 },
  driverPhone: { fontSize: 14, color: COLORS.secondary, marginTop: 2 },
  cancelBox: { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  cancelHint: { fontSize: 13, color: COLORS.textLight, marginBottom: 10, lineHeight: 18 },
  cancelDisabled: { fontSize: 13, color: COLORS.textLight, fontStyle: 'italic' },
  cancelBtn: { backgroundColor: '#fee2e2', borderRadius: 10, padding: 14, alignItems: 'center' },
  cancelBtnText: { color: COLORS.error, fontWeight: '700' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4, position: 'relative' },
  stepCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  stepCircleDone: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  stepCirclePending: { backgroundColor: COLORS.card, borderColor: COLORS.border },
  stepCircleActive: { borderColor: COLORS.primary },
  stepCircleText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  stepLine: { position: 'absolute', left: 13, top: 30, width: 2, height: 30, backgroundColor: COLORS.border },
  stepLineDone: { backgroundColor: COLORS.success },
  stepLabelBox: { flexDirection: 'row', alignItems: 'center', marginLeft: 12, paddingBottom: 20 },
  stepIcon: { fontSize: 16, marginRight: 6 },
  stepLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  stepLabelPending: { color: COLORS.textLight, fontWeight: '400' },
  chatBtn: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  chatBtnText: { color: COLORS.success, fontWeight: '700', fontSize: 14 },
  newOrderBtn: { backgroundColor: COLORS.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 16 },
  newOrderText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
