import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../theme';

export default function MapMarkerPin({ color = THEME.colors.accent, size = 32 }) {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scale.setValue(0);
    Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
  }, [scale]);

  return (
    <Animated.View style={[styles.wrap, { transform: [{ scale }] }]}>
      <View style={[styles.pin, { backgroundColor: color, width: size, height: size, borderRadius: size / 2 }]}>
        <Ionicons name="location" size={size * 0.5} color="#fff" />
      </View>
      <View style={[styles.dot, { backgroundColor: color }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  pin: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#fff', ...THEME.shadow.float,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
});
