import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AME } from '../../theme';

/**
 * Une initiative dans une liste de découverte. Rendu piloté par `event.display`
 * fourni par l'organe ; la surface n'interprète aucune règle métier.
 */
export default function EventListItem({ event, onPress }) {
  const d = event.display || {};
  const title = d.title || event.title;
  const subtitle = d.subtitle || event.summary;
  const when = d.when || event.startsAt;
  const where = d.where || event.address;
  const caps = event.capabilities || {};

  return (
    <TouchableOpacity style={[styles.card, AME.shadow.sm]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.top}>
        {d.category ? <Text style={styles.category}>{String(d.category).toUpperCase()}</Text> : null}
        <View style={styles.tags}>
          {caps.isLantern ? <Tag icon="sparkles-outline" label="Lanterne" color={AME.colors.portes.lanternes} /> : null}
          {caps.canTicket ? <Tag icon="ticket-outline" label="Billet" color={AME.colors.accent} /> : null}
        </View>
      </View>
      <Text style={styles.title} numberOfLines={2}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
      <View style={styles.metaRow}>
        {when ? (
          <View style={styles.meta}>
            <Ionicons name="time-outline" size={13} color={AME.colors.textMuted} />
            <Text style={styles.metaText}>{when}</Text>
          </View>
        ) : null}
        {where ? (
          <View style={styles.meta}>
            <Ionicons name="location-outline" size={13} color={AME.colors.textMuted} />
            <Text style={styles.metaText} numberOfLines={1}>{where}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function Tag({ icon, label, color }) {
  return (
    <View style={[styles.tag, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon} size={11} color={color} />
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AME.colors.card,
    borderRadius: AME.radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: AME.colors.borderLight,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  category: {
    fontSize: 10.5,
    fontFamily: AME.fonts.uiBold,
    letterSpacing: 0.8,
    color: AME.colors.textMuted,
  },
  tags: { flexDirection: 'row', gap: 6 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: AME.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontSize: 10.5, fontFamily: AME.fonts.uiSemiBold },
  title: {
    fontFamily: AME.fonts.display,
    fontSize: 18,
    color: AME.colors.text,
    marginTop: 8,
  },
  subtitle: {
    fontFamily: AME.fonts.ui,
    fontSize: 13.5,
    color: AME.colors.textSecondary,
    marginTop: 4,
    lineHeight: 19,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '60%' },
  metaText: { fontSize: 12, fontFamily: AME.fonts.ui, color: AME.colors.textMuted },
});
