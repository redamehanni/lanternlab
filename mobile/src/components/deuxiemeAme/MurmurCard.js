import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../theme';
import { timeAgo } from '../../utils/format';

/**
 * Un murmure du quartier : une projection poétique (isMurmur) présentée comme un
 * petit fragment de vie locale. Présentationnel uniquement.
 */
export default function MurmurCard({ murmur, onPress }) {
  const d = murmur.display || {};
  const title = d.subtitle || d.title || murmur.title || murmur.summary || 'Un murmure du quartier';
  const when = murmur.startsAt || murmur.createdAt;
  return (
    <TouchableOpacity style={[styles.card, THEME.shadow.sm]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.iconWrap}>
        <Ionicons name="sparkles-outline" size={16} color={THEME.colors.accent} />
      </View>
      <Text style={styles.text} numberOfLines={3}>{title}</Text>
      {when ? <Text style={styles.time}>{timeAgo(when)}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 190,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    justifyContent: 'space-between',
    minHeight: 120,
  },
  iconWrap: {
    width: 30, height: 30, borderRadius: 10, backgroundColor: THEME.colors.accentSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  text: { fontSize: 13.5, color: THEME.colors.text, lineHeight: 19, fontWeight: '500', flex: 1 },
  time: { fontSize: 11.5, color: THEME.colors.textMuted, marginTop: 10 },
});
