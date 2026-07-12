import React, { useEffect, useRef } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, Animated, Platform, Vibration,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../theme';
import { euro } from '../../utils/format';

export default function NewCourseOfferModal({
  visible, mission, offer, onAccept, onDecline, loading, secondsLeft = 20,
}) {
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

  const earnings = offer.earnings ?? 0;
  const base = offer.base ?? 3.99;
  const bonus = offer.bonus ?? 0;

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fade }]}>
        <Animated.View style={[styles.card, { transform: [{ translateY: slide }] }]}>
          <View style={styles.badge}>
            <Ionicons name="flash" size={14} color={THEME.colors.accent} />
            <Text style={styles.badgeText}>NOUVELLE COURSE</Text>
          </View>

          <Text style={styles.headline}>Nouvelle course disponible !</Text>
          <Text style={styles.storeName}>{offer.store_name || mission.store_name}</Text>

          <View style={styles.divider} />

          <View style={styles.earningsBox}>
            <Text style={styles.earningsLabel}>Rémunération estimée</Text>
            <Text style={styles.earningsValue}>{euro(earnings)}</Text>
            <Text style={styles.earningsDetail}>
              {euro(base)} + {Math.round(bonus * 100) / 100} € (10 % commande)
            </Text>
          </View>

          <View style={styles.countdownRow}>
            <Ionicons name="timer-outline" size={18} color={secondsLeft <= 5 ? THEME.colors.error : THEME.colors.textSecondary} />
            <Text style={[styles.countdown, secondsLeft <= 5 && styles.countdownUrgent]}>
              {secondsLeft}s restantes
            </Text>
          </View>

          <Text style={styles.question}>Souhaitez-vous accepter cette course ?</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.noBtn}
              onPress={onDecline}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.noBtnText}>Refuser</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.yesBtn}
              onPress={onAccept}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.yesBtnText}>{loading ? '…' : 'Accepter'}</Text>
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
    marginBottom: THEME.spacing.sm,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: THEME.colors.accent,
  },
  headline: {
    ...THEME.typography.title,
    fontSize: 20,
    color: THEME.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  storeName: {
    ...THEME.typography.subtitle,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: THEME.colors.borderLight,
    marginVertical: THEME.spacing.lg,
  },
  earningsBox: {
    backgroundColor: '#ecfdf5',
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  earningsLabel: { fontSize: 12, color: '#047857', fontWeight: '600' },
  earningsValue: { fontSize: 32, fontWeight: '900', color: '#059669', marginTop: 4 },
  earningsDetail: { fontSize: 12, color: '#065f46', marginTop: 6 },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: THEME.spacing.md,
  },
  countdown: { fontSize: 15, fontWeight: '700', color: THEME.colors.textSecondary },
  countdownUrgent: { color: THEME.colors.error },
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
