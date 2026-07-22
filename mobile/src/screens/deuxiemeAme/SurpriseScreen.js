import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getEventDiscovery } from '../../api';
import EventListItem from '../../components/deuxiemeAme/EventListItem';
import FadeIn from '../../components/ui/FadeIn';
import { THEME } from '../../theme';

/**
 * Porte « Se laisser surprendre ».
 *
 * Première version honnête : Ma Zone tire au sort une initiative découvrable et
 * vous la propose. L'enrichissement par l'assistant (curation personnalisée) se
 * branchera ici quand l'organe IA existera — sans refonte de cette surface.
 */
export default function SurpriseScreen({ navigation }) {
  const [pool, setPool] = useState([]);
  const [pick, setPick] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEventDiscovery();
      const events = res.data.events || [];
      setPool(events);
      setPick(events.length ? events[Math.floor(Math.random() * events.length)] : null);
    } catch {
      setPool([]);
      setPick(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function again() {
    if (pool.length <= 1) return;
    let next = pick;
    while (next && next.id === pick.id) {
      next = pool[Math.floor(Math.random() * pool.length)];
    }
    setPick(next);
  }

  if (loading) return <ActivityIndicator style={styles.center} color={THEME.colors.accent} />;

  return (
    <View style={styles.bg}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.wand}><Ionicons name="color-wand-outline" size={26} color="#fff" /></View>
          <Text style={styles.heroTitle}>Une surprise du quartier</Text>
          <Text style={styles.heroSub}>Rien que pour vous, au hasard des initiatives du moment.</Text>
        </View>

        {pick ? (
          <FadeIn key={pick.id}>
            <EventListItem event={pick} onPress={() => navigation.navigate('EventDetail', { eventId: pick.id })} />
          </FadeIn>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Rien à révéler pour l'instant</Text>
            <Text style={styles.emptyHint}>Revenez quand le quartier se sera un peu plus animé.</Text>
          </View>
        )}

        {pool.length > 1 ? (
          <TouchableOpacity style={[styles.againBtn, THEME.shadow.md]} onPress={again} activeOpacity={0.9}>
            <Ionicons name="shuffle" size={18} color="#fff" />
            <Text style={styles.againText}>Une autre surprise</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  center: { flex: 1 },
  content: { padding: THEME.spacing.md },
  hero: { alignItems: 'center', paddingVertical: 24 },
  wand: {
    width: 60, height: 60, borderRadius: 20, backgroundColor: THEME.colors.accent,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  heroTitle: { ...THEME.typography.title, color: THEME.colors.text },
  heroSub: { fontSize: 14, color: THEME.colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  empty: { alignItems: 'center', padding: 32 },
  emptyText: { color: THEME.colors.text, fontWeight: '700', fontSize: 16 },
  emptyHint: { color: THEME.colors.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  againBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: THEME.colors.primary, borderRadius: THEME.radius.md, padding: 16, marginTop: 20,
  },
  againText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
