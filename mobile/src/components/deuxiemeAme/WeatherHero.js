import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../theme';

/**
 * Hero de la Deuxième Âme : ancrage local (lieu + ambiance) et pouls du quartier.
 *
 * NOTE PRODUCTION : la météo n'a pas encore d'organe. On affiche une ambiance
 * neutre issue de `getLocalContext()` (point de branchement futur), sans jamais
 * bloquer la page. En revanche, les statistiques (événements / lanternes) sont
 * RÉELLES, calculées à partir des projections de l'Event Engine.
 */
export default function WeatherHero({ location, ambiance, stats, loading }) {
  const a = ambiance || {};
  return (
    <View style={[styles.card, THEME.shadow.md]}>
      <View style={styles.top}>
        <View style={styles.locRow}>
          <Ionicons name="location-outline" size={15} color="#fff" />
          <Text style={styles.loc}>{(location || 'Mon quartier').toUpperCase()}</Text>
        </View>
        {a.condition ? <Text style={styles.cond}>{a.condition}</Text> : null}
      </View>

      <View style={styles.tempRow}>
        <Text style={styles.temp}>{a.temp != null ? `${a.temp}°` : '—'}</Text>
        <Ionicons name={a.icon || 'partly-sunny-outline'} size={40} color="#FCD34D" />
      </View>

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
      <Ionicons name={icon} size={18} color="#fff" />
      <View style={styles.statText}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel} numberOfLines={2}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.xl,
    padding: 18,
    overflow: 'hidden',
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  loc: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  cond: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  tempRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  temp: { color: '#fff', fontSize: 44, fontWeight: '300', letterSpacing: -1 },
  stats: {
    flexDirection: 'row', alignItems: 'stretch', marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: THEME.radius.md, padding: 12,
  },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  statText: { flex: 1 },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11.5, lineHeight: 14 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 12 },
});
