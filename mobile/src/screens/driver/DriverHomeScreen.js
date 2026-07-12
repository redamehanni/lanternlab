import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  SafeAreaView, StatusBar, Platform, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { useDriver } from '../../context/DriverContext';
import { useCommunication } from '../../context/CommunicationContext';
import { openCommunication } from '../../communication/openCommunication';
import DriverMap from '../../components/driver/DriverMap';
import MissionDrawer from '../../components/driver/MissionDrawer';
import NewCourseOfferModal from '../../components/driver/NewCourseOfferModal';
import { acceptMission, refuseMission } from '../../api';
import { THEME } from '../../theme';

const OFFER_SECONDS = 20;

const SCREEN_H = Dimensions.get('window').height;
const MAP_HEIGHT = Math.round(SCREEN_H * 0.5);

const TAB_BAR_STYLE = {
  height: 64,
  paddingBottom: 10,
  paddingTop: 8,
  backgroundColor: THEME.colors.card,
  borderTopColor: THEME.colors.borderLight,
  borderTopWidth: 1,
  ...THEME.shadow.md,
};

export default function DriverHomeScreen() {
  const navigation = useNavigation();
  const { user } = useApp();
  const {
    online, setOnline, broadcast, activeMission, setActiveMission,
    ready, onMissionAssigned, pendingOffer, clearPendingOffer,
  } = useDriver();
  const { getUnreadForOrder, loadThreads, registerThread } = useCommunication();

  const [fullscreen, setFullscreen] = useState(false);
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const [offerLoading, setOfferLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(OFFER_SECONDS);
  const offerTimerRef = useRef(null);

  const lat = user.lat ?? activeMission?.store_lat ?? 48.8566;
  const lng = user.lng ?? activeMission?.store_lng ?? 2.3522;

  const startActiveMission = useCallback((mission) => {
    if (!mission) return;
    setActiveMission(mission);
    setFullscreen(true);
    setDrawerExpanded(true);
  }, [setActiveMission]);

  useEffect(() => {
    onMissionAssigned(startActiveMission);
    return () => onMissionAssigned(null);
  }, [onMissionAssigned, startActiveMission]);

  useEffect(() => {
    if (activeMission) {
      setFullscreen(true);
      setDrawerExpanded(true);
    }
  }, [activeMission?.id]);

  useFocusEffect(useCallback(() => {
    navigation.getParent()?.setOptions({
      tabBarStyle: fullscreen ? { display: 'none' } : TAB_BAR_STYLE,
    });
    return () => navigation.getParent()?.setOptions({ tabBarStyle: TAB_BAR_STYLE });
  }, [fullscreen, navigation]));

  useEffect(() => {
    if (activeMission?.order_id) loadThreads();
  }, [activeMission?.order_id, loadThreads]);

  const showOfferModal = !!pendingOffer && !activeMission;
  const pendingMissionId = pendingOffer?.mission?.id;
  const declineRef = useRef(null);
  const offerLoadingRef = useRef(false);

  const handleDeclineOffer = useCallback(async () => {
    if (!pendingOffer?.mission?.id || offerLoadingRef.current) return;
    offerLoadingRef.current = true;
    setOfferLoading(true);
    try {
      await refuseMission(pendingOffer.mission.id);
    } catch {
      /* ignore */
    } finally {
      clearPendingOffer();
      offerLoadingRef.current = false;
      setOfferLoading(false);
    }
  }, [pendingOffer, clearPendingOffer]);

  declineRef.current = handleDeclineOffer;

  const handleAcceptOffer = useCallback(async () => {
    if (!pendingOffer?.mission?.id || offerLoadingRef.current) return;
    offerLoadingRef.current = true;
    setOfferLoading(true);
    clearInterval(offerTimerRef.current);
    try {
      const res = await acceptMission(pendingOffer.mission.id);
      const mission = res.data?.mission;
      clearPendingOffer();
      if (mission) {
        setActiveMission(mission);
        startActiveMission(mission);
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Impossible d\'accepter la course.';
      Alert.alert('Erreur', msg);
    } finally {
      offerLoadingRef.current = false;
      setOfferLoading(false);
    }
  }, [pendingOffer, clearPendingOffer, setActiveMission, startActiveMission]);

  useEffect(() => {
    if (!showOfferModal || offerLoading) {
      if (!showOfferModal) clearInterval(offerTimerRef.current);
      if (!showOfferModal) setSecondsLeft(OFFER_SECONDS);
      return undefined;
    }
    setSecondsLeft(OFFER_SECONDS);
    offerTimerRef.current = setInterval(() => {
      if (offerLoadingRef.current) return;
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(offerTimerRef.current);
          declineRef.current?.();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(offerTimerRef.current);
  }, [showOfferModal, pendingMissionId, offerLoading]);

  async function openChat(targetRole) {
    if (!activeMission) return;
    const isPickedUp = ['picked_up', 'delivering'].includes(activeMission.status);
    if (targetRole === 'client' && !isPickedUp) {
      Alert.alert('Indisponible', 'Vous pourrez contacter le client après la prise en charge.');
      return;
    }
    if (targetRole === 'merchant' && isPickedUp) {
      Alert.alert('Indisponible', 'La conversation commerçant est fermée après la prise en charge.');
      return;
    }
    await openCommunication(navigation, {
      orderId: activeMission.order_id,
      targetRole,
      title: targetRole === 'merchant' ? activeMission.store_name : activeMission.client_name,
      contextOrderId: activeMission.order_id,
    }, { registerThread });
  }

  const merchantUnread = activeMission
    ? getUnreadForOrder(activeMission.order_id, 'merchant_driver')
    : 0;
  const clientUnread = activeMission
    ? getUnreadForOrder(activeMission.order_id, 'client_driver')
    : 0;

  function handleMissionComplete() {
    setActiveMission(null);
    setFullscreen(false);
    setDrawerExpanded(false);
  }

  async function toggleOnline() {
    await setOnline(!online);
  }

  if (!ready) {
    return <ActivityIndicator style={styles.center} size="large" color={THEME.colors.accent} />;
  }

  if (fullscreen) {
    return (
      <View style={styles.fullRoot}>
        <StatusBar barStyle="dark-content" />
        <DriverMap lat={lat} lng={lng} fullScreen zoom={14} />
        <NewCourseOfferModal
          visible={showOfferModal}
          mission={pendingOffer?.mission}
          offer={pendingOffer?.offer}
          onAccept={handleAcceptOffer}
          onDecline={handleDeclineOffer}
          loading={offerLoading}
          secondsLeft={secondsLeft}
        />
        <SafeAreaView style={styles.homeFabWrap} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.homeFab}
            onPress={() => { setFullscreen(false); setDrawerExpanded(false); }}
            activeOpacity={0.75}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="home" size={22} color={THEME.colors.text} />
          </TouchableOpacity>
        </SafeAreaView>
        {activeMission ? (
          <MissionDrawer
            mission={activeMission}
            onMissionUpdate={setActiveMission}
            onMissionComplete={handleMissionComplete}
            onOpenChat={openChat}
            merchantUnread={merchantUnread}
            clientUnread={clientUnread}
            expanded={drawerExpanded}
            onExpandChange={setDrawerExpanded}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <NewCourseOfferModal
        visible={showOfferModal}
        mission={pendingOffer?.mission}
        offer={pendingOffer?.offer}
        onAccept={handleAcceptOffer}
        onDecline={handleDeclineOffer}
        loading={offerLoading}
        secondsLeft={secondsLeft}
      />
      <View style={styles.content}>
        <View style={styles.mapFrame}>
          <DriverMap lat={lat} lng={lng} zoom={14} height={MAP_HEIGHT} style={styles.mapStretch} />
          <TouchableOpacity
            style={styles.fullscreenBtn}
            onPress={() => {
              setFullscreen(true);
              if (activeMission) setDrawerExpanded(true);
            }}
            activeOpacity={0.75}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="expand-outline" size={18} color={THEME.colors.text} />
            <Text style={styles.fullscreenBtnText}>Plein écran</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.broadcast}>
          <Text style={styles.broadcastTitle}>Message de la part de Ma Zone à tous nos livreurs</Text>
          <Text style={styles.broadcastBody}>
            {broadcast || 'Aucun message pour le moment.'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.onlineBtn, online && styles.onlineBtnActive]}
          onPress={toggleOnline}
          activeOpacity={0.85}
        >
          <Text style={styles.onlineBtnText}>
            {online ? 'PASSER HORS LIGNE' : 'PASSEZ EN LIGNE'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.colors.bg },
  fullRoot: { flex: 1, backgroundColor: THEME.colors.bg },
  center: { flex: 1 },
  content: { flex: 1, paddingHorizontal: THEME.spacing.md, paddingBottom: THEME.spacing.md, gap: THEME.spacing.sm },
  mapFrame: {
    height: MAP_HEIGHT,
    width: '100%',
    borderRadius: THEME.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    ...THEME.shadow.md,
    position: 'relative',
  },
  mapStretch: { width: '100%', height: MAP_HEIGHT },
  fullscreenBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.radius.full,
    ...THEME.shadow.sm,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : null),
  },
  fullscreenBtnText: { fontSize: 13, fontWeight: '600', color: THEME.colors.text },
  homeFabWrap: { position: 'absolute', top: 0, left: 0, zIndex: 200, elevation: 200 },
  homeFab: {
    margin: THEME.spacing.md, width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center',
    ...THEME.shadow.md,
  },
  broadcast: {
    backgroundColor: THEME.colors.card, borderRadius: THEME.radius.md, padding: THEME.spacing.md,
    borderWidth: 1, borderColor: THEME.colors.borderLight, ...THEME.shadow.sm,
  },
  broadcastTitle: { ...THEME.typography.caption, color: THEME.colors.textMuted, marginBottom: 6 },
  broadcastBody: { ...THEME.typography.body, color: THEME.colors.text },
  onlineBtn: {
    alignSelf: 'center', width: 100, height: 100, borderRadius: 50,
    backgroundColor: THEME.colors.accent, alignItems: 'center', justifyContent: 'center',
    ...THEME.shadow.float, marginBottom: THEME.spacing.sm,
  },
  onlineBtnActive: { backgroundColor: THEME.colors.primary },
  onlineBtnText: {
    color: '#fff', fontWeight: '800', fontSize: 12, textAlign: 'center', letterSpacing: 0.5,
    paddingHorizontal: 10,
  },
});
