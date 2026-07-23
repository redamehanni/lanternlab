import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FadeIn from '../../components/ui/FadeIn';
import { useToast } from '../../components/ui/Toast';
import { PARTICIPATION_MODES } from '../../data/deuxiemeAme';
import { AME } from '../../theme';

/**
 * Porte « Participer » — point d'entrée ouvert vers toutes les formes de
 * participation à la vie locale. Les formes sont déclaratives (data/deuxiemeAme) :
 * on en ajoute sans refonte. Cette première version active la création
 * d'initiatives (habitant = producteur, source CITIZEN côté organe) ; les autres
 * formes sont annoncées honnêtement, prêtes à être branchées à leur organe.
 */
export default function ParticiperScreen({ navigation }) {
  const toast = useToast();

  function onPress(mode) {
    if (mode.enabled && mode.route) navigation.navigate(mode.route);
    else toast('Cette forme de participation arrive bientôt');
  }

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Ma Zone n'affiche pas seulement la vie du quartier : elle vous aide à la faire grandir. Choisissez votre façon de contribuer.
      </Text>

      {PARTICIPATION_MODES.map((mode, i) => (
        <FadeIn key={mode.id} delay={i * 50}>
          <TouchableOpacity style={[styles.card, AME.shadow.sm]} onPress={() => onPress(mode)} activeOpacity={0.9}>
            <View style={[styles.iconWrap, { backgroundColor: mode.color + '18' }]}>
              <Ionicons name={mode.icon} size={22} color={mode.color} />
            </View>
            <View style={styles.body}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{mode.label}</Text>
                {mode.comingSoon ? <View style={styles.soon}><Text style={styles.soonText}>Bientôt</Text></View> : null}
              </View>
              <Text style={styles.desc}>{mode.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={AME.colors.textMuted} />
          </TouchableOpacity>
        </FadeIn>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: AME.colors.bg },
  content: { padding: AME.spacing.md, paddingBottom: 40 },
  intro: {
    fontFamily: AME.fonts.ui,
    color: AME.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: AME.colors.card,
    borderRadius: AME.radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: AME.colors.borderLight,
  },
  iconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontFamily: AME.fonts.display,
    fontSize: 17,
    color: AME.colors.text,
  },
  soon: {
    backgroundColor: AME.colors.warningSoft,
    borderRadius: AME.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  soonText: {
    fontSize: 10,
    fontFamily: AME.fonts.uiBold,
    color: AME.colors.warning,
    letterSpacing: 0.5,
  },
  desc: {
    fontFamily: AME.fonts.ui,
    fontSize: 13,
    color: AME.colors.textSecondary,
    marginTop: 3,
    lineHeight: 18,
  },
});
