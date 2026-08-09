import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, ImageBackground,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { useOpportunity } from '../../context/OpportunityContext';
import { getEventDiscovery, getEventMurmurs, getModeReception, setModeReception } from '../../api';
import { useToast } from '../../components/ui/Toast';
import AmeHeader from '../../components/deuxiemeAme/AmeHeader';
import ModeReceptionPopover from '../../components/deuxiemeAme/ModeReceptionPopover';
import WeatherHero from '../../components/deuxiemeAme/WeatherHero';
import AiIntentBar from '../../components/deuxiemeAme/AiIntentBar';
import PorteCard from '../../components/deuxiemeAme/PorteCard';
import MurmurCard from '../../components/deuxiemeAme/MurmurCard';
import FadeIn from '../../components/ui/FadeIn';
import {
  PORTES, isPorteOpen, porteByRoute, openPortesCount,
} from '../../data/deuxiemeAme';
import { getIllustration } from '../../illustrations/registry';
import { AME, MOTION } from '../../theme';

const DEFAULT_RECEPTION_CHANNELS = ['vie_de_quartier', 'culture', 'gastronomie', 'lanternes', 'opportunites_rares'];
const PAGE_PAPER = getIllustration('background.papierOrange');

function getLocalContext(user) {
  return {
    location: user?.city || user?.zone || 'Mon quartier',
    ambiance: { temp: null, condition: null, icon: 'partly-sunny-outline' },
  };
}

export default function DeuxiemeAmeHomeScreen({ navigation }) {
  const { user } = useApp();
  const { unread, refreshUnread } = useOpportunity();
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
      // Signal hero : Lanternes seulement — ne pas afficher le compteur
      // « événements » tant que cette Porte est scellée (couche d'accès public).
      // Les murmures ci-dessous restent NON filtrés : canal, pas Porte.
      setStats({ lanterns: lanterns.length, showEvents: false });
      setMurmurs((murmRes.data.events || []).slice(0, 8));
      setSubscriptions(recRes.data.subscriptions || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); refreshUnread(); }, [load, refreshUnread]));

  function openPorte(porte) {
    if (!isPorteOpen(porte)) {
      toast(porte.sealedHint || 'Cette Porte est encore scellée.');
      return;
    }
    navigation.navigate(porte.route);
  }

  function onSuggestion(s) {
    if (s.route) {
      const porte = porteByRoute(s.route);
      if (porte && !isPorteOpen(porte)) {
        toast(porte.sealedHint || 'Cette Porte est encore scellée.');
        return;
      }
      navigation.navigate(s.route);
      return;
    }
    toast('L\u2019assistant du quartier arrive bientôt');
  }

  async function toggleReception() {
    setReceptionBusy(true);
    try {
      const next = receptionActive ? [] : DEFAULT_RECEPTION_CHANNELS.map((channel) => ({ channel }));
      const res = await setModeReception(next);
      setSubscriptions(res.data.subscriptions || []);
      toast(receptionActive ? 'Mode Réception désactivé' : 'Mode Réception activé');
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error;
      if (status === 401) toast('Session expirée — reconnectez-vous pour activer le Mode Réception');
      else toast(msg || 'Action impossible pour le moment');
    } finally {
      setReceptionBusy(false);
    }
  }

  return (
    <ImageBackground
      source={PAGE_PAPER.source}
      style={styles.bg}
      imageStyle={styles.bgImage}
      accessibilityLabel={PAGE_PAPER.alt}
    >
      <View style={[styles.inner, { paddingTop: insets.top }]}>
      <AmeHeader
        user={user}
        receptionActive={receptionActive}
        unread={unread}
        onReception={() => setPopover((v) => !v)}
        onProfile={() => navigation.navigate('ClientProfileHub')}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={AME.colors.accent}
            onRefresh={() => { setRefreshing(true); load(); }}
          />
        }
      >
        <FadeIn delay={40} style={styles.heroSection}>
          <WeatherHero location={local.location} ambiance={local.ambiance} stats={stats} loading={loading} />
        </FadeIn>

        <FadeIn delay={120} style={styles.section}>
          <AiIntentBar onSuggestion={onSuggestion} onAssist={() => toast('L\u2019assistant du quartier arrive bientôt')} />
        </FadeIn>

        <FadeIn delay={180} style={styles.portesHead}>
          <Text style={styles.portesTitle}>Les Portes</Text>
          <Text style={styles.portesSub}>
            {PORTES.length} Portes · {openPortesCount()} ouverte
            {openPortesCount() > 1 ? 's' : ''} — Les Lanternes ne sont que le premier chapitre
          </Text>
        </FadeIn>

        <View style={styles.grid}>
          {PORTES.map((porte, i) => (
            <PorteCard key={porte.id} porte={porte} index={i} onPress={() => openPorte(porte)} />
          ))}
        </View>

        <View style={styles.murmurHead}>
          <Text style={styles.murmurTitle}>Les murmures du quartier</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Murmurs')} activeOpacity={0.8}>
            <Text style={styles.seeAll}>Voir tout →</Text>
          </TouchableOpacity>
        </View>
        {murmurs.length === 0 ? (
          <Text style={styles.empty}>Le quartier est calme pour l{"\u2019"}instant. Revenez bientôt.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.murmurRow}>
            {murmurs.map((m, i) => (
              <FadeIn key={m.id} delay={i * MOTION.delay.stagger}>
                <MurmurCard murmur={m} onPress={() => navigation.navigate('EventDetail', { eventId: m.id })} />
              </FadeIn>
            ))}
          </ScrollView>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>

      <ModeReceptionPopover
        visible={popover}
        active={receptionActive}
        loading={receptionBusy}
        unread={unread}
        onToggle={toggleReception}
        onClose={() => setPopover(false)}
        onManage={() => { setPopover(false); navigation.navigate('ModeReception'); }}
        onOpenMailbox={() => { setPopover(false); navigation.navigate('Mailbox'); }}
      />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: AME.colors.bg },
  bgImage: { resizeMode: 'cover' },
  inner: { flex: 1 },
  content: { paddingBottom: 24 },
  heroSection: {
    paddingHorizontal: 0,
    marginTop: 6,
  },
  section: { paddingHorizontal: AME.spacing.md, marginTop: 18 },
  portesHead: {
    paddingHorizontal: AME.spacing.md,
    marginTop: AME.spacing.section,
    marginBottom: 4,
  },
  portesTitle: {
    fontFamily: AME.fonts.display,
    fontSize: 24,
    color: AME.colors.text,
    letterSpacing: -0.3,
  },
  portesSub: {
    fontFamily: AME.fonts.ui,
    fontSize: 13.5,
    color: AME.colors.textSecondary,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: AME.spacing.md,
    marginTop: 12,
    rowGap: 9,
  },
  murmurHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: AME.spacing.md,
    marginTop: 32,
    marginBottom: 14,
  },
  murmurTitle: {
    fontFamily: AME.fonts.display,
    fontSize: 22,
    color: AME.colors.text,
  },
  seeAll: {
    fontFamily: AME.fonts.uiSemiBold,
    fontSize: 13.5,
    color: AME.colors.accentDeep,
  },
  murmurRow: { paddingHorizontal: AME.spacing.md, gap: 12, paddingBottom: 4 },
  empty: {
    paddingHorizontal: AME.spacing.md,
    color: AME.colors.textSecondary,
    fontFamily: AME.fonts.ui,
    fontSize: 14.5,
    lineHeight: 21,
  },
});
