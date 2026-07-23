import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AME } from '../../theme';
import { timeAgo } from '../../utils/format';
import Illustration from '../../illustrations/Illustration';
import { AmeBadge } from '../ui/AmeCard';

/**
 * Murmure du quartier — carte chaleureuse, vignette illustrée.
 */
export default function MurmurCard({ murmur, onPress }) {
  const d = murmur.display || {};
  const title = d.subtitle || d.title || murmur.title || murmur.summary || 'Un murmure du quartier';
  const when = murmur.startsAt || murmur.createdAt;
  const isNew = when && (Date.now() - new Date(when).getTime()) < 1000 * 60 * 60 * 24;

  return (
    <TouchableOpacity style={[styles.card, AME.shadow.sm]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.top}>
        <Illustration name="murmures.default" size={40} style={styles.thumb} />
        {isNew ? <AmeBadge label="Nouveau" tone="nouveau" /> : null}
      </View>
      <Text style={styles.text} numberOfLines={3}>{title}</Text>
      {when ? <Text style={styles.time}>{timeAgo(when)}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 200,
    backgroundColor: AME.colors.card,
    borderRadius: AME.radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: AME.colors.borderLight,
    justifyContent: 'space-between',
    minHeight: 136,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  thumb: { borderRadius: 20 },
  text: {
    fontFamily: AME.fonts.uiMedium,
    fontSize: 14,
    color: AME.colors.text,
    lineHeight: 20,
    flex: 1,
  },
  time: {
    fontFamily: AME.fonts.ui,
    fontSize: 12,
    color: AME.colors.textMuted,
    marginTop: 10,
  },
});
