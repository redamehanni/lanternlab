import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Animated, PanResponder, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../theme';

const TRACK_W = Dimensions.get('window').width - 64;
const THUMB = 52;
const MAX = TRACK_W - THUMB - 8;

export default function SlideConfirm({ label, onConfirm, disabled, resetKey }) {
  const x = useRef(new Animated.Value(0)).current;
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDone(false);
    x.setValue(0);
  }, [resetKey, x]);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled && !done,
    onPanResponderMove: (_, g) => {
      x.setValue(Math.max(0, Math.min(MAX, g.dx)));
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx >= MAX * 0.85) {
        Animated.spring(x, { toValue: MAX, useNativeDriver: false, friction: 8 }).start(() => {
          setDone(true);
          onConfirm?.();
        });
      } else {
        Animated.spring(x, { toValue: 0, useNativeDriver: false, friction: 8 }).start();
      }
    },
  })).current;

  return (
    <View style={[styles.track, disabled && styles.disabled]}>
      <Text style={styles.label}>{done ? 'Confirmé ✓' : label}</Text>
      <Animated.View style={[styles.thumb, { transform: [{ translateX: x }] }]} {...pan.panHandlers}>
        <Ionicons name="chevron-forward" size={22} color="#fff" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 60, borderRadius: THEME.radius.full, backgroundColor: THEME.colors.primary,
    justifyContent: 'center', overflow: 'hidden', marginVertical: THEME.spacing.sm,
  },
  disabled: { opacity: 0.5 },
  label: {
    textAlign: 'center', color: 'rgba(255,255,255,0.85)',
    fontSize: 14, fontWeight: '600', letterSpacing: 0.2,
  },
  thumb: {
    position: 'absolute', left: 4, top: 4,
    width: THUMB, height: THUMB - 8, borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.accent, alignItems: 'center', justifyContent: 'center',
    ...THEME.shadow.float,
  },
});
