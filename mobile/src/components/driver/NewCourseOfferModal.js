import React, { useEffect, useRef } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, Animated, Platform, Vibration,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../theme';
import { euro, formatMinutes } from '../../utils/format';

function formatDistance(meters) {
  if (meters == null) return '—';
  if (meters < 1000) return `${meters} mètres`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export default function NewCourseOfferModal({ visible, mission, offer, onAccept, onDecline, loading }) {
  const slide = useRef(new Animated.Value(80)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    slide.setValue(80);
    fade.setValue(0);
    Animated.parallel([
      Animated.spring(slide, { toValue: 0, friction: 8, tension: 65, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      Vibration.vibrate([0, 120, 60, 120]);
    }
  }, [visible, slide, fade]);

  if (!mission || !offer) return null;

  const earnings = offer.earnings ?? offer.commission ?? 0;

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fade }]}>
        <Animated.View style={[styles.card, { transform: [{ translateY: slide }] }]}>
          <View style={styles.badge}>
            <Ionicons name="flash" size={14} color={THEME.colors.accent} />
            <Text style={styles.badgeText}>NOUVELLE COURSE</Text>
          </View>

          <Text style={styles.storeName}>{offer.store_name || mission.store_name}</Text>
          <Text style={styles.storeAddr}>{offer.store_address || mission.store_address}</Text>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Ionicons name="navigate-outline" size={20} color={THEME.colors.textSecondary} />
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Distance jusqu'au commerçant</Text>
              <Text style={styles.rowValue}>{formatDistance(offer.distance_to_store_m)}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <Ionicons name="map-outline" size={20} color={THEME.colors.textSecondary} />
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Distance totale estimée</Text>
              <Text style={styles.rowValue}>{formatDistance(offer.distance_total_m)}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <Ionicons name="time-outline" size={20} color={THEME.colors.textSecondary} />
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Temps estimé</Text>
              <Text style={styles.rowValue}>
                {offer.estimated_minutes ? formatMinutes(offer.estimated_minutes) : '—'}
              </Text>
            </View>
          </View>

          <View style={styles.earningsBox}>
            <Text style={styles.earningsLabel}>Revenu estimé</Text>
            <Text style={styles.earningsValue}>{euro(earnings)}</Text>
          </View>

          <Text style={styles.question}>Acceptez-vous cette course ?</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.noBtn}
              onPress={onDecline}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.noBtnText}>NON</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.yesBtn}
              onPress={onAccept}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.yesBtnText}>{loading ? '…' : 'OUI'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    padding: THEME.spacing.lg,
  },
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.xl,
    padding: THEME.spacing.lg,
    ...THEME.shadow.float,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    backgroundColor: THEME.colors.accentSoft,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    marginBottom: THEME.spacing.md,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: THEME.colors.accent,
  },
  storeName: {
    ...THEME.typography.title,
    fontSize: 24,
    color: THEME.colors.text,
    textAlign: 'center',
  },
  storeAddr: {
    ...THEME.typography.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: THEME.colors.borderLight,
    marginVertical: THEME.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 12, color: THEME.colors.textMuted, marginBottom: 2 },
  rowValue: { fontSize: 16, fontWeight: '700', color: THEME.colors.text },
  earningsBox: {
    backgroundColor: '#ecfdf5',
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  earningsLabel: { fontSize: 12, color: '#047857', fontWeight: '600' },
  earningsValue: { fontSize: 32, fontWeight: '900', color: '#059669', marginTop: 4 },
  question: {
    ...THEME.typography.subtitle,
    textAlign: 'center',
    color: THEME.colors.text,
    marginBottom: THEME.spacing.md,
  },
  actions: { flexDirection: 'row', gap: 12 },
  noBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: THEME.radius.md,
    borderWidth: 2,
    borderColor: THEME.colors.error,
    alignItems: 'center',
  },
  noBtnText: { color: THEME.colors.error, fontWeight: '800', fontSize: 16 },
  yesBtn: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.success,
    alignItems: 'center',
    ...THEME.shadow.md,
  },
  yesBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
