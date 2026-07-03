import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { getMyPromotions, deletePromotion, updatePromotion } from '../../api';
import { euro } from '../../utils/format';
import FadeIn from '../../components/ui/FadeIn';
import { useToast } from '../../components/ui/Toast';
import { THEME } from '../../theme';

function PromoCard({ item, index, onEdit, onDelete, onToggle }) {
  const isActive = item.status === 'active';
  return (
    <FadeIn delay={index * 40}>
      <View style={[styles.card, THEME.shadow.sm, !isActive && styles.cardEnded]}>
        <View style={styles.cardTop}>
          <View style={styles.badges}>
            <View style={[styles.typeBadge, { backgroundColor: isActive ? THEME.colors.successSoft : THEME.colors.borderLight }]}>
              <Text style={[styles.statusText, { color: isActive ? THEME.colors.success : THEME.colors.textMuted }]}>
                {isActive ? '● Active' : '○ Terminée'}
              </Text>
            </View>
            <View style={[styles.typeBadge, { backgroundColor: item.type === 'discount' ? THEME.colors.promoSoft : THEME.colors.accentSoft }]}>
              <Text style={[styles.typeText, { color: item.type === 'discount' ? THEME.colors.promo : THEME.colors.accent }]}>
                {item.type === 'discount' ? `-${item.discount_percent}%` : item.promo_label}
              </Text>
            </View>
          </View>
          {isActive && (
            <Switch value={!!item.active} onValueChange={() => onToggle(item)} trackColor={{ true: THEME.colors.success }} />
          )}
        </View>
        <Text style={styles.productName}>{item.product_name}</Text>
        {item.type === 'discount' && (
          <View style={styles.priceRow}>
            <Text style={styles.oldPrice}>{euro(item.original_price)}</Text>
            <Text style={styles.promoPrice}>{euro(item.promo_price)}</Text>
          </View>
        )}
        {item.max_quantity != null && (
          <Text style={styles.meta}>
            Stock promo : {item.remaining_quantity ?? 0} restant · {item.sold_count ?? 0} vendu(s) / {item.max_quantity}
          </Text>
        )}
        {item.ends_at && (
          <Text style={styles.meta}>Fin : {new Date(item.ends_at).toLocaleString('fr-FR')}</Text>
        )}
        {isActive && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(item)}>
              <Text style={styles.editBtnText}>Modifier</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.delBtn} onPress={() => onDelete(item)}>
              <Text style={styles.delBtnText}>Supprimer</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </FadeIn>
  );
}

export default function ManagePromotionsScreen({ navigation }) {
  const { socket } = useApp();
  const toast = useToast();
  const [active, setActive] = useState([]);
  const [ended, setEnded] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await getMyPromotions();
      setActive(res.data.active || []);
      setEnded(res.data.ended || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!socket) return;
    const refresh = () => load();
    socket.on('promotion:created', refresh);
    socket.on('promotion:updated', refresh);
    socket.on('promotion:deleted', refresh);
    return () => {
      socket.off('promotion:created', refresh);
      socket.off('promotion:updated', refresh);
      socket.off('promotion:deleted', refresh);
    };
  }, [socket, load]);

  async function toggleActive(promo) {
    await updatePromotion(promo.id, { active: !promo.active });
    toast(promo.active ? 'Promotion désactivée' : 'Promotion activée');
    load();
  }

  function handleDelete(promo) {
    Alert.alert('Supprimer', 'Supprimer cette promotion ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await deletePromotion(promo.id);
        toast('Promotion supprimée');
        load();
      }},
    ]);
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={THEME.colors.accent} />;

  return (
    <View style={styles.bg}>
      <FlatList
        data={[...active, ...ended]}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Tableau de bord marketing</Text>
            <Text style={styles.sub}>
              {active.length} active{active.length !== 1 ? 's' : ''} · {ended.length} terminée{ended.length !== 1 ? 's' : ''}
            </Text>
            <TouchableOpacity
              style={[styles.createBtn, THEME.shadow.md]}
              onPress={() => navigation.navigate('CreatePromotion')}
            >
              <Text style={styles.createBtnText}>+ Nouvelle promotion</Text>
            </TouchableOpacity>
            {active.length > 0 && <Text style={styles.sectionLabel}>Promotions actives</Text>}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 48 }}>🏷️</Text>
            <Text style={styles.emptyText}>Aucune promotion</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const showEndedHeader = ended.length > 0 && item.id === ended[0]?.id;
          return (
            <>
              {showEndedHeader && <Text style={styles.sectionLabel}>Promotions terminées</Text>}
              <PromoCard
                item={item}
                index={index}
                onEdit={(p) => navigation.navigate('PromotionDetail', { promo: p })}
                onDelete={handleDelete}
                onToggle={toggleActive}
              />
            </>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  list: { padding: THEME.spacing.md, paddingBottom: 100 },
  title: { ...THEME.typography.hero, fontSize: 26, color: THEME.colors.text },
  sub: { color: THEME.colors.textSecondary, marginBottom: 16 },
  sectionLabel: { ...THEME.typography.subtitle, color: THEME.colors.text, marginTop: 8, marginBottom: 10 },
  createBtn: {
    backgroundColor: THEME.colors.primary, borderRadius: THEME.radius.md,
    padding: 16, alignItems: 'center', marginBottom: 20,
  },
  createBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  card: {
    backgroundColor: THEME.colors.card, borderRadius: THEME.radius.lg,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  cardEnded: { opacity: 0.75 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badges: { flexDirection: 'row', gap: 8, flex: 1, flexWrap: 'wrap' },
  typeBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  typeText: { fontWeight: '800', fontSize: 12 },
  statusText: { fontWeight: '700', fontSize: 12 },
  productName: { fontSize: 17, fontWeight: '800', color: THEME.colors.text, marginTop: 10 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  oldPrice: { fontSize: 14, color: THEME.colors.textMuted, textDecorationLine: 'line-through' },
  promoPrice: { fontSize: 18, fontWeight: '900', color: THEME.colors.text },
  meta: { fontSize: 12, color: THEME.colors.textMuted, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  editBtn: { flex: 1, backgroundColor: THEME.colors.accentSoft, borderRadius: 10, padding: 12, alignItems: 'center' },
  editBtnText: { color: THEME.colors.accent, fontWeight: '700' },
  delBtn: { flex: 1, backgroundColor: THEME.colors.errorSoft, borderRadius: 10, padding: 12, alignItems: 'center' },
  delBtnText: { color: THEME.colors.error, fontWeight: '700' },
  empty: { alignItems: 'center', padding: 48 },
  emptyText: { color: THEME.colors.textSecondary, marginTop: 12 },
});
