import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { getEventDiscovery, getEventMurmurs, getModeReception, setModeReception } from '../../api';
import { useToast } from '../../components/ui/Toast';
import AmeHeader from '../../components/deuxiemeAme/AmeHeader';
import ModeReceptionPopover from '../../components/deuxiemeAme/ModeReceptionPopover';
import WeatherHero from '../../components/deuxiemeAme/WeatherHero';
import AiIntentBar from '../../components/deuxiemeAme/AiIntentBar';
import PorteCard from '../../components/deuxiemeAme/PorteCard';
import MurmurCard from '../../components/deuxiemeAme/MurmurCard';
import { PORTES } from '../../data/deuxiemeAme';
import { THEME } from '../../theme';

// Canaux activés par le toggle rapide du Mode Réception (réglage fin via l'écran).
const DEFAULT_RECEPTION_CHANNELS = ['vie_de_quartier', 'culture', 'gastronomie', 'lanternes', 'opportunites_rares'];

// Ambiance locale — point de branchement d'un futur organe météo/ambiance.
// Neutre et non bloquante : la page vit même sans donnée météo réelle.
function getLocalContext(user) {
  return {
    location: user?.city || user?.zone || 'Mon quartier',
    ambiance: { temp: null, condition: null, icon: 'partly-sunny-outline' },
  };
}

export default function DeuxiemeAmeHomeScreen({ navigation }) {
  const { user } = useApp();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [stats, setStats] = useState({ events: 0, lanterns: 0 });
  const [murmurs, setMurmurs] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [popover, setPopover] = useState(false);
  const [receptionBusy, setReceptionBusy] = useState(false);

  const local = getLocalContext(user);
  const receptionActive = subscriptions.length > 0;

  const load = useCallback(async () => {
    try {
      const [discRes, murmRes, recRes] = await Promise.all([
        getEventDiscovery().catch(() => ({ data: { events: [] } })),
        getEventMurmurs().catch(() => ({ data: { events: [] } })),
        getModeReception().catch(() => ({ data: { subscriptions: [] } })),
      ]);
      const events = discRes.data.events || [];
      const lanterns = events.filter((e) => e.capabilities?.isLantern);
      setStats({ events: events.length - lanterns.length, lanterns: lanterns.length });
      setMurmurs((murmRes.data.events || []).slice(0, 8));
      setSubscriptions(recRes.data.subscriptions || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openPorte(porte) {
    navigation.navigate(porte.route);
  }

  function onSuggestion(s) {
    if (s.route) navigation.navigate(s.route);
    else toast('L\u2019assistant du quartier arrive bientôt');
  }

  async function toggleReception() {
    setReceptionBusy(true);
    try {
      const next = receptionActive ? [] : DEFAULT_RECEPTION_CHANNELS.map((channel) => ({ channel }));
      const res = await setModeReception(next);
      setSubscriptions(res.data.subscriptions || []);
      toast(receptionActive ? 'Mode Réception désactivé' : 'Mode Réception activé');
    } catch {
      toast('Action impossible pour le moment');
    } finally {
      setReceptionBusy(false);
    }
  }

  return (
    <View style={[styles.bg, { paddingTop: insets.top }]}>
      <AmeHeader
        user={user}
        receptionActive={receptionActive}
        onReception={() => setPopover((v) => !v)}
        onProfile={() => navigation.navigate('ClientProfileHub')}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={styles.section}>
          <WeatherHero location={local.location} ambiance={local.ambiance} stats={stats} loading={loading} />
        </View>

        <View style={styles.section}>
          <AiIntentBar onSuggestion={onSuggestion} onAssist={() => toast('L\u2019assistant du quartier arrive bientôt')} />
        </View>

        <View style={styles.grid}>
          {PORTES.map((porte, i) => (
            <PorteCard key={porte.id} porte={porte} index={i} onPress={() => openPorte(porte)} />
          ))}
        </View>

        <View style={styles.murmurHead}>
          <Text style={styles.murmurTitle}>Les murmures du quartier</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Murmurs')}>
            <Text style={styles.seeAll}>Voir tout</Text>
          </TouchableOpacity>
        </View>
        {murmurs.length === 0 ? (
          <Text style={styles.empty}>Le quartier est calme pour l'instant. Revenez bientôt.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.murmurRow}>
            {murmurs.map((m) => (
              <MurmurCard key={m.id} murmur={m} onPress={() => navigation.navigate('EventDetail', { eventId: m.id })} />
            ))}
          </ScrollView>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <ModeReceptionPopover
        visible={popover}
        active={receptionActive}
        loading={receptionBusy}
        onToggle={toggleReception}
        onClose={() => setPopover(false)}
        onManage={() => { setPopover(false); navigation.navigate('ModeReception'); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { paddingBottom: 20 },
  section: { paddingHorizontal: THEME.spacing.md, marginTop: 12 },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.md, marginTop: 20, gap: 12,
  },
  murmurHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.md, marginTop: 26, marginBottom: 12,
  },
  murmurTitle: { ...THEME.typography.title, color: THEME.colors.text },
  seeAll: { ...THEME.typography.caption, color: THEME.colors.accent, fontWeight: '700' },
  murmurRow: { paddingHorizontal: THEME.spacing.md, gap: 12, paddingBottom: 4 },
  empty: { paddingHorizontal: THEME.spacing.md, color: THEME.colors.textSecondary, fontSize: 14 },
});
