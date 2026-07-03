import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getMyStore, getMerchantOrders } from '../../api';
import { imageUrl } from '../../utils/format';
import MapView from '../../components/MapView';
import { COLORS, ORDER_STATUS_LABEL } from '../../config';

function driverAssignedToOrder(status) {
  return !['placed', 'pending_driver', 'pending', 'searching_driver', 'offered'].includes(status);
}

export default function DashboardScreen({ navigation }) {
  const { user, socket, logoutUser } = useApp();
  const [store,    setStore]    = useState(null);
  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [refresh,  setRefresh]  = useState(false);

  const load = useCallback(async () => {
    try {
      const [storeRes, ordersRes] = await Promise.all([getMyStore(), getMerchantOrders()]);
      setStore(storeRes.data.store);
      setOrders(ordersRes.data.orders || []);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de charger le tableau de bord.');
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      setOrders(prev => [data.order, ...prev.filter(o => o.id !== data.order.id)]);
    };
    socket.on('order:new', handler);
    socket.on('order:status_updated', handler);
    socket.on('mission:accepted', ({ mission }) => {
      setOrders(prev => prev.map(o => o.id === mission.order_id
        ? { ...o, mission_status: mission.status, driver_name: mission.driver_name } : o
      ));
    });
    return () => {
      socket.off('order:new', handler);
      socket.off('order:status_updated', handler);
      socket.off('mission:accepted');
    };
  }, [socket]);

  if (loading) return <ActivityIndicator style={styles.center} size="large" color={COLORS.primary} />;

  const pendingOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));

  return (
    <ScrollView
      style={styles.bg}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>Bonjour, {user.name}</Text>
          <Text style={styles.welcomeSub}>{store ? store.name : 'Aucune boutique'}</Text>
        </View>
        <TouchableOpacity onPress={logoutUser} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Déco.</Text>
        </TouchableOpacity>
      </View>

      {/* Pas de boutique */}
      {!store ? (
        <View style={styles.noStore}>
          <Text style={styles.noStoreText}>Vous n'avez pas encore de boutique.</Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => navigation.navigate('CreateStore')}
          >
            <Text style={styles.btnText}>Créer ma boutique</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Actions rapides */}
          <Text style={styles.sectionTitle}>Actions rapides</Text>
          <View style={styles.actions}>
            <ActionBtn label="+ Produit"  color={COLORS.success}  onPress={() => navigation.navigate('AddProduct')} />
            <ActionBtn label="Stocks"     color={COLORS.warning}  onPress={() => navigation.navigate('ManageStock')} />
            <ActionBtn label="Commandes"  color={COLORS.primary}  onPress={() => navigation.navigate('MerchantOrders')} />
          </View>
          <View style={styles.actions}>
            <ActionBtn label="🏷️ Promotions" color="#7C3AED" onPress={() => navigation.navigate('ManagePromotions')} />
          </View>

          {/* Infos boutique */}
          <View style={styles.storeCard}>
            <View style={styles.storeHead}>
              {store.photo_url ? (
                <Image source={{ uri: imageUrl(store.photo_url) }} style={styles.storePhoto} />
              ) : (
                <View style={[styles.storePhoto, styles.storePhotoPh]}><Text style={{ fontSize: 26 }}>🏪</Text></View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.storeCardTitle}>{store.name}</Text>
                {store.category ? <Text style={styles.storeCat}>{store.category}</Text> : null}
                <Text style={styles.storeCardSub}>{store.address}</Text>
              </View>
            </View>
            {store.description ? <Text style={styles.storeCardDesc}>{store.description}</Text> : null}

            {/* Localisation (issue #15) */}
            <View style={{ marginTop: 12 }}>
              <MapView lat={store.lat} lng={store.lng} label={store.name} height={150} />
            </View>

            <TouchableOpacity style={styles.editStoreBtn} onPress={() => navigation.navigate('CreateStore', { store })}>
              <Text style={styles.editStoreText}>✏️ Modifier ma boutique</Text>
            </TouchableOpacity>
          </View>

          {/* Commandes en cours */}
          <Text style={styles.sectionTitle}>En cours ({pendingOrders.length})</Text>
          {pendingOrders.length === 0 ? (
            <Text style={styles.empty}>Aucune commande en cours.</Text>
          ) : (
            pendingOrders.map(order => (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                onPress={() => navigation.navigate('MerchantOrders')}
              >
                <View style={styles.orderRow}>
                  <Text style={styles.orderProduct}>{order.product_name}</Text>
                  <StatusBadge status={order.status} />
                </View>
                <Text style={styles.orderMeta}>Client : {order.client_name} · {order.total_price.toFixed(2)} €</Text>
                {order.mission_status && (
                  <Text style={styles.orderDriver}>
                    {driverAssignedToOrder(order.status)
                      ? `Livreur : ${order.driver_name || '—'}`
                      : ORDER_STATUS_LABEL[order.status] || 'Recherche d\'un livreur'}
                  </Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

function ActionBtn({ label, color, onPress }) {
  return (
    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: color }]} onPress={onPress}>
      <Text style={styles.actionBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatusBadge({ status }) {
  const colors = {
    pending: '#f59e0b', accepted: '#059669',
    picking_up: '#3b82f6', picked_up: '#8b5cf6',
    delivering: '#f97316', delivered: '#10b981',
    cancelled: '#ef4444',
  };
  return (
    <View style={[styles.badge, { backgroundColor: (colors[status] || '#6b7280') + '22' }]}>
      <Text style={[styles.badgeText, { color: colors[status] || '#6b7280' }]}>
        {ORDER_STATUS_LABEL[status] || status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.primary, padding: 20, paddingTop: 16,
  },
  welcome: { fontSize: 18, fontWeight: '700', color: '#fff' },
  welcomeSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  logoutBtn: { padding: 8 },
  logoutText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, margin: 16, marginBottom: 8 },
  actions: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 4 },
  actionBtn: { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  storeCard: { backgroundColor: COLORS.card, margin: 16, marginTop: 8, borderRadius: 12, padding: 16 },
  storeHead: { flexDirection: 'row', alignItems: 'center' },
  storePhoto: { width: 60, height: 60, borderRadius: 10, resizeMode: 'cover' },
  storePhotoPh: { backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  storeCardTitle: { fontSize: 17, fontWeight: '700', color: COLORS.primary },
  storeCat: { fontSize: 12, color: COLORS.secondary, fontWeight: '600', marginTop: 1 },
  storeCardSub: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  storeCardDesc: { fontSize: 13, color: COLORS.text, marginTop: 10 },
  editStoreBtn: { marginTop: 12, backgroundColor: COLORS.primary + '15', borderRadius: 8, padding: 10, alignItems: 'center' },
  editStoreText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  orderCard: {
    backgroundColor: COLORS.card, marginHorizontal: 16, marginBottom: 10,
    borderRadius: 12, padding: 14,
  },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderProduct: { fontSize: 15, fontWeight: '600', color: COLORS.text, flex: 1 },
  orderMeta: { fontSize: 13, color: COLORS.textLight, marginTop: 4 },
  orderDriver: { fontSize: 13, color: COLORS.secondary, marginTop: 2 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  empty: { color: COLORS.textLight, textAlign: 'center', padding: 24 },
  noStore: { padding: 40, alignItems: 'center' },
  noStoreText: { fontSize: 16, color: COLORS.textLight, textAlign: 'center', marginBottom: 20 },
  btn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
