import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { imageUrl } from '../utils/format';
import { COLORS } from '../config';

const ROLE_COLORS = {
  client: COLORS.primary,
  merchant: '#059669',
  driver: '#7c3aed',
};

export default function Avatar({ name, photoUrl, role, size = 44 }) {
  const initial = name?.trim()?.[0]?.toUpperCase() || '?';
  const bg = ROLE_COLORS[role] || COLORS.primary;
  const radius = size / 2;

  if (photoUrl) {
    return (
      <Image
        source={{ uri: imageUrl(photoUrl) }}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: '#ddd' }}
      />
    );
  }

  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: radius, backgroundColor: bg }]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#fff', fontWeight: '800' },
});
