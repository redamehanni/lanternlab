import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function UnreadDot({ count, style }) {
  if (!count || count <= 0) return null;
  return (
    <View style={[styles.dot, style]}>
      {count > 1 ? <Text style={styles.count}>{count > 9 ? '9+' : count}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  count: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
  },
});
