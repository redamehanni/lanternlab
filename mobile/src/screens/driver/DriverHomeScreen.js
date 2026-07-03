import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  SafeAreaView, StatusBar, Platform, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { useDriver } from '../../context/DriverContext';
import { resolveConversation } from '../../api';
import DriverMap from '../../components/driver/DriverMap';
import MissionDrawer from '../../components/driver/MissionDrawer';
import { THEME } from '../../theme';

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
    chatUnread, setChatUnread, ready,
    onMissionAssigned,
  } = useDriver();

  const [fullscreen, setFullscreen] = useState(false);
  const [drawerExpanded, setDrawerExpanded] = useState(false);

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
    try {
      const res = await resolveConversation(activeMission.order_id, targetRole);
      setChatUnread(false);
      navigation.navigate('Chat', {
        conversationId: res.data.conversation.id,
        title: targetRole === 'merchant' ? activeMission.store_name : activeMission.client_name,
        ephemeral: true,
      });
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.error || 'Conversation indisponible.');
    }
  }

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
            chatUnread={chatUnread}
            expanded={drawerExpanded}
            onExpandChange={setDrawerExpanded}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.root}>
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
