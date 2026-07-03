import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, PanResponder,
  Dimensions, ActivityIndicator, Linking, Platform, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../theme';
import SlideConfirm from './SlideConfirm';
import { updateMissionStatus } from '../../api';

const { height: SH } = Dimensions.get('window');
const COLLAPSED = 88;
const HALF = SH * 0.42;
const FULL = SH * 0.78;

function openNavigation(address, lat, lng) {
  const q = encodeURIComponent(address || `${lat},${lng}`);
  const options = [
    { label: 'Plans', url: Platform.OS === 'ios' ? `maps://?daddr=${q}` : `geo:${lat},${lng}?q=${q}` },
    { label: 'Google Maps', url: `https://www.google.com/maps/dir/?api=1&destination=${q}` },
    { label: 'Waze', url: `https://waze.com/ul?q=${q}&navigate=yes` },
  ];
  Alert.alert('Navigation', 'Choisissez une application', [
    ...options.map((o) => ({ text: o.label, onPress: () => Linking.openURL(o.url).catch(() => {}) })),
    { text: 'Annuler', style: 'cancel' },
  ]);
}

export default function MissionDrawer({
  mission,
  onMissionUpdate,
  onMissionComplete,
  onOpenChat,
  chatUnread,
  expanded,
  onExpandChange,
}) {
  const heightAnim = useRef(new Animated.Value(COLLAPSED)).current;
  const dragStartH = useRef(COLLAPSED);
  const [snap, setSnap] = useState('collapsed');
  const [uiStep, setUiStep] = useState('merchant');
  const [slideKey, setSlideKey] = useState(0);
  const [updating, setUpdating] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;

  const isPickedUp = mission && ['picked_up', 'delivering', 'delivered'].includes(mission.status);
  const chatTarget = isPickedUp ? 'client' : 'merchant';

  useEffect(() => {
    if (!mission) {
      setUiStep('idle');
      return;
    }
    if (mission.status === 'delivered') setUiStep('done');
    else if (['delivering'].includes(mission.status)) setUiStep('client');
    else if (['picked_up'].includes(mission.status)) setUiStep('client');
    else if (['picking_up'].includes(mission.status)) setUiStep('ready');
    else setUiStep('merchant');
  }, [mission?.id, mission?.status]);

  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 8, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: -8, duration: 900, useNativeDriver: true }),
    ]));
    if (!mission) anim.start();
    return () => anim.stop();
  }, [mission, pulse]);

  const snapTo = useCallback((h, name) => {
    setSnap(name);
    onExpandChange?.(name !== 'collapsed');
    Animated.spring(heightAnim, {
      toValue: h, useNativeDriver: false, friction: 9, tension: 65,
    }).start();
  }, [heightAnim, onExpandChange]);

  useEffect(() => {
    if (expanded) snapTo(HALF, 'half');
    else snapTo(COLLAPSED, 'collapsed');
  }, [expanded, snapTo]);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
    onPanResponderGrant: () => {
      heightAnim.stopAnimation((v) => { dragStartH.current = v; });
    },
    onPanResponderMove: (_, g) => {
      const next = Math.max(COLLAPSED, Math.min(FULL, dragStartH.current - g.dy));
      heightAnim.setValue(next);
    },
    onPanResponderRelease: (_, g) => {
      heightAnim.stopAnimation((v) => {
        if (g.dy < -40 || v > HALF + 60) snapTo(FULL, 'full');
        else if (g.dy > 40 || v < (COLLAPSED + HALF) / 2) snapTo(COLLAPSED, 'collapsed');
        else snapTo(HALF, 'half');
      });
    },
  })).current;

  async function patchStatus(status) {
    if (!mission || updating) return;
    setUpdating(true);
    try {
      const res = await updateMissionStatus(mission.id, status);
      onMissionUpdate?.(res.data.mission);
      if (status === 'delivered') onMissionComplete?.();
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.error || 'Mise à jour impossible.');
    } finally {
      setUpdating(false);
    }
  }

  function handlePickupSlide() {
    patchStatus('picked_up');
    setUiStep('ready');
    setSlideKey((k) => k + 1);
  }

  function handleReadyNo() {
    setUiStep('merchant');
    setSlideKey((k) => k + 1);
  }

  function handleReadyYes() {
    patchStatus('delivering');
    setUiStep('client');
  }

  function handleDeliverSlide() {
    patchStatus('delivered');
    setUiStep('done');
  }

  const handleToggle = () => {
    if (snap === 'collapsed') snapTo(HALF, 'half');
    else snapTo(COLLAPSED, 'collapsed');
  };

  return (
    <Animated.View style={[styles.drawer, { height: heightAnim }]} pointerEvents="box-none">
      <View {...pan.panHandlers}>
        <TouchableOpacity style={styles.handle} onPress={handleToggle} activeOpacity={0.8}>
          <View style={styles.handleBar} />
          <View style={styles.handleRow}>
            {!mission && (
              <Animated.View style={{ transform: [{ translateX: pulse }] }}>
                <Ionicons name="time-outline" size={16} color={THEME.colors.accent} />
              </Animated.View>
            )}
            <Text style={styles.handleTitle}>
              {mission ? 'Course en cours' : 'En attente de course'}
            </Text>
            <Ionicons
              name={snap === 'collapsed' ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={THEME.colors.textMuted}
            />
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        bounces={false}
      >
        {!mission && (
          <Text style={styles.emptyText}>
            Aucune course en cours pour le moment. Toutes les informations de votre prochaine course apparaîtront ici.
          </Text>
        )}

        {mission && uiStep === 'merchant' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Commerçant</Text>
            <Text style={styles.sectionTitle}>{mission.store_name}</Text>
            <Text style={styles.sectionAddr}>{mission.store_address}</Text>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.btnOutline} onPress={() => onOpenChat?.('merchant')}>
                <Ionicons name="chatbubble-outline" size={18} color={THEME.colors.accent} />
                <Text style={styles.btnOutlineText}>Message</Text>
                {chatUnread && chatTarget === 'merchant' && <View style={styles.dot} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => openNavigation(mission.store_address, mission.store_lat, mission.store_lng)}
              >
                <Ionicons name="navigate" size={18} color="#fff" />
                <Text style={styles.btnPrimaryText}>Navigation</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>Rendez-vous chez le commerçant</Text>
            <View style={styles.confirmBox}>
              <Text style={styles.confirmText}>Veuillez confirmer la prise en charge du produit</Text>
              <TouchableOpacity style={styles.btnBlue} onPress={() => setUiStep('pickup_slide')}>
                <Text style={styles.btnBlueText}>Confirmer la prise en charge</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {mission && uiStep === 'pickup_slide' && (
          <View style={styles.section}>
            <SlideConfirm
              label="Glisser pour confirmer la prise en charge"
              onConfirm={handlePickupSlide}
              resetKey={slideKey}
            />
          </View>
        )}

        {mission && uiStep === 'ready' && (
          <View style={styles.section}>
            <Text style={styles.readyQ}>Êtes-vous prêt à vous diriger vers votre prochaine destination ?</Text>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.btnYes} onPress={handleReadyYes}>
                <Text style={styles.btnYesText}>OUI</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnNo} onPress={handleReadyNo}>
                <Text style={styles.btnNoText}>NON</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {mission && (uiStep === 'client' || uiStep === 'deliver_slide') && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Client</Text>
            <Text style={styles.sectionTitle}>{mission.client_name}</Text>
            <Text style={styles.sectionAddr}>{mission.delivery_address}</Text>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.btnOutline} onPress={() => onOpenChat?.('client')}>
                <Ionicons name="chatbubble-outline" size={18} color={THEME.colors.accent} />
                <Text style={styles.btnOutlineText}>Message</Text>
                {chatUnread && chatTarget === 'client' && <View style={styles.dot} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => openNavigation(mission.delivery_address)}
              >
                <Ionicons name="navigate" size={18} color="#fff" />
                <Text style={styles.btnPrimaryText}>Navigation</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>Rendez-vous chez votre client</Text>
            {uiStep === 'client' && (
              <TouchableOpacity style={styles.btnBlue} onPress={() => setUiStep('deliver_slide')}>
                <Text style={styles.btnBlueText}>Livrer le colis</Text>
              </TouchableOpacity>
            )}
            {uiStep === 'deliver_slide' && (
              <SlideConfirm
                label="Glisser pour confirmer la livraison"
                onConfirm={handleDeliverSlide}
                resetKey={slideKey}
              />
            )}
          </View>
        )}

        {mission && uiStep === 'done' && (
          <View style={styles.doneBox}>
            <Ionicons name="checkmark-circle" size={48} color={THEME.colors.success} />
            <Text style={styles.doneTitle}>Course terminée</Text>
            <Text style={styles.doneSub}>Bravo ! Vous pouvez passer à la suivante.</Text>
          </View>
        )}

        {updating && <ActivityIndicator style={{ marginTop: 12 }} color={THEME.colors.accent} />}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: THEME.colors.card, borderTopLeftRadius: THEME.radius.xl,
    borderTopRightRadius: THEME.radius.xl, ...THEME.shadow.lg, zIndex: 100,
    overflow: 'hidden',
  },
  handle: { paddingTop: 10, paddingBottom: 8, paddingHorizontal: THEME.spacing.lg },
  handleBar: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: THEME.colors.border,
    alignSelf: 'center', marginBottom: 10,
  },
  handleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  handleTitle: { ...THEME.typography.subtitle, color: THEME.colors.text, flex: 1 },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: THEME.spacing.lg, paddingBottom: 40 },
  emptyText: { ...THEME.typography.body, color: THEME.colors.textSecondary, lineHeight: 22 },
  section: { gap: 4 },
  sectionLabel: { ...THEME.typography.micro, color: THEME.colors.textMuted, textTransform: 'uppercase' },
  sectionTitle: { ...THEME.typography.title, color: THEME.colors.text },
  sectionAddr: { ...THEME.typography.body, color: THEME.colors.textSecondary, marginBottom: 12 },
  btnRow: { flexDirection: 'row', gap: 10, marginVertical: 8 },
  btnOutline: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: THEME.radius.md, borderWidth: 1.5,
    borderColor: THEME.colors.border, backgroundColor: THEME.colors.bgElevated,
  },
  btnOutlineText: { fontWeight: '700', color: THEME.colors.accent },
  btnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: THEME.radius.md, backgroundColor: THEME.colors.primary,
  },
  btnPrimaryText: { fontWeight: '700', color: '#fff' },
  dot: {
    position: 'absolute', top: 8, right: 12, width: 10, height: 10,
    borderRadius: 5, backgroundColor: THEME.colors.accent, borderWidth: 2, borderColor: '#fff',
  },
  hint: { fontSize: 13, color: THEME.colors.textMuted, fontStyle: 'italic', marginTop: 4 },
  confirmBox: {
    backgroundColor: '#fff', borderRadius: THEME.radius.md, padding: THEME.spacing.md,
    marginTop: 16, borderWidth: 1, borderColor: THEME.colors.borderLight, ...THEME.shadow.sm,
  },
  confirmText: { ...THEME.typography.body, color: THEME.colors.text, marginBottom: 12 },
  btnBlue: {
    backgroundColor: THEME.colors.accent, borderRadius: THEME.radius.md,
    paddingVertical: 14, alignItems: 'center',
  },
  btnBlueText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  readyQ: { ...THEME.typography.subtitle, color: THEME.colors.text, marginVertical: 16, textAlign: 'center' },
  btnYes: {
    flex: 1, backgroundColor: THEME.colors.success, borderRadius: THEME.radius.md,
    paddingVertical: 16, alignItems: 'center',
  },
  btnYesText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  btnNo: {
    flex: 1, backgroundColor: THEME.colors.bg, borderRadius: THEME.radius.md,
    paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: THEME.colors.border,
  },
  btnNoText: { color: THEME.colors.textSecondary, fontWeight: '700', fontSize: 16 },
  doneBox: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  doneTitle: { ...THEME.typography.title, color: THEME.colors.success },
  doneSub: { color: THEME.colors.textSecondary },
});
