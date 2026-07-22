import React, { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../theme';
import { useOpportunity } from '../../context/OpportunityContext';

/**
 * Bannière d'Opportunité Volante : quand l'organe diffuse une initiative vers
 * l'habitant (socket event:opportunity), on la porte visuellement en haut de la
 * Deuxième Âme. Présentationnel : l'organe décide du contenu et des cibles.
 */
export default function OpportunityBanner({ onOpen }) {
  const { current, dismiss } = useOpportunity();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-140)).current;

  useEffect(() => {
    if (current) {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 11 }).start();
      const timer = setTimeout(hide, 8000);
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  function hide() {
    Animated.timing(translateY, { toValue: -160, duration: 220, useNativeDriver: true }).start(() => dismiss());
  }

  if (!current) return null;
  const ev = current.event;
  const d = ev.display || {};
  const title = d.title || ev.title || 'Une opportunité près de vous';
  const subtitle = d.subtitle || ev.summary || 'Une initiative vient de s\u2019ouvrir dans votre quartier';

  return (
    <Animated.View style={[styles.wrap, { paddingTop: insets.top + 8, transform: [{ translateY }] }]}>
      <TouchableOpacity
        style={[styles.card, THEME.shadow.lg]}
        activeOpacity={0.92}
        onPress={() => { onOpen?.(ev); hide(); }}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="flash" size={18} color="#fff" />
        </View>
        <View style={styles.body}>
          <Text style={styles.kicker}>OPPORTUNITÉ VOLANTE</Text>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.sub} numberOfLines={1}>{subtitle}</Text>
        </View>
        <TouchableOpacity onPress={hide} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={20} color={THEME.colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: THEME.spacing.md, zIndex: 9998 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: THEME.colors.card, borderRadius: THEME.radius.lg, padding: 14,
    borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.colors.warning,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1 },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: THEME.colors.warning },
  title: { fontSize: 15, fontWeight: '800', color: THEME.colors.text, marginTop: 2 },
  sub: { fontSize: 12.5, color: THEME.colors.textSecondary, marginTop: 1 },
});
