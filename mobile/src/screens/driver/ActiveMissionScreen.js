import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { updateMissionStatus, resolveConversation } from '../../api';
import { euro, commissionFor } from '../../utils/format';
import MapView from '../../components/MapView';
import { COLORS, MISSION_STATUS_LABEL } from '../../config';

const STEPS = [
  { from: 'accepted',   to: 'picking_up',  label: 'Partir vers le commerce',  icon: '🏃', nextLabel: 'Je suis en route !' },
  { from: 'picking_up', to: 'picked_up',   label: 'Confirmer récupération',   icon: '📦', nextLabel: 'Produit récupéré !' },
  { from: 'picked_up',  to: 'delivering',  label: 'Partir vers le client',    icon: '🚀', nextLabel: 'En route vers le client !' },
  { from: 'delivering', to: 'delivered',   label: 'Confirmer la livraison',   icon: '✅', nextLabel: 'Mission accomplie !' },
];

export default function ActiveMissionScreen({ navigation, route }) {
  const { socket } = useApp();
  const [mission,  setMission]  = useState(route.params.mission);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!socket) return;
    socket.emit('join:order', mission.order_id);
    return () => {};
  }, [socket, mission.order_id]);

  const currentStep = STEPS.find(s => s.from === mission.status);
  const isDone = mission.status === 'delivered';

  async function openChat(targetRole, fallbackTitle) {
    try {
      const res = await resolveConversation(mission.order_id, targetRole);
      const conv = res.data.conversation;
      navigation.navigate('Chat', { conversationId: conv.id, title: conv.other?.name || fallbackTitle });
    } catch (err) {
      Alert.alert('Indisponible', err.response?.data?.error || 'Conversation non disponible.');
    }
  }

  async function handleNextStep() {
    if (!currentStep || updating) return;
    setUpdating(true);
    try {
      const res = await updateMissionStatus(mission.id, currentStep.to);
      setMission(res.data.mission);
      Alert.alert('Statut mis à jour', currentStep.nextLabel);
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.error || 'Mise à jour impossible.');
    } finally {
      setUpdating(false);
    }
  }

  const allStatuses = ['accepted', 'picking_up', 'picked_up', 'delivering', 'delivered'];
  const currentIdx = allStatuses.indexOf(mission.status);

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.container}>
      {/* Titre mission */}
      <View style={styles.header}>
        <Text style={styles.product}>{mission.product_name}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{MISSION_STATUS_LABEL[mission.status]}</Text>
        </View>
      </View>

      {/* Commerce */}
      <View style={styles.infoCard}>
        <Text style={styles.infoIcon}>🏪</Text>
        <View style={styles.infoBody}>
          <Text style={styles.infoLabel}>Commerce</Text>
          <Text style={styles.infoValue}>{mission.store_name}</Text>
          <Text style={styles.infoAddr}>{mission.store_address}</Text>
        </View>
      </View>

      {/* Client */}
      <View style={styles.infoCard}>
        <Text style={styles.infoIcon}>👤</Text>
        <View style={styles.infoBody}>
          <Text style={styles.infoLabel}>Client</Text>
          <Text style={styles.infoValue}>{mission.client_name}</Text>
          <Text style={styles.infoAddr}>{mission.delivery_address}</Text>
          {mission.client_phone && <Text style={styles.infoPhone}>{mission.client_phone}</Text>}
        </View>
      </View>

      {/* Montant + gain estimé */}
      <View style={styles.priceBox}>
        <View>
          <Text style={styles.priceLabel}>Commande</Text>
          <Text style={styles.price}>{euro(mission.total_price)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.priceLabel}>Votre gain</Text>
          <Text style={styles.gain}>+{euro(commissionFor(mission.total_price))}</Text>
        </View>
      </View>

      {/* Carte (issue #15) */}
      {mission.store_lat != null && (
        <View style={{ marginBottom: 16 }}>
          <MapView lat={mission.store_lat} lng={mission.store_lng} label={mission.store_name} height={160} />
        </View>
      )}

      {/* Progression */}
      <Text style={styles.sectionTitle}>Progression</Text>
      <View style={styles.progressRow}>
        {allStatuses.map((s, i) => (
          <View key={s} style={styles.progressStep}>
            <View style={[styles.progressDot, i <= currentIdx && styles.progressDotDone]} />
            {i < allStatuses.length - 1 && (
              <View style={[styles.progressLine, i < currentIdx && styles.progressLineDone]} />
            )}
          </View>
        ))}
      </View>

      {/* Bouton d'action */}
      {!isDone ? (
        <TouchableOpacity
          style={[styles.actionBtn, updating && styles.actionBtnDisabled]}
          onPress={handleNextStep}
          disabled={updating}
        >
          {updating
            ? <ActivityIndicator color="#fff" />
            : <>
                <Text style={styles.actionIcon}>{currentStep?.icon}</Text>
                <Text style={styles.actionText}>{currentStep?.label}</Text>
              </>
          }
        </TouchableOpacity>
      ) : (
        <View style={styles.doneCard}>
          <Text style={styles.doneIcon}>🎉</Text>
          <Text style={styles.doneText}>Mission accomplie !</Text>
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.newBtnText}>Voir les missions disponibles</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Chats séparés (issue #8) */}
      <TouchableOpacity style={styles.chatBtn} onPress={() => openChat('client', mission.client_name)}>
        <Text style={styles.chatBtnText}>💬 Contacter le client</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.chatBtn, { backgroundColor: '#f0fdf4', marginTop: 8 }]} onPress={() => openChat('merchant', mission.store_name)}>
        <Text style={[styles.chatBtnText, { color: COLORS.success }]}>🏪 Contacter le commerçant</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 16, paddingBottom: 40 },
  header: {
    backgroundColor: COLORS.primary, borderRadius: 14, padding: 18, marginBottom: 12,
  },
  product: { fontSize: 20, fontWeight: '800', color: '#fff' },
  statusBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginTop: 8,
  },
  statusText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  infoCard: {
    flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 12,
    padding: 14, marginBottom: 10, alignItems: 'flex-start',
  },
  infoIcon: { fontSize: 28, marginRight: 12, marginTop: 2 },
  infoBody: { flex: 1 },
  infoLabel: { fontSize: 11, color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 1 },
  infoValue: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  infoAddr: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  infoPhone: { fontSize: 14, color: COLORS.secondary, marginTop: 4, fontWeight: '600' },
  priceBox: {
    backgroundColor: '#dcfce7', borderRadius: 12, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  priceLabel: { fontSize: 13, color: COLORS.success, fontWeight: '600' },
  price: { fontSize: 22, fontWeight: '900', color: COLORS.success },
  gain: { fontSize: 22, fontWeight: '900', color: '#15803d' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  progressStep: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  progressDot: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.border, borderWidth: 2, borderColor: COLORS.border,
  },
  progressDotDone: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  progressLine: { flex: 1, height: 3, backgroundColor: COLORS.border, marginHorizontal: 2 },
  progressLineDone: { backgroundColor: COLORS.success },
  actionBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14, padding: 18,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12,
  },
  actionBtnDisabled: { opacity: 0.6 },
  actionIcon: { fontSize: 22 },
  actionText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  doneCard: { backgroundColor: '#dcfce7', borderRadius: 14, padding: 24, alignItems: 'center', marginBottom: 12 },
  doneIcon: { fontSize: 48, marginBottom: 8 },
  doneText: { fontSize: 20, fontWeight: '800', color: COLORS.success },
  newBtn: {
    backgroundColor: COLORS.success, borderRadius: 10, padding: 14,
    marginTop: 14, paddingHorizontal: 24,
  },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  chatBtn: {
    backgroundColor: '#eff6ff', borderRadius: 12, padding: 14, alignItems: 'center',
  },
  chatBtnText: { color: '#1d4ed8', fontWeight: '700', fontSize: 14 },
});
