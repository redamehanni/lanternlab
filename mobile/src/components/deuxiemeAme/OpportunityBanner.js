import React, { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AME, MOTION } from '../../theme';
import { useOpportunity } from '../../context/OpportunityContext';

/**
 * Bannière d'Opportunité Volante — flash pastel / sérénité.
 */
export default function OpportunityBanner({ onOpen }) {
  const { current, dismiss } = useOpportunity();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-140)).current;

  useEffect(() => {
    if (current) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        ...MOTION.spring.soft,
      }).start();
      const timer = setTimeout(hide, 8000);
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  function hide() {
    Animated.timing(translateY, {
      toValue: -160,
      duration: MOTION.duration.base,
      useNativeDriver: true,
    }).start(() => dismiss());
  }

  if (!current) return null;
  const ev = current.event;
  const d = ev.display || {};
  const title = d.title || ev.title || 'Une opportunité près de vous';
  const subtitle = d.subtitle || ev.summary || 'Une initiative vient de s\u2019ouvrir dans votre quartier';

  return (
    <Animated.View style={[styles.wrap, { paddingTop: insets.top + 8, transform: [{ translateY }] }]}>
      <TouchableOpacity
        style={[styles.card, AME.shadow.lg]}
        activeOpacity={0.92}
        onPress={() => { onOpen?.(current); hide(); }}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="flash" size={18} color={AME.colors.textOnAccent} />
        </View>
        <View style={styles.body}>
          <Text style={styles.kicker}>OPPORTUNITÉ VOLANTE</Text>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.sub} numberOfLines={1}>{subtitle}</Text>
        </View>
        <TouchableOpacity onPress={hide} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={20} color={AME.colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: AME.spacing.md,
    zIndex: 9998,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: AME.colors.card,
    borderRadius: AME.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: AME.colors.borderLight,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: AME.colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  kicker: {
    fontSize: 10,
    fontFamily: AME.fonts.uiBold,
    letterSpacing: 1.1,
    color: AME.colors.warning,
  },
  title: {
    fontFamily: AME.fonts.display,
    fontSize: 17,
    color: AME.colors.text,
    marginTop: 2,
  },
  sub: {
    fontFamily: AME.fonts.ui,
    fontSize: 12.5,
    color: AME.colors.textSecondary,
    marginTop: 1,
  },
});
