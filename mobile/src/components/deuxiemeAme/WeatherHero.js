import React from 'react';
import { View, Text, StyleSheet, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AME } from '../../theme';
import { getIllustration } from '../../illustrations/registry';

/**
 * Hero de la Deuxième Âme : fenêtre ouverte sur le quartier.
 *
 * Structure prête pour météo / saison / heure (props ambiance).
 * Stats Event Engine réelles. Illustration via registry (`banner.quartier`).
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

  return (
    <View style={[styles.shell, AME.shadow.md]}>
      <ImageBackground source={illu.source} style={styles.banner} imageStyle={styles.bannerImg}>
        <View style={styles.wash} />
        <View style={styles.top}>
          <View style={styles.locRow}>
            <Ionicons name="location-outline" size={14} color="rgba(255,251,247,0.9)" />
            <Text style={styles.loc}>{(location || 'Mon quartier').toUpperCase()}</Text>
          </View>
          {a.condition ? <Text style={styles.cond}>{a.condition}</Text> : null}
        </View>

        <View style={styles.poetry}>
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.subline}>{subline}</Text>
          {a.temp != null ? (
            <Text style={styles.tempHint}>{a.temp}° · {a.condition || 'dehors'}</Text>
          ) : null}
        </View>
      </ImageBackground>

      <View style={styles.stats}>
        <Stat
          icon="calendar-outline"
          value={loading ? '…' : String(stats?.events ?? 0)}
          label={(stats?.events ?? 0) > 1 ? 'événements en cours' : 'événement en cours'}
        />
        <View style={styles.statDivider} />
        <Stat
          icon="sparkles-outline"
          value={loading ? '…' : String(stats?.lanterns ?? 0)}
          label={(stats?.lanterns ?? 0) > 1 ? 'lanternes disponibles' : 'lanterne disponible'}
        />
      </View>
    </View>
  );
}

function Stat({ icon, value, label }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={16} color={AME.colors.accentDeep} />
      </View>
      <View style={styles.statText}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel} numberOfLines={2}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: AME.radius.xl,
    overflow: 'hidden',
    backgroundColor: AME.colors.card,
    borderWidth: 1,
    borderColor: AME.colors.borderLight,
  },
  banner: {
    minHeight: 200,
    justifyContent: 'space-between',
    padding: 18,
  },
  bannerImg: {
    resizeMode: 'cover',
  },
  wash: {
    ...StyleSheet.absoluteFillObject,
    // Léger voile bas pour la lisibilité du texte, sans noyer le café
    backgroundColor: 'rgba(28, 22, 18, 0.28)',
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1,
  },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  loc: {
    color: 'rgba(255,251,247,0.92)',
    fontSize: 11,
    fontFamily: AME.fonts.uiSemiBold,
    letterSpacing: 1.2,
  },
  cond: {
    color: 'rgba(255,251,247,0.8)',
    fontSize: 12.5,
    fontFamily: AME.fonts.uiMedium,
  },
  poetry: { zIndex: 1, marginTop: 36, paddingBottom: 4 },
  headline: {
    fontFamily: AME.fonts.display,
    fontSize: 26,
    color: AME.colors.textOnDark,
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  subline: {
    fontFamily: AME.fonts.ui,
    fontSize: 14,
    color: 'rgba(255,251,247,0.88)',
    marginTop: 6,
    lineHeight: 20,
    maxWidth: '92%',
  },
  tempHint: {
    marginTop: 10,
    fontFamily: AME.fonts.uiMedium,
    fontSize: 12.5,
    color: 'rgba(255,251,247,0.75)',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: 14,
    backgroundColor: AME.colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: AME.colors.borderLight,
  },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: AME.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statText: { flex: 1 },
  statValue: {
    fontFamily: AME.fonts.display,
    fontSize: 22,
    color: AME.colors.text,
  },
  statLabel: {
    fontFamily: AME.fonts.ui,
    color: AME.colors.textSecondary,
    fontSize: 11.5,
    lineHeight: 15,
  },
  statDivider: {
    width: 1,
    backgroundColor: AME.colors.border,
    marginHorizontal: 10,
  },
});
