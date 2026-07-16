import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect, DrawerActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { useCommunication } from '../../context/CommunicationContext';
import { getMyStore, getMerchantOrders, getMyPromotions } from '../../api';
import { buildBriefing } from '../../epee/briefing';
import { getModulesByFamily } from '../../epee/moduleRegistry';
import BriefingCard from '../../components/merchant/BriefingCard';
import { THEME } from '../../theme';

/**
 * Cockpit — écran d'accueil de l'Épée (poste de travail commerçant).
 *
 * SURFACE, PAS ORGANE : il ne fait qu'orchestrer. Il charge l'état des organes
 * (boutique, commandes, promotions, messages) et le donne aux adaptateurs qui
 * produisent le briefing. Aucune règle métier ici.
 *
 * RÈGLE UX : un briefing du matin, pas un tableau exhaustif. Le détail vit dans
 * les écrans d'organes atteints via les accès rapides ou le menu latéral.
 */
export default function MerchantCockpitScreen({ navigation }) {
  const { user } = useApp();
  const insets = useSafeAreaInsets();
  const comm = useCommunication();

  const [store, setStore] = useState(null);
  const [orders, setOrders] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try {
      const [storeRes, ordersRes, promoRes] = await Promise.all([
        getMyStore(),
        getMerchantOrders(),
        getMyPromotions().catch(() => ({ data: {} })),
      ]);
      setStore(storeRes.data.store || null);
      setOrders(ordersRes.data.orders || []);
      setPromotions(promoRes.data.promotions || promoRes.data.mine || []);
    } catch {
      // Le Cockpit reste affichable même si un organe est momentanément indisponible.
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (comm?.loadThreads) comm.loadThreads();
  }, [comm]);

  const openMenu = () => navigation.dispatch(DrawerActions.openDrawer());
  const goTo = (route) => route && navigation.navigate(route);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={THEME.colors.accent} />
      </View>
    );
  }

  const unreadMessages = comm?.getTotalUnreadMessagingTab?.() || 0;
  const briefing = buildBriefing({ store, orders, promotions, unreadMessages });
  const families = getModulesByFamily();

  return (
    <View style={styles.bg}>
      {/* En-tête */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.menuBtn} onPress={openMenu} accessibilityLabel="Ouvrir le menu">
          <Ionicons name="menu" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Bonjour, {user.name}</Text>
          <Text style={styles.storeName} numberOfLines={1}>
            {store ? store.name : 'Configurons votre commerce'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} />
        }
      >
        {!store ? (
          <EmptyStore onCreate={() => goTo('CreateStore')} />
        ) : (
          <>
            {/* Priorités du jour */}
            <SectionHeader title="Vos priorités" caption="Ce qui demande votre attention" />
            {briefing.priorities.length > 0 ? (
              briefing.priorities.map((card) => (
                <BriefingCard key={card.id} card={card} onPress={(c) => goTo(c.route)} />
              ))
            ) : (
              <CalmCard
                icon="checkmark-done-circle"
                title="Tout est sous contrôle"
                subtitle="Aucune action urgente pour le moment."
              />
            )}

            {/* Accès rapides (modules par famille) */}
            <SectionHeader title="Accès rapides" />
            {families.map((family) => (
              <View key={family.id} style={styles.familyBlock}>
                <Text style={styles.familyLabel}>{family.label}</Text>
                <View style={styles.tileRow}>
                  {family.modules.map((m) => (
                    <ModuleTile key={m.id} module={m} onPress={() => goTo(m.route)} />
                  ))}
                </View>
              </View>
            ))}

            {/* Vie du commerce */}
            <SectionHeader title="Vie du commerce" caption="Le pouls de votre activité" />
            {briefing.life.length > 0 ? (
              briefing.life.map((card) => (
                <BriefingCard key={card.id} card={card} onPress={(c) => goTo(c.route)} />
              ))
            ) : (
              <CalmCard icon="pulse" title="Activité calme" subtitle="Rien de neuf à signaler." />
            )}

            {/* Sections à venir — cadres posés, organes futurs */}
            <SectionHeader title="Aller plus loin" />
            <StubCard icon="flag-outline" title="Objectifs" subtitle="Fixez et suivez vos objectifs." />
            <StubCard icon="bulb-outline" title="Suggestions" subtitle="Des idées pour développer votre commerce." />
            <StubCard icon="heart-outline" title="Santé du commerce" subtitle="Un indice de forme, bientôt." />
          </>
        )}

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
}

function SectionHeader({ title, caption }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
    </View>
  );
}

function ModuleTile({ module, onPress }) {
  return (
    <TouchableOpacity style={styles.tile} activeOpacity={0.85} onPress={onPress} accessibilityLabel={module.label}>
      <View style={styles.tileIcon}>
        <Ionicons name={module.icon} size={22} color={THEME.colors.accent} />
      </View>
      <Text style={styles.tileLabel} numberOfLines={2}>{module.label}</Text>
    </TouchableOpacity>
  );
}

