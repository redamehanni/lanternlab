import React from 'react';
import { View, Text, StyleSheet, ImageBackground, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AME } from '../../theme';
import { getIllustration } from '../../illustrations/registry';

/**
 * Bannière — cœur émotionnel de la Deuxième Âme.
 *
 * Philosophie : une fenêtre ouverte sur le quartier, pas une carte UI.
 * Scène immersive → cartouche poétique flottant → stats qui émergent de la scène.
 * Illustration via registry (`banner.quartier`).
 */
export default function WeatherHero({
  location,
  ambiance,
  stats,
  loading,
  illustrationKey = 'banner.quartier',
  headline = 'Le quartier est vivant.',
  subline = 'Et aujourd\u2019hui, il vous réserve de belles choses.',
}) {
  const a = ambiance || {};
  const illu = getIllustration(illustrationKey);
  const events = stats?.events ?? 0;
  const lanterns = stats?.lanterns ?? 0;
  // Accès public V1 : la surface peut masquer le signal « événements » pour ne
  // pas trahir une Porte scellée. Les Murmurs, eux, restent un canal non filtré.
  const showEvents = stats?.showEvents !== false;

  return (
    <View style={styles.scene}>
      <ImageBackground
        source={illu.source}
        style={styles.canvas}
        imageStyle={styles.canvasImg}
      >
        {/* Voile cinématographique : haut doux, bas un peu plus présent pour le texte */}
        <LinearGradient
          colors={[
            'rgba(28, 22, 18, 0.08)',
            'rgba(28, 22, 18, 0.18)',
            'rgba(28, 22, 18, 0.42)',
          ]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.top}>
          <View style={styles.locRow}>
            <Ionicons name="location-outline" size={13} color="rgba(255,251,247,0.88)" />
            <Text style={styles.loc}>{(location || 'Mon quartier').toUpperCase()}</Text>
          </View>
          {a.condition ? <Text style={styles.cond}>{a.condition}</Text> : null}
        </View>

        <View style={styles.mid}>
          <View style={[styles.cartouche, styles.cartoucheShadow]}>
            <Text style={styles.headline}>{headline}</Text>
            <Text style={styles.subline}>{subline}</Text>
            {a.temp != null ? (
              <Text style={styles.tempHint}>{a.temp}° · {a.condition || 'dehors'}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.statsRow}>
          {showEvents ? (
            <StatPill
              icon="calendar-outline"
              value={loading ? '…' : String(events)}
              label={events > 1 ? 'événements en cours' : 'événement en cours'}
            />
          ) : null}
          <StatPill
            icon="sparkles-outline"
            value={loading ? '…' : String(lanterns)}
            label={lanterns > 1 ? 'lanternes disponibles' : 'lanterne disponible'}
          />
        </View>

        {/* Fondu vers le papier de la page — la scène se dissout, pas un bord de carte */}
        <LinearGradient
          colors={['rgba(247, 241, 234, 0)', 'rgba(247, 241, 234, 0.35)', 'rgba(247, 241, 234, 0.72)']}
          locations={[0, 0.5, 1]}
          style={styles.pageBleed}
          pointerEvents="none"
        />
      </ImageBackground>
    </View>
  );
}

function StatPill({ icon, value, label }) {
  return (
    <View style={[styles.pill, styles.pillShadow]}>
      <View style={styles.pillIcon}>
        <Ionicons name={icon} size={14} color={AME.colors.accentDeep} />
      </View>
      <View style={styles.pillText}>
        <Text style={styles.pillValue}>{value}</Text>
        <Text style={styles.pillLabel} numberOfLines={2}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    borderRadius: 0,
    borderBottomLeftRadius: AME.radius.xxl,
    borderBottomRightRadius: AME.radius.xxl,
    overflow: 'hidden',
    // Présence douce — plus de « carte flottante » latérale
    shadowColor: '#5C4030',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 2,
    backgroundColor: 'transparent',
  },
  canvas: {
    minHeight: 318,
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 18,
    justifyContent: 'space-between',
  },
  canvasImg: {
    resizeMode: 'cover',
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: AME.radius.full,
    backgroundColor: 'rgba(28, 22, 18, 0.2)',
  },
  loc: {
    color: 'rgba(255,251,247,0.92)',
    fontSize: 10.5,
    fontFamily: AME.fonts.uiSemiBold,
    letterSpacing: 1.3,
  },
  cond: {
    color: 'rgba(255,251,247,0.82)',
    fontSize: 12,
    fontFamily: AME.fonts.uiMedium,
  },
  mid: {
    zIndex: 2,
    alignItems: 'center',
    paddingHorizontal: 4,
    marginTop: 12,
    flexGrow: 1,
    justifyContent: 'center',
  },
  cartouche: {
    maxWidth: '92%',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: 'rgba(28, 22, 18, 0.32)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 251, 247, 0.16)',
  },
  cartoucheShadow: Platform.select({
    ios: {
      shadowColor: '#1A1410',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 18,
    },
    android: { elevation: 4 },
    default: {},
  }),
  headline: {
    fontFamily: AME.fonts.display,
    fontSize: 28,
    color: AME.colors.textOnDark,
    letterSpacing: -0.4,
    lineHeight: 33,
    textAlign: 'center',
    textShadowColor: 'rgba(10, 8, 6, 0.32)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  subline: {
    fontFamily: AME.fonts.ui,
    fontSize: 14.5,
    color: 'rgba(255,251,247,0.92)',
    marginTop: 8,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 290,
    textShadowColor: 'rgba(10, 8, 6, 0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  tempHint: {
    marginTop: 8,
    fontFamily: AME.fonts.uiMedium,
    fontSize: 12,
    color: 'rgba(255,251,247,0.72)',
  },
  statsRow: {
    zIndex: 3,
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 251, 247, 0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 251, 247, 0.98)',
  },
  pillShadow: Platform.select({
    ios: {
      shadowColor: '#5C4030',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
    },
    android: { elevation: 3 },
    default: {},
  }),
  pillIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: AME.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { flex: 1 },
  pillValue: {
    fontFamily: AME.fonts.display,
    fontSize: 18,
    color: AME.colors.text,
    lineHeight: 20,
  },
  pillLabel: {
    fontFamily: AME.fonts.ui,
    fontSize: 11,
    color: AME.colors.textSecondary,
    lineHeight: 14,
    marginTop: 1,
  },
  pageBleed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
    zIndex: 1,
  },
});
