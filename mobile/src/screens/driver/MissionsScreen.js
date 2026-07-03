import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Modal, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { getAvailableMissions, acceptMission, refuseMission } from '../../api';
import { COLORS } from '../../config';

const COUNTDOWN_SECONDS = 20;

export default function MissionsScreen({ navigation }) {
  const { user, socket, logoutUser } = useApp();

  const [missions,      setMissions]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refresh,       setRefresh]       = useState(false);
  const [incomingMission, setIncomingMission] = useState(null);
  const [countdown,     setCountdown]     = useState(COUNTDOWN_SECONDS);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await getAvailableMissions();
      setMissions(res.data.missions || []);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les missions.');
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Socket : rejoindre la room des livreurs disponibles + écouter les nouvelles missions
  useEffect(() => {
    if (!socket) return;

    socket.emit('driver:online');

    socket.on('mission:new', (data) => {
      setMissions(prev => {
        if (prev.find(m => m.id === data.mission.id)) return prev;
        return [data.mission, ...prev];
      });
      // Popup avec countdown
      setIncomingMission(data);
      startCountdown(data.mission.id);
    });

    socket.on('mission:taken', ({ missionId }) => {
      setMissions(prev => prev.filter(m => m.id !== missionId));
      if (incomingMission?.mission?.id === missionId) {
        dismissPopup();
      }
    });

    return () => {
      socket.off('mission:new');
      socket.off('mission:taken');
    };
  }, [socket]);

  function startCountdown(missionId) {
    clearInterval(timerRef.current);
    setCountdown(COUNTDOWN_SECONDS);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleRefuse(missionId, true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function dismissPopup() {
    clearInterval(timerRef.current);
    setIncomingMission(null);
    setCountdown(COUNTDOWN_SECONDS);
  }

  async function handleAccept(mission) {
    dismissPopup();
    try {
      const res = await acceptMission(mission.id);
      setMissions(prev => prev.filter(m => m.id !== mission.id));
      navigation.navigate('ActiveMission', { mission: res.data.mission });
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.error || 'Acceptation impossible.');
    }
  }

  async function handleRefuse(missionId, silent = false) {
    dismissPopup();
    setMissions(prev => prev.filter(m => m.id !== missionId));
    if (!silent) {
      try { await refuseMission(missionId); } catch {}
    }
  }

  if (loading) return <ActivityIndicator style={styles.center} size="large" color={COLORS.primary} />;

  return (
    <View style={styles.bg}>
      {/* En-tête */}
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>Bonjour, {user.name}</Text>
          <Text style={styles.sub}>{user.transport || 'Livreur'}</Text>
        </View>
        <TouchableOpacity onPress={logoutUser}>
          <Text style={styles.logout}>Déco.</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={missions}
        keyExtractor={m => m.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🟢</Text>
            <Text style={styles.emptyText}>En attente de missions…{'\n'}Le backend vous notifiera en temps réel.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.missionCard}>
            <Text style={styles.missionProduct}>{item.product_name}</Text>
            <Text style={styles.missionRow}>📍 Commerce : {item.store_name}</Text>
            <Text style={styles.missionAddr}>{item.store_address}</Text>
            <Text style={styles.missionRow}>👤 Client : {item.client_name}</Text>
            <Text style={styles.missionAddr}>{item.delivery_address || '—'}</Text>
            <Text style={styles.missionPrice}>Montant : {item.total_price?.toFixed(2)} €</Text>

            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={async () => {
                try {
                  const res = await acceptMission(item.id);
                  setMissions(prev => prev.filter(m => m.id !== item.id));
                  navigation.navigate('ActiveMission', { mission: res.data.mission });
                } catch (err) {
                  Alert.alert('Erreur', err.response?.data?.error || 'Acceptation impossible.');
                }
              }}
            >
              <Text style={styles.acceptBtnText}>Accepter la mission</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Popup mission entrante */}
      <Modal visible={!!incomingMission} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.popup}>
            {/* Countdown */}
            <View style={[styles.countdownCircle, countdown <= 5 && { borderColor: '#ef4444' }]}>
              <Text style={[styles.countdownNum, countdown <= 5 && { color: '#ef4444' }]}>{countdown}</Text>
              <Text style={styles.countdownSec}>sec</Text>
            </View>

            <Text style={styles.popupTitle}>Nouvelle mission !</Text>
            {incomingMission && (
              <>
                <Text style={styles.popupProduct}>{incomingMission.order?.product_name}</Text>

                <View style={styles.popupSection}>
                  <Text style={styles.popupLabel}>Commerce</Text>
                  <Text style={styles.popupValue}>{incomingMission.order?.store_name}</Text>
                  <Text style={styles.popupAddr}>{incomingMission.order?.store_address}</Text>
                </View>
                <View style={styles.popupSection}>
                  <Text style={styles.popupLabel}>Client</Text>
                  <Text style={styles.popupValue}>{incomingMission.order?.client_name}</Text>
                  <Text style={styles.popupAddr}>{incomingMission.order?.delivery_address}</Text>
                </View>
                <Text style={styles.popupPrice}>{incomingMission.order?.total_price?.toFixed(2)} €</Text>
              </>
            )}

            <View style={styles.popupButtons}>
              <TouchableOpacity
                style={styles.refuseBtn}
                onPress={() => handleRefuse(incomingMission.mission.id)}
              >
                <Text style={styles.refuseBtnText}>Refuser</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptBtnLarge}
                onPress={() => handleAccept(incomingMission.mission)}
              >
                <Text style={styles.acceptBtnLargeText}>Accepter ✓</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.primary, padding: 20,
  },
  hello: { fontSize: 18, fontWeight: '700', color: '#fff' },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  logout: { color: 'rgba(255,255,255,0.65)', fontSize: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textLight, textAlign: 'center', lineHeight: 24 },
  missionCard: {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 12,
  },
  missionProduct: { fontSize: 16, fontWeight: '800', color: COLORS.primary, marginBottom: 10 },
  missionRow: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  missionAddr: { fontSize: 13, color: COLORS.textLight, marginBottom: 8, paddingLeft: 4 },
  missionPrice: { fontSize: 14, fontWeight: '700', color: COLORS.success, marginBottom: 12 },
  acceptBtn: {
    backgroundColor: COLORS.success, borderRadius: 10, padding: 12, alignItems: 'center',
  },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Popup
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  popup: {
    backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36, alignItems: 'center',
  },
  countdownCircle: {
    width: 80, height: 80, borderRadius: 40, borderWidth: 4,
    borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  countdownNum: { fontSize: 30, fontWeight: '900', color: COLORS.primary },
  countdownSec: { fontSize: 11, color: COLORS.textLight, marginTop: -4 },
  popupTitle: { fontSize: 22, fontWeight: '900', color: COLORS.primary, marginBottom: 4 },
  popupProduct: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 14 },
  popupSection: { width: '100%', backgroundColor: COLORS.bg, borderRadius: 10, padding: 12, marginBottom: 8 },
  popupLabel: { fontSize: 11, color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 1 },
  popupValue: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  popupAddr: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  popupPrice: { fontSize: 18, fontWeight: '700', color: COLORS.success, marginTop: 8, marginBottom: 20 },
  popupButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  refuseBtn: {
    flex: 1, borderRadius: 12, borderWidth: 2, borderColor: '#ef4444',
    padding: 14, alignItems: 'center',
  },
  refuseBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
  acceptBtnLarge: {
    flex: 2, backgroundColor: COLORS.success, borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  acceptBtnLargeText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