function CalmCard({ icon, title, subtitle }) {
  return (
    <View style={styles.calmCard}>
      <Ionicons name={icon} size={22} color={THEME.colors.success} />
      <View style={{ flex: 1 }}>
        <Text style={styles.calmTitle}>{title}</Text>
        <Text style={styles.calmSub}>{subtitle}</Text>
      </View>
    </View>
  );
}

function StubCard({ icon, title, subtitle }) {
  return (
    <View style={styles.stubCard}>
      <View style={styles.stubIcon}>
        <Ionicons name={icon} size={20} color={THEME.colors.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stubTitle}>{title}</Text>
        <Text style={styles.stubSub}>{subtitle}</Text>
      </View>
      <View style={styles.soonPill}>
        <Text style={styles.soonText}>Bientôt</Text>
      </View>
    </View>
  );
}

function EmptyStore({ onCreate }) {
  return (
    <View style={styles.emptyStore}>
      <View style={styles.emptyIcon}>
        <Ionicons name="storefront-outline" size={40} color={THEME.colors.accent} />
      </View>
      <Text style={styles.emptyTitle}>Bienvenue dans votre Épée</Text>
      <Text style={styles.emptySub}>
        Créez votre commerce pour débloquer votre poste de travail : catalogue,
        commandes, promotions et messages.
      </Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onCreate} activeOpacity={0.9}>
        <Ionicons name="add-circle-outline" size={20} color="#fff" />
        <Text style={styles.emptyBtnText}>Créer mon commerce</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: THEME.spacing.md, paddingBottom: THEME.spacing.md,
    borderBottomLeftRadius: THEME.radius.xl, borderBottomRightRadius: THEME.radius.xl,
  },
  menuBtn: {
    width: 42, height: 42, borderRadius: THEME.radius.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  greeting: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '500' },
  storeName: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.3, marginTop: 2 },
  content: { paddingHorizontal: THEME.spacing.md, paddingTop: THEME.spacing.lg },

  sectionHeader: { marginTop: THEME.spacing.lg, marginBottom: THEME.spacing.sm },
  sectionTitle: { ...THEME.typography.title, color: THEME.colors.text },
  sectionCaption: { color: THEME.colors.textSecondary, fontSize: 13, marginTop: 2 },

  familyBlock: { marginBottom: THEME.spacing.md },
  familyLabel: { ...THEME.typography.micro, color: THEME.colors.textMuted, textTransform: 'uppercase', marginBottom: THEME.spacing.sm },
  tileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: THEME.spacing.sm },
  tile: {
    width: '31%',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.md,
    paddingVertical: THEME.spacing.md, paddingHorizontal: THEME.spacing.sm,
    alignItems: 'center',
    borderWidth: 1, borderColor: THEME.colors.borderLight,
    ...THEME.shadow.sm,
  },
  tileIcon: {
    width: 44, height: 44, borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.accentSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  tileLabel: { fontSize: 12, fontWeight: '600', color: THEME.colors.text, textAlign: 'center' },

  calmCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: THEME.colors.successSoft,
    borderRadius: THEME.radius.lg, padding: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  calmTitle: { fontWeight: '700', color: THEME.colors.text, fontSize: 15 },
  calmSub: { color: THEME.colors.textSecondary, fontSize: 13, marginTop: 2 },

  stubCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg, padding: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
    borderWidth: 1, borderColor: THEME.colors.borderLight,
    borderStyle: 'dashed',
  },
  stubIcon: {
    width: 40, height: 40, borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  stubTitle: { fontWeight: '700', color: THEME.colors.textSecondary, fontSize: 15 },
  stubSub: { color: THEME.colors.textMuted, fontSize: 13, marginTop: 2 },
  soonPill: {
    backgroundColor: THEME.colors.borderLight, borderRadius: THEME.radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  soonText: { ...THEME.typography.micro, color: THEME.colors.textMuted },

  emptyStore: { alignItems: 'center', paddingVertical: THEME.spacing.xxl, paddingHorizontal: THEME.spacing.md },
  emptyIcon: {
    width: 88, height: 88, borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.accentSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: THEME.spacing.lg,
  },
  emptyTitle: { ...THEME.typography.title, color: THEME.colors.text, textAlign: 'center' },
  emptySub: { color: THEME.colors.textSecondary, textAlign: 'center', marginTop: THEME.spacing.sm, lineHeight: 21 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: THEME.colors.accent, borderRadius: THEME.radius.lg,
    paddingVertical: 14, paddingHorizontal: 24, marginTop: THEME.spacing.lg,
    ...THEME.shadow.float,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
