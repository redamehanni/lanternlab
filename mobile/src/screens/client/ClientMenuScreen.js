import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FadeIn from '../../components/ui/FadeIn';
import { THEME } from '../../theme';

const MENU_ITEMS = [
  { id: 'stores', icon: 'storefront-outline', label: 'Mes commerces', screen: 'MesCommerces', color: '#059669' },
  { id: 'orders', icon: 'receipt-outline', label: 'Vos commandes', screen: 'OrderHistory', color: '#2563EB' },
  { id: 'info', icon: 'person-outline', label: 'Vos informations', screen: 'ClientInfo', color: '#7C3AED' },
  { id: 'help', icon: 'help-circle-outline', label: 'Centre d\'aide', screen: 'HelpCenter', color: '#059669' },
];

export default function ClientMenuScreen({ navigation }) {
  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.content}>
      <FadeIn>
        <Text style={styles.title}>Menu</Text>
        <Text style={styles.sub}>Accédez à toutes vos options</Text>
      </FadeIn>

      {MENU_ITEMS.map((item, i) => (
        <FadeIn key={item.id} delay={i * 80}>
          <TouchableOpacity
            style={[styles.item, THEME.shadow.sm]}
            onPress={() => navigation.navigate(item.screen)}
            activeOpacity={0.88}
          >
            <View style={[styles.iconWrap, { backgroundColor: item.color + '15' }]}>
              <Ionicons name={item.icon} size={24} color={item.color} />
            </View>
            <Text style={styles.label}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={20} color={THEME.colors.textMuted} />
          </TouchableOpacity>
        </FadeIn>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { padding: THEME.spacing.md, paddingBottom: 100 },
  title: { ...THEME.typography.hero, color: THEME.colors.text, fontSize: 32 },
  sub: { ...THEME.typography.body, color: THEME.colors.textSecondary, marginBottom: THEME.spacing.lg },
  item: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg, padding: THEME.spacing.md, marginBottom: 12,
    borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  label: { flex: 1, ...THEME.typography.subtitle, color: THEME.colors.text },
});
